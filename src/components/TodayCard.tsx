// The check-in card, shared by the Home page and the Attendance page.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checkIn, checkOut, getToday } from "../api/attendance";
import { useAuth } from "../app/AuthContext";
import { describeError } from "../lib/errors";
import { formatClock, formatMinutes } from "../lib/time";
import { ErrorMessage } from "./ErrorMessage";
import { Loading } from "./Loading";
import { DayMarks, statusText } from "./MonthTable";
import { useToast } from "./Toast";
import { BUTTON_OK, BUTTON_PRIMARY, Card } from "./ui";

/** "10:45" -> 645 minutes after midnight. */
function minutesOf(clockText: string): number {
  const [hours, minutes] = clockText.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** The minutes after midnight in Indian time right now. */
function indianMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  return hours * 60 + Number(parts.find((part) => part.type === "minute")?.value ?? 0);
}

const BAR_START_MINUTES = 8 * 60; // the bar starts at 8:00 AM, for people who come early
const BAR_END_MINUTES = 23 * 60 + 30; // and ends at 11:30 PM, for overtime

/** 645 -> "10:45 AM". */
function clockLabel(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const period = hours24 >= 12 ? "PM" : "AM";
  return `${hours24 % 12 === 0 ? 12 : hours24 % 12}:${String(minutes % 60).padStart(2, "0")} ${period}`;
}

/** The day as a bar from 8:00 AM to 11:30 PM: early, on time (green), late (amber), after office hours (blue, overtime), and a saffron marker for now. */
function WorkdayRibbon({ officeStart, lateAfter, officeEnd }: { officeStart: string; lateAfter: string; officeEnd: string }) {
  const span = BAR_END_MINUTES - BAR_START_MINUTES;
  const percentOf = (minutes: number) => Math.min(100, Math.max(0, ((minutes - BAR_START_MINUTES) / span) * 100));
  const startPercent = percentOf(minutesOf(officeStart));
  const latePercent = percentOf(minutesOf(lateAfter));
  const endPercent = percentOf(minutesOf(officeEnd));
  const nowMinutes = indianMinutesNow();
  const isInsideBar = nowMinutes >= BAR_START_MINUTES && nowMinutes <= BAR_END_MINUTES;
  const segment = "absolute inset-y-0";
  return (
    <div className="mt-4" aria-hidden="true">
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`${segment} bg-ok-soft`} style={{ left: `${startPercent}%`, width: `${latePercent - startPercent}%` }} />
        <div className={`${segment} bg-warn-soft`} style={{ left: `${latePercent}%`, width: `${endPercent - latePercent}%` }} />
        <div className={`${segment} bg-holiday-soft`} style={{ left: `${endPercent}%`, right: 0 }} />
      </div>
      {isInsideBar && (
        <span className="relative -mt-4 block h-4">
          <span className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-full bg-accent" style={{ left: `${percentOf(nowMinutes)}%` }} />
        </span>
      )}
      <div className="relative mt-1 h-4 text-xs text-ink-3">
        <span className="absolute left-0 hidden sm:block">{clockLabel(BAR_START_MINUTES)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${latePercent}%` }}>
          {clockLabel(minutesOf(lateAfter))}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${endPercent}%` }}>
          {clockLabel(minutesOf(officeEnd))}
        </span>
        <span className="absolute right-0">{clockLabel(BAR_END_MINUTES)}</span>
      </div>
    </div>
  );
}

export function TodayCard() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();

  const todayQuery = useQuery({ queryKey: ["attendance-today", employeeId], queryFn: () => getToday(token) });
  const today = todayQuery.data;

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["attendance-today", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-month", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-corrections", employeeId] });
  };
  const punchMutation = useMutation({
    mutationFn: (action: "in" | "out") => (action === "in" ? checkIn(token) : checkOut(token)),
    onSuccess: (result, action) => {
      const time = formatClock(action === "in" ? result.checked_in_at : result.checked_out_at);
      toast.success(action === "in" ? `Checked in at ${time}` : `Checked out at ${time}`);
    },
    onSettled: refreshAll,
  });

  return (
    <Card label="Today">
      {todayQuery.isError && <ErrorMessage message={describeError(todayQuery.error)} />}
      {todayQuery.isPending && <Loading fill="inline" label="Loading today" delayMilliseconds={300} />}
      {today && (
        <div className="space-y-2">
          <p className="text-base font-semibold text-ink">Today, {today.work_date}</p>
          <p className="text-sm text-ink-2">
            Office hours {clockLabel(minutesOf(today.office_start))} to {clockLabel(minutesOf(today.office_end))}. Check in after {clockLabel(minutesOf(today.late_after))} is marked late.
          </p>
          {today.day_note && <p className="text-sm text-ink-2">{today.day_note}</p>}
          <p className="text-sm text-ink-2" data-testid="today-state">
            {statusText(today.status)}
            <DayMarks day={today} />
            {today.checked_in_at && ` | In ${formatClock(today.checked_in_at)}`}
            {today.checked_out_at && ` | Out ${formatClock(today.checked_out_at)}`}
            {today.worked_minutes !== null && ` | Worked ${formatMinutes(today.worked_minutes)}`}
          </p>
          <WorkdayRibbon officeStart={today.office_start} lateAfter={today.late_after} officeEnd={today.office_end} />
          <div className="flex gap-2 pt-2">
            <button type="button" disabled={!today.can_check_in || punchMutation.isPending} onClick={() => punchMutation.mutate("in")} className={BUTTON_OK}>
              {punchMutation.isPending && punchMutation.variables === "in" ? "Checking in..." : "Check in"}
            </button>
            <button type="button" disabled={!today.can_check_out || punchMutation.isPending} onClick={() => punchMutation.mutate("out")} className={BUTTON_PRIMARY}>
              {punchMutation.isPending && punchMutation.variables === "out" ? "Checking out..." : "Check out"}
            </button>
          </div>
          {today.network_check_enabled && <p className="text-xs text-ink-3">Check in and check out work only from the office network.</p>}
        </div>
      )}
      {punchMutation.isError && <ErrorMessage message={describeError(punchMutation.error)} />}
    </Card>
  );
}

// A month of attendance: the summary line and one row per day. Used by the Attendance page and the team page.
import { useState } from "react";
import type { AttendanceDay, AttendanceMonth } from "../api/types";
import { formatClock, formatMinutes } from "../lib/time";

const STATUS_TEXT: Record<string, string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  incomplete: "No check-out",
  on_leave: "On leave",
  holiday: "Holiday",
  weekend: "Weekend",
  checked_in: "Checked in",
  not_checked_in: "Not checked in yet",
};

// Background of a day in the calendar.
const CELL_COLOUR: Record<string, string> = {
  present: "bg-ok-soft text-ok",
  half_day: "bg-warn-soft text-warn",
  absent: "bg-bad-soft text-bad",
  incomplete: "bg-bad-soft text-bad",
  on_leave: "bg-brand-soft text-brand",
  holiday: "bg-holiday-soft text-holiday",
  weekend: "bg-surface-2 text-ink-3",
  checked_in: "bg-ok-soft text-ok",
  not_checked_in: "bg-surface text-ink-2 border border-line",
};

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_COLOUR: Record<string, string> = {
  present: "text-ok",
  half_day: "text-warn",
  absent: "text-bad",
  incomplete: "text-bad",
  on_leave: "text-brand",
  checked_in: "text-ok",
};

export function statusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}

export function DayMarks({ day }: { day: Pick<AttendanceDay, "is_late" | "is_early_leave"> }) {
  return (
    <>
      {day.is_late && <span className="ml-1 rounded bg-warn-soft px-1.5 text-xs text-warn">Late</span>}
      {day.is_early_leave && <span className="ml-1 rounded bg-warn-soft px-1.5 text-xs text-warn">Early leave</span>}
    </>
  );
}

function DayDetails({ day }: { day: AttendanceDay }) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3 text-sm" data-testid="day-details">
      <p className="font-medium">
        {day.date} {day.weekday}: <span className={STATUS_COLOUR[day.status] ?? "text-ink-2"}>{statusText(day.status)}</span>
        <DayMarks day={day} />
      </p>
      {day.note && <p className="text-ink-2">{day.note}</p>}
      {(day.check_in_at || day.check_out_at) && (
        <p className="text-ink-2">
          In {formatClock(day.check_in_at) || "-"} | Out {formatClock(day.check_out_at) || "-"}
          {day.worked_minutes !== null && ` | Worked ${formatMinutes(day.worked_minutes)}`}
        </p>
      )}
    </div>
  );
}

/** A month as a calendar. Hover or click a day to see its check-in and check-out below. */
export function MonthTable({ month }: { month: AttendanceMonth }) {
  const { summary } = month;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const shownDate = hoveredDate ?? selectedDate;
  const shownDay = month.days.find((day) => day.date === shownDate) ?? null;
  // Empty cells before the 1st so that the weekdays line up (the week starts on Monday).
  const firstDate = month.days[0]?.date;
  const emptyCellsBefore = firstDate ? (new Date(`${firstDate}T00:00:00Z`).getUTCDay() + 6) % 7 : 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        Present {summary.present}, half day {summary.half_day}, absent {summary.absent}, on leave {summary.on_leave}, late {summary.late_days}, early
        leave {summary.early_leave_days}. Worked {formatMinutes(summary.worked_minutes)}.
        {summary.incomplete > 0 && ` No check-out on ${summary.incomplete} day(s).`}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-3">
        {WEEK_HEADERS.map((name) => (
          <div key={name}>{name}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendar">
        {Array.from({ length: emptyCellsBefore }, (_, index) => (
          <div key={`empty-${index}`} />
        ))}
        {month.days.map((day) => (
          <button
            key={day.date}
            type="button"
            aria-label={`${day.date} ${statusText(day.status)}`}
            aria-pressed={selectedDate === day.date}
            onClick={() => setSelectedDate(selectedDate === day.date ? null : day.date)}
            onMouseEnter={() => setHoveredDate(day.date)}
            onMouseLeave={() => setHoveredDate(null)}
            onFocus={() => setHoveredDate(day.date)}
            onBlur={() => setHoveredDate(null)}
            className={`flex h-12 flex-col items-center justify-center rounded-md text-sm ${CELL_COLOUR[day.status] ?? "bg-surface"} ${
              selectedDate === day.date ? "ring-2 ring-brand" : ""
            }`}
          >
            <span>{Number(day.date.slice(8))}</span>
            {(day.is_late || day.is_early_leave) && (
              <span className="text-[10px] leading-none">
                {day.is_late && "L"}
                {day.is_early_leave && "E"}
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-3">
        Green present, yellow half day, red absent or no check-out, purple leave, blue holiday. L is late, E is early leave.
      </p>
      {shownDay ? <DayDetails day={shownDay} /> : <p className="text-sm text-ink-3">Hover or click a day to see the details.</p>}
    </div>
  );
}

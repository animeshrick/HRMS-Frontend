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
  present: "bg-green-100 text-green-900",
  half_day: "bg-amber-100 text-amber-900",
  absent: "bg-red-100 text-red-900",
  incomplete: "bg-red-100 text-red-900",
  on_leave: "bg-indigo-100 text-indigo-900",
  holiday: "bg-sky-100 text-sky-900",
  weekend: "bg-slate-100 text-slate-400",
  checked_in: "bg-green-50 text-green-900",
  not_checked_in: "bg-white text-slate-700 border border-slate-200",
};

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_COLOUR: Record<string, string> = {
  present: "text-green-700",
  half_day: "text-amber-700",
  absent: "text-red-700",
  incomplete: "text-red-700",
  on_leave: "text-indigo-700",
  checked_in: "text-green-700",
};

export function statusText(status: string): string {
  return STATUS_TEXT[status] ?? status;
}

export function DayMarks({ day }: { day: Pick<AttendanceDay, "is_late" | "is_early_leave"> }) {
  return (
    <>
      {day.is_late && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800">Late</span>}
      {day.is_early_leave && <span className="ml-1 rounded bg-orange-100 px-1.5 text-xs text-orange-800">Early leave</span>}
    </>
  );
}

function DayDetails({ day }: { day: AttendanceDay }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="day-details">
      <p className="font-medium">
        {day.date} {day.weekday}: <span className={STATUS_COLOUR[day.status] ?? "text-slate-600"}>{statusText(day.status)}</span>
        <DayMarks day={day} />
      </p>
      {day.note && <p className="text-slate-600">{day.note}</p>}
      {(day.check_in_at || day.check_out_at) && (
        <p className="text-slate-700">
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
      <p className="text-sm text-slate-700">
        Present {summary.present}, half day {summary.half_day}, absent {summary.absent}, on leave {summary.on_leave}, late {summary.late_days}, early
        leave {summary.early_leave_days}. Worked {formatMinutes(summary.worked_minutes)}.
        {summary.incomplete > 0 && ` No check-out on ${summary.incomplete} day(s).`}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
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
            className={`flex h-12 flex-col items-center justify-center rounded-md text-sm ${CELL_COLOUR[day.status] ?? "bg-white"} ${
              selectedDate === day.date ? "ring-2 ring-indigo-500" : ""
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
      <p className="text-xs text-slate-500">
        Green present, yellow half day, red absent or no check-out, purple leave, blue holiday. L is late, E is early leave.
      </p>
      {shownDay ? <DayDetails day={shownDay} /> : <p className="text-sm text-slate-500">Hover or click a day to see the details.</p>}
    </div>
  );
}

// A month of attendance: the summary line and one row per day. Used by the Attendance page and the team page.
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

export function MonthTable({ month }: { month: AttendanceMonth }) {
  const { summary } = month;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        Present {summary.present}, half day {summary.half_day}, absent {summary.absent}, on leave {summary.on_leave}, late {summary.late_days}, early
        leave {summary.early_leave_days}. Worked {formatMinutes(summary.worked_minutes)}.
        {summary.incomplete > 0 && ` No check-out on ${summary.incomplete} day(s).`}
      </p>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-3">Date</th>
            <th className="pr-3">Status</th>
            <th className="pr-3">In</th>
            <th className="pr-3">Out</th>
            <th>Worked</th>
          </tr>
        </thead>
        <tbody>
          {month.days.map((day) => (
            <tr key={day.date} className="border-t border-slate-100">
              <td className="py-1 pr-3">
                {day.date.slice(8)} {day.weekday}
              </td>
              <td className={`pr-3 ${STATUS_COLOUR[day.status] ?? "text-slate-600"}`}>
                {statusText(day.status)}
                <DayMarks day={day} />
                {day.note && <span className="ml-1 text-xs text-slate-500">({day.note})</span>}
              </td>
              <td className="pr-3">{formatClock(day.check_in_at)}</td>
              <td className="pr-3">{formatClock(day.check_out_at)}</td>
              <td>{formatMinutes(day.worked_minutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { askCorrection, checkIn, checkOut, getMyCorrections, getMyMonth, getToday } from "../api/attendance";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { DayMarks, MonthTable, statusText } from "../components/MonthTable";
import { describeError } from "../lib/errors";
import { formatClock, formatMinutes } from "../lib/time";

/** "2026-11-12" minus some days, as "2026-11-05". Works on the date text only, so the computer's time zone does not matter. */
function minusDays(dayText: string, days: number): string {
  const moment = new Date(`${dayText}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() - days);
  return moment.toISOString().slice(0, 10);
}

export function AttendancePage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string | null>(null); // null = the current month
  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionIn, setCorrectionIn] = useState("");
  const [correctionOut, setCorrectionOut] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const todayQuery = useQuery({ queryKey: ["attendance-today", employeeId], queryFn: () => getToday(token) });
  const today = todayQuery.data;
  const shownMonth = month ?? today?.work_date.slice(0, 7) ?? null;
  const monthQuery = useQuery({
    queryKey: ["attendance-month", employeeId, shownMonth],
    queryFn: () => getMyMonth(token, shownMonth!),
    enabled: shownMonth !== null,
  });
  const correctionsQuery = useQuery({ queryKey: ["attendance-corrections", employeeId], queryFn: () => getMyCorrections(token) });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["attendance-today", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-month", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["attendance-corrections", employeeId] });
  };
  const punchMutation = useMutation({
    mutationFn: (action: "in" | "out") => (action === "in" ? checkIn(token) : checkOut(token)),
    onSettled: refreshAll,
  });
  const correctionMutation = useMutation({
    mutationFn: () =>
      askCorrection(token, {
        work_date: correctionDate,
        check_in_time: correctionIn || undefined,
        check_out_time: correctionOut || undefined,
        reason: correctionReason.trim(),
      }),
    onSuccess: () => {
      setCorrectionDate("");
      setCorrectionIn("");
      setCorrectionOut("");
      setCorrectionReason("");
    },
    onSettled: refreshAll,
  });

  function submitCorrection(event: FormEvent) {
    event.preventDefault();
    correctionMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold">Attendance</h1>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="Today">
        {todayQuery.isError && <ErrorMessage message={describeError(todayQuery.error)} />}
        {today && (
          <div className="space-y-2">
            <p className="font-medium">Today, {today.work_date}</p>
            <p className="text-sm text-slate-600">
              Office hours {today.office_start} to {today.office_end}. Check in after {today.late_after} is marked late.
            </p>
            {today.day_note && <p className="text-sm text-slate-700">{today.day_note}</p>}
            <p className="text-sm text-slate-700" data-testid="today-state">
              {statusText(today.status)}
              <DayMarks day={today} />
              {today.checked_in_at && ` | In ${formatClock(today.checked_in_at)}`}
              {today.checked_out_at && ` | Out ${formatClock(today.checked_out_at)}`}
              {today.worked_minutes !== null && ` | Worked ${formatMinutes(today.worked_minutes)}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!today.can_check_in || punchMutation.isPending}
                onClick={() => punchMutation.mutate("in")}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                Check in
              </button>
              <button
                type="button"
                disabled={!today.can_check_out || punchMutation.isPending}
                onClick={() => punchMutation.mutate("out")}
                className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Check out
              </button>
            </div>
            {today.network_check_enabled && <p className="text-xs text-slate-500">Check in and check out work only from the office network.</p>}
          </div>
        )}
        {punchMutation.isError && <ErrorMessage message={describeError(punchMutation.error)} />}
      </section>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="Month">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Month</h2>
          <input
            type="month"
            aria-label="Month"
            value={shownMonth ?? ""}
            max={today?.work_date.slice(0, 7)}
            onChange={(event) => setMonth(event.target.value || null)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        {monthQuery.isError && <ErrorMessage message={describeError(monthQuery.error)} />}
        {monthQuery.data && <MonthTable month={monthQuery.data} />}
      </section>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="Missed check-in or check-out">
        <h2 className="mb-1 font-medium">Missed a check-in or check-out?</h2>
        <p className="mb-3 text-sm text-slate-600">You can ask for a correction for the last 7 days. Times are Indian time.</p>
        <form onSubmit={submitCorrection} className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Date
            <input
              type="date"
              required
              value={correctionDate}
              min={today ? minusDays(today.work_date, 7) : undefined}
              max={today?.work_date}
              onChange={(event) => setCorrectionDate(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <span />
          <label className="flex flex-col gap-1">
            Check-in time (optional)
            <input type="time" value={correctionIn} onChange={(event) => setCorrectionIn(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">
            Check-out time (optional)
            <input type="time" value={correctionOut} onChange={(event) => setCorrectionOut(event.target.value)} className="rounded-md border border-slate-300 px-2 py-1" />
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            Reason
            <input
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1"
            />
          </label>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={correctionMutation.isPending || (!correctionIn && !correctionOut)}
              className="rounded-md bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Send request
            </button>
          </div>
        </form>
        {correctionMutation.isError && <ErrorMessage message={describeError(correctionMutation.error)} />}
        {correctionMutation.isSuccess && (
          <p className="mt-2 text-sm text-green-700">
            {correctionMutation.data.status === "approved" ? "Approved automatically." : "Request sent. It is waiting for approval."}
          </p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="My correction requests">
        <h2 className="mb-2 font-medium">My correction requests</h2>
        {correctionsQuery.data?.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
        <ul className="space-y-2 text-sm">
          {correctionsQuery.data?.map((correction) => (
            <li key={correction.id} className="border-t border-slate-100 pt-2">
              <p>
                {correction.work_date}: {correction.requested_check_in && `in ${correction.requested_check_in} `}
                {correction.requested_check_out && `out ${correction.requested_check_out}`} - <strong>{correction.status}</strong>
              </p>
              <p className="text-slate-500">Reason: {correction.reason}</p>
              {correction.decision_note && <p className="text-slate-500">Remark: {correction.decision_note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useToast } from "../components/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { askCorrection, getMyCorrections, getMyMonth, getToday } from "../api/attendance";
import { useAuth } from "../app/AuthContext";
import { TodayCard } from "../components/TodayCard";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { MonthTable } from "../components/MonthTable";
import { describeError } from "../lib/errors";
import { TimeField } from "../components/TimeField";
import { formatClock, formatDayLabel, minusWorkingDays } from "../lib/time";

const CORRECTION_BADGE: Record<string, string> = {
  pending: "bg-warn-soft text-warn",
  approved: "bg-ok-soft text-ok",
  rejected: "bg-bad-soft text-bad",
};

const CORRECTION_WORKING_DAYS = 7; // the backend rule: weekends are not counted

export function AttendancePage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState<string | null>(null); // null = the current month
  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionIn, setCorrectionIn] = useState("");
  const [correctionOut, setCorrectionOut] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [formVersion, setFormVersion] = useState(0); // a new number rebuilds the time pickers, so they show empty again after a request is sent

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
  const correctionMutation = useMutation({
    mutationFn: () =>
      askCorrection(token, {
        work_date: correctionDate,
        check_in_time: correctionIn || undefined,
        check_out_time: correctionOut || undefined,
        reason: correctionReason.trim(),
      }),
    onSuccess: () => {
      toast.success("Correction request sent");
      setCorrectionDate("");
      setCorrectionIn("");
      setCorrectionOut("");
      setCorrectionReason("");
      setFormVersion((version) => version + 1);
    },
    onSettled: refreshAll,
  });

  // Saturday and Sunday are week offs: there is nothing to correct on them (the backend refuses them too).
  const isWeekOff = correctionDate !== "" && [0, 6].includes(new Date(`${correctionDate}T00:00:00Z`).getUTCDay());

  function submitCorrection(event: FormEvent) {
    event.preventDefault();
    correctionMutation.mutate();
  }

  return (
    <div className="page">
      <h1 className="page-title">Attendance</h1>

      <TodayCard />

      <section className="card" aria-label="Month">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Month</h2>
          <input
            type="month"
            aria-label="Month"
            value={shownMonth ?? ""}
            max={today?.work_date.slice(0, 7)}
            onChange={(event) => setMonth(event.target.value || null)}
            className="field"
          />
        </div>
        {monthQuery.isError && <ErrorMessage message={describeError(monthQuery.error)} />}
        {monthQuery.isPending && monthQuery.fetchStatus !== "idle" && <Loading fill="inline" label="Loading the month" delayMilliseconds={300} />}
        {monthQuery.data && <MonthTable month={monthQuery.data} />}
      </section>

      <section className="card" aria-label="Missed check-in or check-out">
        <h2 className="section-title mb-1">Missed a check-in or check-out?</h2>
        <p className="mb-3 text-sm text-ink-2">You can ask for a correction for the last 7 working days (weekends are not counted). Times are Indian time (AM or PM).</p>
        <form onSubmit={submitCorrection} className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Date
            <input
              type="date"
              required
              value={correctionDate}
              min={today ? minusWorkingDays(today.work_date, CORRECTION_WORKING_DAYS) : undefined}
              max={today?.work_date}
              onChange={(event) => setCorrectionDate(event.target.value)}
              className="field"
            />
          </label>
          <span />
          <TimeField key={`in-${formVersion}`} label="Check-in time (optional)" value={correctionIn} onChange={setCorrectionIn} />
          <TimeField key={`out-${formVersion}`} label="Check-out time (optional)" value={correctionOut} onChange={setCorrectionOut} />
          <label className="col-span-2 flex flex-col gap-1">
            Reason
            <input
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              className="field"
            />
          </label>
          <div className="col-span-2">
            <button
              type="submit"
              disabled={correctionMutation.isPending || isWeekOff || (!correctionIn && !correctionOut)}
              className="btn btn-primary"
            >
              {correctionMutation.isPending ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
        {isWeekOff && <ErrorMessage message="Saturday and Sunday are week offs. Please choose a working day." />}
        {correctionMutation.isError && <ErrorMessage message={describeError(correctionMutation.error)} />}
        {correctionMutation.isSuccess && (
          <p className="mt-2 text-sm text-ok">
            {correctionMutation.data.status === "approved" ? "Approved automatically." : "Request sent. It is waiting for approval."}
          </p>
        )}
      </section>

      <section className="card" aria-label="My correction requests">
        <h2 className="section-title mb-2">My correction requests</h2>
        {correctionsQuery.isError && <ErrorMessage message={describeError(correctionsQuery.error)} />}
        {correctionsQuery.isPending && <Loading fill="inline" label="Loading requests" delayMilliseconds={300} />}
        {correctionsQuery.data?.length === 0 && <p className="text-sm text-ink-3">No requests yet.</p>}
        <ul className="space-y-2 text-sm">
          {correctionsQuery.data?.map((correction) => (
            <li key={correction.id} className="border-t border-line pt-2">
              <p className="flex items-center justify-between">
                <span className="font-medium">{formatDayLabel(correction.work_date)}</span>
                <span className={`rounded px-2 text-xs capitalize ${CORRECTION_BADGE[correction.status] ?? "bg-surface-2 text-ink-2"}`}>{correction.status}</span>
              </p>
              <p className="text-ink-2">
                {correction.requested_check_in && `Check-in ${formatClock(correction.requested_check_in)}`}
                {correction.requested_check_in && correction.requested_check_out && " | "}
                {correction.requested_check_out && `Check-out ${formatClock(correction.requested_check_out)}`}
              </p>
              <p className="text-ink-3">Reason: {correction.reason}</p>
              {correction.decision_note && <p className="text-ink-3">Remark: {correction.decision_note}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

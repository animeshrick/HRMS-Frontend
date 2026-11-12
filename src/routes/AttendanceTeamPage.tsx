import { useState } from "react";
import { useToast } from "../components/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceCorrection } from "../api/types";
import { decideCorrection, getCorrectionInbox, getPersonMonth, getTeamDay } from "../api/attendance";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { DayMarks, MonthTable, statusText } from "../components/MonthTable";
import { describeError } from "../lib/errors";
import { formatClock, formatDayLabel, formatMinutes } from "../lib/time";

export function AttendanceTeamPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();
  const [day, setDay] = useState<string | null>(null); // null = today
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null); // the request whose rejection comment is being written
  const [rejectNote, setRejectNote] = useState("");

  const teamQuery = useQuery({ queryKey: ["attendance-team", employeeId, day], queryFn: () => getTeamDay(token, day) });
  const shownDay = teamQuery.data?.date ?? day ?? "";
  const inboxQuery = useQuery({ queryKey: ["attendance-inbox", employeeId], queryFn: () => getCorrectionInbox(token) });
  const personQuery = useQuery({
    queryKey: ["attendance-person", employeeId, openPerson, shownDay.slice(0, 7)],
    queryFn: () => getPersonMonth(token, openPerson!, shownDay.slice(0, 7)),
    enabled: openPerson !== null && shownDay !== "",
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { id: number; decision: "approved" | "rejected"; note?: string }) => decideCorrection(token, input.id, input.decision, input.note),
    onSuccess: (_decided, input) => {
      toast.success(input.decision === "approved" ? "Correction approved" : "Correction rejected");
      // Take the decided request off the list at once, without waiting for the list to load again.
      queryClient.setQueryData<AttendanceCorrection[]>(["attendance-inbox", employeeId], (waiting) => waiting?.filter((correction) => correction.id !== input.id));
      setRejectingId(null);
      setRejectNote("");
    },
    // Refresh even after an error: someone else may have decided it first.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance-inbox", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-team", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-person", employeeId] });
    },
  });

  const summary = teamQuery.data?.summary;
  return (
    <div className="page page-wide">
      <h1 className="page-title">Team attendance</h1>

      <section className="card" aria-label="Correction requests">
        <h2 className="section-title mb-2">Waiting correction requests</h2>
        {inboxQuery.isError && <ErrorMessage message={describeError(inboxQuery.error)} />}
        {decisionMutation.isError && <ErrorMessage message={describeError(decisionMutation.error)} />}
        {inboxQuery.isPending && <Loading fill="inline" label="Loading requests" delayMilliseconds={300} />}
        {inboxQuery.data?.length === 0 && <p className="text-sm text-ink-3">Nothing is waiting for you.</p>}
        <ul className="divide-y divide-line text-sm">
          {inboxQuery.data?.map((correction) => (
            <li key={correction.id} className="py-2">
              <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {correction.full_name} ({correction.emp_id}) | {formatDayLabel(correction.work_date)}
                </p>
                <p className="text-ink-2">
                  Now: In {formatClock(correction.current_check_in_at) || "-"}, Out {formatClock(correction.current_check_out_at) || "-"} | Asks:
                  {correction.requested_check_in ? ` In ${formatClock(correction.requested_check_in)}` : ""}
                  {correction.requested_check_in && correction.requested_check_out ? "," : ""}
                  {correction.requested_check_out ? ` Out ${formatClock(correction.requested_check_out)}` : ""}
                </p>
                <p className="truncate text-ink-3" title={correction.reason}>
                  Reason: {correction.reason}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ id: correction.id, decision: "approved" })}
                  className="btn btn-sm btn-ok"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decisionMutation.isPending}
                  onClick={() => {
                    setRejectingId(correction.id);
                    setRejectNote("");
                  }}
                  className="btn btn-sm btn-bad"
                >
                  Reject
                </button>
              </div>
              </div>
              {rejectingId === correction.id && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="Reason for rejecting"
                    placeholder="Why are you rejecting this? The employee will see it."
                    value={rejectNote}
                    maxLength={300}
                    onChange={(event) => setRejectNote(event.target.value)}
                    className="field min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    disabled={decisionMutation.isPending || rejectNote.trim() === ""}
                    onClick={() => decisionMutation.mutate({ id: correction.id, decision: "rejected", note: rejectNote.trim() })}
                    className="btn btn-sm btn-bad"
                  >
                    {decisionMutation.isPending ? "Rejecting..." : "Confirm rejection"}
                  </button>
                  <button type="button" onClick={() => setRejectingId(null)} className="btn btn-sm btn-quiet">
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Day">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Day</h2>
          <input
            type="date"
            aria-label="Day"
            value={shownDay}
            onChange={(event) => setDay(event.target.value || null)}
            className="field"
          />
        </div>
        {teamQuery.isError && <ErrorMessage message={describeError(teamQuery.error)} />}
        {teamQuery.isPending && <Loading fill="inline" label="Loading the team" delayMilliseconds={300} />}
        {summary && (
          <p className="mb-2 text-sm text-ink-2">
            Present {summary.present}, half day {summary.half_day}, absent {summary.absent}, on leave {summary.on_leave}, late {summary.late_days}.
          </p>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 pr-3">Name</th>
              <th className="pr-3">Status</th>
              <th className="pr-3">In</th>
              <th className="pr-3">Out</th>
              <th>Worked</th>
            </tr>
          </thead>
          <tbody>
            {teamQuery.data?.people.map((person) => (
              <tr key={person.emp_id} className="border-t border-line">
                <td className="py-1 pr-3">
                  <button type="button" className="text-brand-text hover:underline" onClick={() => setOpenPerson(openPerson === person.emp_id ? null : person.emp_id)}>
                    {person.full_name}
                  </button>
                  <span className="ml-1 text-xs text-ink-3">{person.emp_id}</span>
                </td>
                <td className="pr-3">
                  {statusText(person.status)}
                  <DayMarks day={person} />
                  {person.note && <span className="ml-1 text-xs text-ink-3">({person.note})</span>}
                </td>
                <td className="pr-3">{formatClock(person.check_in_at)}</td>
                <td className="pr-3">{formatClock(person.check_out_at)}</td>
                <td>{formatMinutes(person.worked_minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {openPerson && (
        <section className="card" aria-label="Person month">
          {personQuery.isPending && personQuery.fetchStatus !== "idle" && <Loading fill="inline" label="Loading the month" delayMilliseconds={300} />}
          {personQuery.isError && <ErrorMessage message={describeError(personQuery.error)} />}
          {personQuery.data && (
            <>
              <h2 className="section-title mb-2">
                {personQuery.data.full_name} ({personQuery.data.emp_id}), {personQuery.data.month}
              </h2>
              <MonthTable month={personQuery.data} />
            </>
          )}
        </section>
      )}
    </div>
  );
}

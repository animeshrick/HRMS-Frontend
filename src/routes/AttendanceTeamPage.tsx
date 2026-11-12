import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decideCorrection, getCorrectionInbox, getPersonMonth, getTeamDay } from "../api/attendance";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { DayMarks, MonthTable, statusText } from "../components/MonthTable";
import { describeError } from "../lib/errors";
import { formatClock, formatMinutes } from "../lib/time";

export function AttendanceTeamPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const [day, setDay] = useState<string | null>(null); // null = today
  const [openPerson, setOpenPerson] = useState<string | null>(null);

  const teamQuery = useQuery({ queryKey: ["attendance-team", employeeId, day], queryFn: () => getTeamDay(token, day) });
  const shownDay = teamQuery.data?.date ?? day ?? "";
  const inboxQuery = useQuery({ queryKey: ["attendance-inbox", employeeId], queryFn: () => getCorrectionInbox(token) });
  const personQuery = useQuery({
    queryKey: ["attendance-person", employeeId, openPerson, shownDay.slice(0, 7)],
    queryFn: () => getPersonMonth(token, openPerson!, shownDay.slice(0, 7)),
    enabled: openPerson !== null && shownDay !== "",
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { id: number; decision: "approved" | "rejected" }) => decideCorrection(token, input.id, input.decision),
    // Refresh even after an error: someone else may have decided it first.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendance-inbox", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-team", employeeId] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-person", employeeId] });
    },
  });

  const summary = teamQuery.data?.summary;
  return (
    <div className="mx-auto max-w-4xl space-y-6 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold">Team attendance</h1>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="Correction requests">
        <h2 className="mb-2 font-medium">Waiting correction requests</h2>
        {inboxQuery.isError && <ErrorMessage message={describeError(inboxQuery.error)} />}
        {decisionMutation.isError && <ErrorMessage message={describeError(decisionMutation.error)} />}
        {inboxQuery.data?.length === 0 && <p className="text-sm text-slate-500">Nothing is waiting for you.</p>}
        <ul className="space-y-3 text-sm">
          {inboxQuery.data?.map((correction) => (
            <li key={correction.id} className="border-t border-slate-100 pt-2">
              <p className="font-medium">
                {correction.full_name} ({correction.emp_id}) - {correction.work_date}
              </p>
              <p>
                Now: in {formatClock(correction.current_check_in_at) || "none"}, out {formatClock(correction.current_check_out_at) || "none"}. Asks:
                {correction.requested_check_in && ` in ${correction.requested_check_in}`}
                {correction.requested_check_out && ` out ${correction.requested_check_out}`}
              </p>
              <p className="text-slate-500">Reason: {correction.reason}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ id: correction.id, decision: "approved" })}
                  className="rounded-md bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-500 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={decisionMutation.isPending}
                  onClick={() => decisionMutation.mutate({ id: correction.id, decision: "rejected" })}
                  className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white p-4 shadow" aria-label="Day">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Day</h2>
          <input
            type="date"
            aria-label="Day"
            value={shownDay}
            onChange={(event) => setDay(event.target.value || null)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        {teamQuery.isError && <ErrorMessage message={describeError(teamQuery.error)} />}
        {summary && (
          <p className="mb-2 text-sm text-slate-700">
            Present {summary.present}, half day {summary.half_day}, absent {summary.absent}, on leave {summary.on_leave}, late {summary.late_days}.
          </p>
        )}
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
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
              <tr key={person.emp_id} className="border-t border-slate-100">
                <td className="py-1 pr-3">
                  <button type="button" className="text-indigo-700 hover:underline" onClick={() => setOpenPerson(openPerson === person.emp_id ? null : person.emp_id)}>
                    {person.full_name}
                  </button>
                  <span className="ml-1 text-xs text-slate-500">{person.emp_id}</span>
                </td>
                <td className="pr-3">
                  {statusText(person.status)}
                  <DayMarks day={person} />
                  {person.note && <span className="ml-1 text-xs text-slate-500">({person.note})</span>}
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
        <section className="rounded-lg bg-white p-4 shadow" aria-label="Person month">
          {personQuery.isError && <ErrorMessage message={describeError(personQuery.error)} />}
          {personQuery.data && (
            <>
              <h2 className="mb-2 font-medium">
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

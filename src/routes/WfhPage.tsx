// Work From Home: its own page, separate from Leave (see LeavePage.tsx), because WFH is not time
// away from work - the employee is still working, just not from the office. Reuses the same leave
// API and backend rows (leave_type "wfh"), filtered down to just this type.
import { useState, type FormEvent } from "react";
import { useToast } from "../components/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeave, cancelLeave, getBalances, getMyLeaves } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { Loading, SkeletonRows } from "../components/Loading";
import { describeError } from "../lib/errors";
import { decisionSummary } from "../lib/decisions";
import { canCancelLeave } from "../lib/leave";

const WFH_TYPE = "wfh";

export function WfhPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();

  const balancesQuery = useQuery({ queryKey: ["balances", employeeId], queryFn: () => getBalances(token) });
  const leavesQuery = useQuery({ queryKey: ["my-leaves", employeeId], queryFn: () => getMyLeaves(token) });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayType, setDayType] = useState<"full" | "half">("full");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const balance = (balancesQuery.data ?? []).find((item) => item.type_code === WFH_TYPE);
  const myRequests = (leavesQuery.data ?? []).filter((leave) => leave.leave_type === WFH_TYPE);

  function refreshWfhData() {
    void queryClient.invalidateQueries({ queryKey: ["balances", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["my-leaves", employeeId] });
  }

  const applyMutation = useMutation({
    mutationFn: () =>
      applyLeave(token, {
        leave_type: WFH_TYPE,
        start_date: startDate,
        end_date: dayType === "half" ? startDate : endDate || startDate,
        day_type: dayType,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      setSuccessMessage(result.message);
      setStartDate("");
      setEndDate("");
      setReason("");
      refreshWfhData();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (leaveId: number) => cancelLeave(token, leaveId),
    onSuccess: () => {
      toast.success("Request cancelled");
      refreshWfhData();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccessMessage(null);
    if (!startDate) {
      setFormError("Choose the start date.");
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError("The end date is before the start date.");
      return;
    }
    setFormError(null);
    applyMutation.mutate();
  }

  return (
    <div className="page">
      <h1 className="page-title">Work from home</h1>

      <section aria-label="WFH balance" className="card">
        {balancesQuery.isError && <ErrorMessage message={describeError(balancesQuery.error)} />}
        {balancesQuery.isPending && <Loading fill="inline" label="Loading your WFH balance" delayMilliseconds={300} />}
        {balance && (
          <>
            <p className="text-sm font-medium text-ink-2">{balance.type_name}</p>
            <p className="mt-1 text-sm text-ink-2">No yearly limit. Every request is approved by the super admin only.</p>
          </>
        )}
      </section>

      <form onSubmit={handleSubmit} noValidate className="card space-y-3">
        <h2 className="section-title">Mark a day as working from home</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <FormField
            label="End date (optional)"
            type="date"
            value={dayType === "half" ? startDate : endDate}
            disabled={dayType === "half"}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
        <fieldset className="flex gap-4 text-sm">
          <legend className="sr-only">Day type</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="wfh-day-type" checked={dayType === "full"} onChange={() => setDayType("full")} /> Full day
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="wfh-day-type" checked={dayType === "half"} onChange={() => setDayType("half")} /> Half day
          </label>
        </fieldset>
        <FormField label="Reason (optional)" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <ErrorMessage message={formError ?? (applyMutation.isError ? describeError(applyMutation.error) : null)} />
        {successMessage && (
          <p role="status" className="notice border-ok/30 bg-ok-soft text-ok">
            {successMessage}
          </p>
        )}
        <button type="submit" disabled={applyMutation.isPending} className="btn btn-primary">
          {applyMutation.isPending ? "Sending..." : "Submit"}
        </button>
      </form>

      <section aria-label="My WFH requests" className="card">
        <h2 className="section-title mb-2">My requests</h2>
        {leavesQuery.isError && <ErrorMessage message={describeError(leavesQuery.error)} />}
        {cancelMutation.isError && <ErrorMessage message={describeError(cancelMutation.error)} />}
        {leavesQuery.isPending && <SkeletonRows rows={3} />}
        {leavesQuery.data && myRequests.length === 0 && <p className="text-sm text-ink-3">No WFH requests yet.</p>}
        <ul className="divide-y divide-line">
          {myRequests.map((leave) => (
            <li key={leave.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block">
                  #{leave.id} {leave.description}
                </span>
                {decisionSummary(leave) && <span className="block text-xs text-ink-3">{decisionSummary(leave)}</span>}
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs capitalize">{leave.status}</span>
                {canCancelLeave(leave) && (
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(leave.id)}
                    className="text-xs text-bad underline disabled:opacity-60"
                  >
                    {cancelMutation.isPending && cancelMutation.variables === leave.id ? "Cancelling..." : "Cancel"}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

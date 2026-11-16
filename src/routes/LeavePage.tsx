import { useState, type FormEvent } from "react";
import { useToast } from "../components/Toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeave, cancelLeave, getBalances, getMyLeaves, uploadDocument } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { Loading, SkeletonRows } from "../components/Loading";
import { describeError } from "../lib/errors";
import { decisionSummary } from "../lib/decisions";
import { canCancelLeave } from "../lib/leave";
import { validateDocument } from "../lib/validation";

// Work From Home has its own page (see WfhPage.tsx): it isn't really "leave", so it is left out
// of this page's balances, the type dropdown, and the requests list below.
const EXCLUDED_FROM_LEAVE_PAGE = "wfh";

// A rough, calendar-day estimate of the length of the request being filled in, used only to show
// the "a document will be needed" hint before the employee submits. The server (count_leave_days)
// is authoritative and skips weekends/holidays; this estimate only ever needs a document earlier,
// never later, than the server would.
function estimateDays(startDate: string, endDate: string, dayType: "full" | "half"): number {
  if (dayType === "half") {
    return 0.5;
  }
  if (!startDate) {
    return 0;
  }
  const end = endDate || startDate;
  const diff = (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000;
  return Number.isFinite(diff) && diff >= 0 ? diff + 1 : 0;
}

export function LeavePage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const toast = useToast();

  // The employee id is part of the key, so one person's cached data is never shown to another.
  const balancesQuery = useQuery({ queryKey: ["balances", employeeId], queryFn: () => getBalances(token) });
  const leavesQuery = useQuery({ queryKey: ["my-leaves", employeeId], queryFn: () => getMyLeaves(token) });

  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayType, setDayType] = useState<"full" | "half">("full");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const balances = (balancesQuery.data ?? []).filter((balance) => balance.type_code !== EXCLUDED_FROM_LEAVE_PAGE);
  const selectedType = balances.find((balance) => balance.type_code === leaveType);
  const estimatedDays = selectedType ? estimateDays(startDate, endDate, dayType) : 0;
  // Maternity always needs a document (it cannot be applied in the chat); Sick Leave needs one once
  // a single request runs past its threshold (require_document_above_days, e.g. more than 1 day).
  const documentIsRequired = selectedType
    ? !selectedType.can_apply_by_chat ||
      (selectedType.require_document_above_days != null && estimatedDays > selectedType.require_document_above_days)
    : false;

  function refreshLeaveData() {
    void queryClient.invalidateQueries({ queryKey: ["balances", employeeId] });
    void queryClient.invalidateQueries({ queryKey: ["my-leaves", employeeId] });
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      const documentPath = file ? await uploadDocument(token, file) : undefined;
      return applyLeave(token, {
        leave_type: leaveType,
        start_date: startDate,
        end_date: dayType === "half" ? startDate : endDate || startDate,
        day_type: dayType,
        reason: reason.trim() || undefined,
        document_path: documentPath,
      });
    },
    onSuccess: (result) => {
      setSuccessMessage(result.message);
      setStartDate("");
      setEndDate("");
      setReason("");
      setFile(null);
      refreshLeaveData();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (leaveId: number) => cancelLeave(token, leaveId),
    onSuccess: () => {
      toast.success("Leave cancelled");
      refreshLeaveData();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccessMessage(null);
    if (!leaveType) {
      setFormError("Choose a leave type.");
      return;
    }
    if (!startDate) {
      setFormError("Choose the start date.");
      return;
    }
    if (endDate && endDate < startDate) {
      setFormError("The end date is before the start date.");
      return;
    }
    if (documentIsRequired && !file) {
      setFormError(`${selectedType?.type_name} needs a supporting document.`);
      return;
    }
    const documentProblem = file ? validateDocument(file) : null;
    if (documentProblem) {
      setFormError(documentProblem);
      return;
    }
    setFormError(null);
    applyMutation.mutate();
  }

  return (
    <div className="page">
      <h1 className="page-title">My leave</h1>

      <section aria-label="Leave balance" className="grid gap-3 sm:grid-cols-3">
        {balancesQuery.isError && <ErrorMessage message={describeError(balancesQuery.error)} />}
        {balancesQuery.isPending && (
          <div className="sm:col-span-3">
            <Loading fill="inline" label="Loading your leave balance" delayMilliseconds={300} />
          </div>
        )}
        {balances.map((balance) => (
          <div key={balance.type_code} className="card">
            <p className="text-sm font-medium text-ink-2">{balance.type_name}</p>
            {balance.limit_type === "per_year" ? (
              <>
                <p className="mt-1 text-2xl font-semibold">{balance.remaining_days} left</p>
                <p className="text-xs text-ink-3">
                  of {balance.days_allowed} a year. Used {balance.used_days}, waiting {balance.pending_days}.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-2">Up to {balance.days_allowed} days per request. Apply here with a document.</p>
            )}
          </div>
        ))}
      </section>

      <form onSubmit={handleSubmit} noValidate className="card space-y-3">
        <h2 className="section-title">Apply for leave</h2>
        <div>
          <label htmlFor="leave-type" className="block text-sm font-medium text-ink-2">
            Leave type
          </label>
          <select
            id="leave-type"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value)}
            className="field mt-1 block w-full"
          >
            <option value="">Choose...</option>
            {balances.map((balance) => (
              <option key={balance.type_code} value={balance.type_code}>
                {balance.type_name}
              </option>
            ))}
          </select>
        </div>
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
            <input type="radio" name="day-type" checked={dayType === "full"} onChange={() => setDayType("full")} /> Full day
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="day-type" checked={dayType === "half"} onChange={() => setDayType("half")} /> Half day
          </label>
        </fieldset>
        <FormField label="Reason (optional)" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        <div>
          <label htmlFor="leave-document" className="block text-sm font-medium text-ink-2">
            {documentIsRequired ? "Supporting document (required, PDF, PNG or JPG, up to 5 MB)" : "Related document (optional)"}
          </label>
          <input
            id="leave-document"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="file-input mt-1"
          />
        </div>
        <ErrorMessage message={formError ?? (applyMutation.isError ? describeError(applyMutation.error) : null)} />
        {successMessage && (
          <p role="status" className="notice border-ok/30 bg-ok-soft text-ok">
            {successMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={applyMutation.isPending}
          className="btn btn-primary"
        >
          {applyMutation.isPending ? "Sending..." : "Submit"}
        </button>
      </form>

      <section aria-label="My leave requests" className="card">
        <h2 className="section-title mb-2">My requests</h2>
        {leavesQuery.isError && <ErrorMessage message={describeError(leavesQuery.error)} />}
        {cancelMutation.isError && <ErrorMessage message={describeError(cancelMutation.error)} />}
        {leavesQuery.isPending && <SkeletonRows rows={3} />}
        {(() => {
          const myLeaves = (leavesQuery.data ?? []).filter((leave) => leave.leave_type !== EXCLUDED_FROM_LEAVE_PAGE);
          return (
            <>
              {leavesQuery.data && myLeaves.length === 0 && <p className="text-sm text-ink-3">No leave requests yet.</p>}
              <ul className="divide-y divide-line">
                {myLeaves.map((leave) => (
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
            </>
          );
        })()}
      </section>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyLeave, cancelLeave, getBalances, getMyLeaves, uploadDocument } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { SkeletonRows } from "../components/Loading";
import { describeError } from "../lib/errors";
import { companyToday } from "../lib/time";
import { validateDocument } from "../lib/validation";
import type { LeaveRequestRow } from "../api/types";

// Mirrors check_cancellable in the backend (app/hr/leave/service.py): a pending leave,
// or an approved one that has not started yet. Showing a Cancel button the server would
// refuse only teaches people to ignore error messages.
function canCancel(leave: LeaveRequestRow): boolean {
  if (leave.status === "pending") {
    return true;
  }
  if (leave.status !== "approved") {
    return false;
  }
  return leave.start_date >= companyToday();
}

export function LeavePage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();

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

  const balances = balancesQuery.data ?? [];
  const selectedType = balances.find((balance) => balance.type_code === leaveType);
  // Types that cannot be applied in the chat (maternity) always need a document here.
  const documentIsRequired = selectedType ? !selectedType.can_apply_by_chat : false;

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
    onSuccess: refreshLeaveData,
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
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold">My leave</h1>

      <section aria-label="Leave balance" className="grid gap-3 sm:grid-cols-3">
        {balancesQuery.isError && <ErrorMessage message={describeError(balancesQuery.error)} />}
        {balances.map((balance) => (
          <div key={balance.type_code} className="rounded-lg bg-white p-4 shadow">
            <p className="text-sm font-medium text-slate-700">{balance.type_name}</p>
            {balance.limit_type === "per_year" ? (
              <>
                <p className="mt-1 text-2xl font-semibold">{balance.remaining_days} left</p>
                <p className="text-xs text-slate-500">
                  of {balance.days_allowed} a year. Used {balance.used_days}, waiting {balance.pending_days}.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Up to {balance.days_allowed} days per request. Apply here with a document.</p>
            )}
          </div>
        ))}
      </section>

      <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-lg bg-white p-5 shadow">
        <h2 className="font-medium">Apply for leave</h2>
        <div>
          <label htmlFor="leave-type" className="block text-sm font-medium text-slate-700">
            Leave type
          </label>
          <select
            id="leave-type"
            value={leaveType}
            onChange={(event) => setLeaveType(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
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
          <label htmlFor="leave-document" className="block text-sm font-medium text-slate-700">
            {documentIsRequired ? "Supporting document (required, PDF, PNG or JPG, up to 5 MB)" : "Related document (optional)"}
          </label>
          <input
            id="leave-document"
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <ErrorMessage message={formError ?? (applyMutation.isError ? describeError(applyMutation.error) : null)} />
        {successMessage && (
          <p role="status" className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {successMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={applyMutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {applyMutation.isPending ? "Sending..." : "Submit"}
        </button>
      </form>

      <section aria-label="My leave requests" className="rounded-lg bg-white p-5 shadow">
        <h2 className="mb-2 font-medium">My requests</h2>
        {leavesQuery.isError && <ErrorMessage message={describeError(leavesQuery.error)} />}
        {cancelMutation.isError && <ErrorMessage message={describeError(cancelMutation.error)} />}
        {leavesQuery.isPending && <SkeletonRows rows={3} />}
        {leavesQuery.data?.length === 0 && <p className="text-sm text-slate-500">No leave requests yet.</p>}
        <ul className="divide-y divide-slate-100">
          {leavesQuery.data?.map((leave) => (
            <li key={leave.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                #{leave.id} {leave.description}
              </span>
              <span className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{leave.status}</span>
                {canCancel(leave) && (
                  <button
                    type="button"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(leave.id)}
                    className="text-xs text-red-600 underline disabled:opacity-60"
                  >
                    Cancel
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

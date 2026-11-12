import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { decideLeave, getApprovals, getDocumentUrl } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { SkeletonRows } from "../components/Loading";
import { describeError } from "../lib/errors";

export function ApprovalsPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const queryClient = useQueryClient();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [rejectingLeaveId, setRejectingLeaveId] = useState<number | null>(null); // the request whose reason is being written
  const [rejectReason, setRejectReason] = useState("");

  const approvalsQuery = useQuery({ queryKey: ["approvals", employeeId], queryFn: () => getApprovals(token) });

  const decisionMutation = useMutation({
    mutationFn: (input: { leaveId: number; decision: "approved" | "rejected"; note?: string }) =>
      decideLeave(token, input.leaveId, input.decision, input.note),
    onSuccess: () => {
      setRejectingLeaveId(null);
      setRejectReason("");
    },
    // Refresh even after an error: someone else may have decided the request first.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["approvals", employeeId] }),
  });

  function confirmRejection(leaveId: number) {
    const reason = rejectReason.trim();
    if (reason) {
      decisionMutation.mutate({ leaveId, decision: "rejected", note: reason });
    }
  }

  async function openDocument(leaveId: number) {
    setDocumentError(null);
    try {
      const result = await getDocumentUrl(token, leaveId);
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      setDocumentError(describeError(error));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 overflow-y-auto px-4 py-6">
      <h1 className="text-xl font-semibold">Leave approvals</h1>
      <p className="text-sm text-slate-600">
        {session!.role === "hr" ? "All pending requests." : "Pending requests that you can approve or reject."}
      </p>
      {approvalsQuery.isError && <ErrorMessage message={describeError(approvalsQuery.error)} />}
      {decisionMutation.isError && <ErrorMessage message={describeError(decisionMutation.error)} />}
      <ErrorMessage message={documentError} />
      {approvalsQuery.isPending && (
        <div className="rounded-lg bg-white p-4 shadow">
          <SkeletonRows rows={3} />
        </div>
      )}
      {approvalsQuery.data?.length === 0 && <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow">Nothing is waiting for you.</p>}
      <ul className="space-y-3">
        {approvalsQuery.data?.map((approval) => (
          <li key={approval.id} className="rounded-lg bg-white p-4 shadow">
            <p className="font-medium">
              {approval.full_name} ({approval.emp_id})
            </p>
            <p className="text-sm text-slate-700">{approval.description}</p>
            {approval.reason && <p className="text-sm text-slate-500">Reason: {approval.reason}</p>}
            {rejectingLeaveId === approval.id && (
              <div className="mt-3 space-y-2">
                <label htmlFor={`reject-reason-${approval.id}`} className="block text-sm font-medium text-slate-700">
                  Why are you rejecting this leave? The employee will see this.
                </label>
                <textarea
                  id={`reject-reason-${approval.id}`}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2 text-sm">
                  <button
                    type="button"
                    disabled={decisionMutation.isPending || rejectReason.trim() === ""}
                    onClick={() => confirmRejection(approval.id)}
                    className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-60"
                  >
                    {decisionMutation.isPending ? "Rejecting..." : "Confirm rejection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingLeaveId(null)}
                    className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                disabled={decisionMutation.isPending}
                onClick={() => decisionMutation.mutate({ leaveId: approval.id, decision: "approved" })}
                className="rounded-md bg-green-600 px-3 py-1 font-medium text-white hover:bg-green-500 disabled:opacity-60"
              >
                {decisionMutation.isPending && decisionMutation.variables?.leaveId === approval.id && decisionMutation.variables?.decision === "approved"
                  ? "Approving..."
                  : "Approve"}
              </button>
              <button
                type="button"
                disabled={decisionMutation.isPending}
                onClick={() => {
                  setRejectingLeaveId(approval.id);
                  setRejectReason("");
                }}
                className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-500 disabled:opacity-60"
              >
                Reject
              </button>
              {approval.has_document && (
                <button type="button" onClick={() => void openDocument(approval.id)} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100">
                  View document
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

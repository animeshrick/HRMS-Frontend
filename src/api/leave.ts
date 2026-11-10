import { apiRequest } from "./client";
import type { Approval, LeaveApplyRequest, LeaveBalance, LeaveRequestRow, MessageResponse } from "./types";

export const getBalances = (token: string) => apiRequest<LeaveBalance[]>("/leave/balances", { token });

export const getMyLeaves = (token: string) => apiRequest<LeaveRequestRow[]>("/leave/mine", { token });

export const applyLeave = (token: string, request: LeaveApplyRequest) =>
  apiRequest<{ leave_id: number; message: string; approver: string }>("/leave/apply", { method: "POST", body: request, token });

export const cancelLeave = (token: string, leaveId: number) =>
  apiRequest<MessageResponse>(`/leave/${leaveId}/cancel`, { method: "POST", token });

export const getApprovals = (token: string) => apiRequest<Approval[]>("/leave/approvals", { token });

export const decideLeave = (token: string, leaveId: number, decision: "approved" | "rejected", note?: string) =>
  apiRequest<{ leave_id: number; status: string }>(`/leave/${leaveId}/decision`, { method: "POST", body: { decision, note }, token });

export const getDocumentUrl = (token: string, leaveId: number) =>
  apiRequest<{ url: string }>(`/leave/${leaveId}/document-url`, { token });

/** Sends the file itself as the request body. Returns the stored path, which is then given to applyLeave or attachDocument. */
export async function uploadDocument(token: string, file: File): Promise<string> {
  const result = await apiRequest<{ document_path: string }>(`/leave/documents?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    token,
    rawBody: file,
    contentType: file.type,
    timeoutMilliseconds: 60_000,
  });
  return result.document_path;
}

export const attachDocument = (token: string, actionId: number, documentPath: string) =>
  apiRequest<MessageResponse>(`/pending-actions/${actionId}/document`, { method: "POST", body: { document_path: documentPath }, token });

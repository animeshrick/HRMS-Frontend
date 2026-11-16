import { apiRequest } from "./client";
import type {
  MessageResponse,
  MyDocumentRequest,
  PendingDocumentRequest,
  SharedDocumentDetail,
  SharedDocumentRow,
} from "./types";

export const getDocuments = (token: string) => apiRequest<SharedDocumentRow[]>("/documents", { token });

export const getDocumentDetail = (token: string, documentId: number) =>
  apiRequest<SharedDocumentDetail>(`/documents/${documentId}`, { token });

export const getRequestsInbox = (token: string) => apiRequest<PendingDocumentRequest[]>("/documents/requests/inbox", { token });

export const getMyRequests = (token: string) => apiRequest<MyDocumentRequest[]>("/documents/requests/mine", { token });

export const requestDocumentAccess = (token: string, documentId: number) =>
  apiRequest<MessageResponse>(`/documents/${documentId}/request`, { method: "POST", token });

export const decideDocumentRequest = (token: string, requestId: number, decision: "approved" | "denied") =>
  apiRequest<{ id: number; status: string; expires_at: string | null }>(`/documents/requests/${requestId}/decision`, {
    method: "POST",
    body: { decision },
    token,
  });

export const getDocumentDownloadUrl = (token: string, documentId: number) =>
  apiRequest<{ url: string; valid_for_seconds: number }>(`/documents/${documentId}/download-url`, { token });

export const deleteDocument = (token: string, documentId: number) =>
  apiRequest<MessageResponse>(`/documents/${documentId}`, { method: "DELETE", token });

/** Sends the file itself as the request body. Returns the new document's id and name. */
export async function uploadDocument(token: string, file: File): Promise<{ id: number; original_filename: string; message: string }> {
  return apiRequest<{ id: number; original_filename: string; message: string }>(`/documents?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    token,
    rawBody: file,
    contentType: file.type,
    timeoutMilliseconds: 60_000,
  });
}

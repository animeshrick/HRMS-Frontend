import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideDocumentRequest,
  deleteDocument,
  getDocumentDetail,
  getDocumentDownloadUrl,
  getDocuments,
  getMyRequests,
  getRequestsInbox,
  requestDocumentAccess,
  uploadDocument,
} from "../api/documents";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading, SkeletonRows } from "../components/Loading";
import { useToast } from "../components/Toast";
import { describeError } from "../lib/errors";
import { formatShortTime } from "../lib/time";
import { validateSharedDocument } from "../lib/validation";
import type { SharedDocumentRow } from "../api/types";

function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AccessBadge({ document }: { document: SharedDocumentRow }) {
  const access = document.my_access;
  if (access.state === "owner") {
    return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Yours</span>;
  }
  if (access.state === "pending") {
    return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Requested</span>;
  }
  if (access.state === "approved") {
    return <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">Access until {formatShortTime(access.expires_at)}</span>;
  }
  if (access.state === "denied") {
    return <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">Denied</span>;
  }
  return null;
}

function DocumentDetailPanel({ documentId, onClose }: { documentId: number; onClose: () => void }) {
  const { session } = useAuth();
  const token = session!.accessToken;
  const toast = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({ queryKey: ["document-detail", documentId], queryFn: () => getDocumentDetail(token, documentId) });

  function refreshEverything() {
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    void queryClient.invalidateQueries({ queryKey: ["document-detail", documentId] });
    void queryClient.invalidateQueries({ queryKey: ["documents-inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["my-document-requests"] });
  }

  const requestMutation = useMutation({
    mutationFn: () => requestDocumentAccess(token, documentId),
    onSuccess: () => {
      toast.success("Your request was sent to the owner.");
      refreshEverything();
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: number; decision: "approved" | "denied" }) =>
      decideDocumentRequest(token, requestId, decision),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "approved" ? "Access approved." : "Request denied.");
      refreshEverything();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => getDocumentDownloadUrl(token, documentId),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(token, documentId),
    onSuccess: () => {
      toast.success("Document deleted.");
      refreshEverything();
      onClose();
    },
  });

  const detail = detailQuery.data;

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="section-title break-all">{detail?.original_filename ?? "Document"}</h2>
        <button type="button" onClick={onClose} className="text-sm text-ink-3 underline">
          Close
        </button>
      </div>

      {detailQuery.isError && <ErrorMessage message={describeError(detailQuery.error)} />}
      {detailQuery.isPending && <SkeletonRows rows={2} />}

      {detail && (
        <>
          <p className="text-sm text-ink-3">
            Owner: {detail.owner?.full_name} ({detail.owner?.emp_id}) · {formatSize(detail.size_bytes)} · uploaded {formatShortTime(detail.created_at)}
          </p>

          {requestMutation.isError && <ErrorMessage message={describeError(requestMutation.error)} />}
          {decisionMutation.isError && <ErrorMessage message={describeError(decisionMutation.error)} />}
          {downloadMutation.isError && <ErrorMessage message={describeError(downloadMutation.error)} />}
          {deleteMutation.isError && <ErrorMessage message={describeError(deleteMutation.error)} />}

          <div className="flex flex-wrap items-center gap-2">
            {(detail.is_owner || detail.my_access?.state === "approved") && (
              <button type="button" onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending} className="btn btn-primary">
                {downloadMutation.isPending ? "Opening..." : "Open"}
              </button>
            )}
            {!detail.is_owner && (detail.my_access?.state === "none" || detail.my_access?.state === "denied") && (
              <button type="button" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending} className="btn btn-primary">
                {requestMutation.isPending ? "Sending..." : "Request access"}
              </button>
            )}
            {!detail.is_owner && detail.my_access?.state === "pending" && <p className="text-sm text-ink-3">Waiting for the owner's decision.</p>}
            {detail.is_owner && (
              <button type="button" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="text-sm text-bad underline">
                {deleteMutation.isPending ? "Deleting..." : "Delete document"}
              </button>
            )}
          </div>

          {detail.is_owner && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-ink-2">Who has access, and who has asked</h3>
              {(detail.requests?.length ?? 0) === 0 && <p className="text-sm text-ink-3">Nobody has asked for this document yet.</p>}
              <ul className="divide-y divide-line">
                {detail.requests?.map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      {request.requester?.full_name} ({request.requester?.emp_id})
                    </span>
                    {request.status === "pending" && (
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decisionMutation.mutate({ requestId: request.id, decision: "approved" })}
                          disabled={decisionMutation.isPending}
                          className="rounded-lg bg-ok-soft px-2 py-1 text-xs text-ok"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => decisionMutation.mutate({ requestId: request.id, decision: "denied" })}
                          disabled={decisionMutation.isPending}
                          className="rounded-lg bg-bad-soft px-2 py-1 text-xs text-bad"
                        >
                          Deny
                        </button>
                      </span>
                    )}
                    {request.status === "approved" && request.is_active && (
                      <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">Access until {formatShortTime(request.expires_at!)}</span>
                    )}
                    {request.status === "approved" && !request.is_active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Expired</span>}
                    {request.status === "denied" && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">Denied</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function DocumentsPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const queryClient = useQueryClient();
  const toast = useToast();

  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: () => getDocuments(token) });
  const inboxQuery = useQuery({ queryKey: ["documents-inbox"], queryFn: () => getRequestsInbox(token) });
  const myRequestsQuery = useQuery({ queryKey: ["my-document-requests"], queryFn: () => getMyRequests(token) });

  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  function refreshEverything() {
    void queryClient.invalidateQueries({ queryKey: ["documents"] });
    void queryClient.invalidateQueries({ queryKey: ["documents-inbox"] });
    void queryClient.invalidateQueries({ queryKey: ["my-document-requests"] });
  }

  const uploadMutation = useMutation({
    mutationFn: (fileToUpload: File) => uploadDocument(token, fileToUpload),
    onSuccess: (result) => {
      toast.success(`${result.original_filename} uploaded.`);
      setFile(null);
      refreshEverything();
    },
  });

  const decisionMutation = useMutation({
    mutationFn: ({ requestId, decision }: { requestId: number; decision: "approved" | "denied" }) =>
      decideDocumentRequest(token, requestId, decision),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "approved" ? "Access approved." : "Request denied.");
      refreshEverything();
    },
  });

  function handleUpload() {
    if (!file) {
      setUploadError("Choose a file first.");
      return;
    }
    const problem = validateSharedDocument(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setUploadError(null);
    uploadMutation.mutate(file);
  }

  const inbox = inboxQuery.data ?? [];
  const myRequests = myRequestsQuery.data ?? [];

  return (
    <div className="page">
      <h1 className="page-title">Documents</h1>
      <p className="text-sm text-ink-3">
        Everyone sees every file's name here. Only the owner can open a file, until they approve your request — approved access is view-only and
        lasts 10 days.
      </p>

      <section aria-label="Upload a document" className="card space-y-3">
        <h2 className="section-title">Upload a document</h2>
        <input
          aria-label="Choose a file to upload"
          type="file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUploadError(null);
          }}
          className="file-input"
        />
        <p className="text-xs text-ink-3">PDF, Word, Excel, PowerPoint, PNG or JPG, up to 20 MB.</p>
        <ErrorMessage message={uploadError ?? (uploadMutation.isError ? describeError(uploadMutation.error) : null)} />
        <button type="button" onClick={handleUpload} disabled={uploadMutation.isPending} className="btn btn-primary">
          {uploadMutation.isPending ? "Uploading..." : "Upload"}
        </button>
      </section>

      {inbox.length > 0 && (
        <section aria-label="Requests waiting for you" className="card space-y-2">
          <h2 className="section-title">Requests waiting for you</h2>
          {decisionMutation.isError && <ErrorMessage message={describeError(decisionMutation.error)} />}
          <ul className="divide-y divide-line">
            {inbox.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {request.requester?.full_name} ({request.requester?.emp_id}) wants <span className="font-medium">{request.document.original_filename}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => decisionMutation.mutate({ requestId: request.id, decision: "approved" })}
                    disabled={decisionMutation.isPending}
                    className="rounded-lg bg-ok-soft px-2 py-1 text-xs text-ok"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => decisionMutation.mutate({ requestId: request.id, decision: "denied" })}
                    disabled={decisionMutation.isPending}
                    className="rounded-lg bg-bad-soft px-2 py-1 text-xs text-bad"
                  >
                    Deny
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedDocumentId !== null && <DocumentDetailPanel documentId={selectedDocumentId} onClose={() => setSelectedDocumentId(null)} />}

      <section aria-label="All documents" className="card">
        <h2 className="section-title mb-2">All documents</h2>
        {documentsQuery.isError && <ErrorMessage message={describeError(documentsQuery.error)} />}
        {documentsQuery.isPending && <SkeletonRows rows={4} />}
        {documentsQuery.data?.length === 0 && <p className="text-sm text-ink-3">No documents have been uploaded yet.</p>}
        <ul className="divide-y divide-line">
          {documentsQuery.data?.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="min-w-0 truncate text-left underline">
                {document.original_filename}
              </button>
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden text-xs text-ink-3 sm:inline">{document.owner?.full_name}</span>
                <AccessBadge document={document} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {myRequests.length > 0 && (
        <section aria-label="My requests" className="card">
          <h2 className="section-title mb-2">My requests</h2>
          {myRequestsQuery.isPending && <Loading fill="inline" label="Loading your requests" delayMilliseconds={300} />}
          <ul className="divide-y divide-line">
            {myRequests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{request.document.original_filename}</span>
                {request.status === "pending" && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Waiting</span>}
                {request.status === "approved" && request.is_active && (
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs text-ok">Access until {formatShortTime(request.expires_at!)}</span>
                )}
                {request.status === "approved" && !request.is_active && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">Expired</span>}
                {request.status === "denied" && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs text-bad">Denied</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

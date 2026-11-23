import { apiRequest } from "./client";
import type {
  GovernmentIdImageUploaded,
  GovernmentIdSaved,
  GovernmentIdStatus,
  MessageResponse,
  SubmitGovernmentIdRequest,
  SuperadminGovernmentId,
  SuperadminGovernmentIdRow,
} from "./types";

/** My own government ID. The number comes back masked, never in full. */
export const getMyGovernmentId = (token: string) => apiRequest<GovernmentIdStatus>("/government-id", { token });

/** Sends one side of the ID as the request body. Returns the path to send with the number. */
export const uploadGovernmentIdImage = (token: string, side: "front" | "back", file: File) =>
  apiRequest<GovernmentIdImageUploaded>(`/government-id/images?side=${side}`, {
    method: "POST",
    token,
    rawBody: file,
    contentType: file.type,
  });

export const submitGovernmentId = (token: string, request: SubmitGovernmentIdRequest) =>
  apiRequest<GovernmentIdSaved>("/government-id", { method: "POST", body: request, token });

// ---- the super admin's side. The backend checks the role; hiding the page is only for convenience.
export const getGovernmentIdList = (token: string) =>
  apiRequest<SuperadminGovernmentIdRow[]>("/superadmin/government-ids", { token });

export const readGovernmentIdOf = (token: string, empId: string) =>
  apiRequest<SuperadminGovernmentId>(`/superadmin/government-ids/${encodeURIComponent(empId)}`, { token });

export const getGovernmentIdImageUrl = (token: string, empId: string, side: "front" | "back") =>
  apiRequest<{ url: string; valid_for_seconds: number; content_type: string | null }>(
    `/superadmin/government-ids/${encodeURIComponent(empId)}/image-url?side=${side}`,
    { token },
  );

export const clearGovernmentIdOf = (token: string, empId: string) =>
  apiRequest<MessageResponse & { emp_id: string; full_name: string }>(
    `/superadmin/government-ids/${encodeURIComponent(empId)}`,
    { method: "DELETE", token },
  );

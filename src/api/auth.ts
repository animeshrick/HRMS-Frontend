import { apiRequest } from "./client";
import type { ChangePasswordRequest, LoginRequest, LoginResponse, MessageResponse } from "./types";

export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/login", { method: "POST", body: request });
}

export function changePassword(token: string, request: ChangePasswordRequest): Promise<MessageResponse> {
  return apiRequest<MessageResponse>("/change-password", {
    method: "POST",
    body: request,
    token,
  });
}

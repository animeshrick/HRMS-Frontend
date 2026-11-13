import { apiRequest } from "./client";
import type { CreateEmployeeRequest, CredentialsResponse, EmployeeSummary, RegisterRequest, ResetPasswordRequest } from "./types";

// Both calls are HR only. The backend checks the role, hiding the page is just for convenience.
export function registerEmployee(token: string, request: RegisterRequest): Promise<CredentialsResponse> {
  return apiRequest<CredentialsResponse>("/register", { method: "POST", body: request, token });
}

export function resetEmployeePassword(token: string, request: ResetPasswordRequest): Promise<CredentialsResponse> {
  return apiRequest<CredentialsResponse>("/reset-password", { method: "POST", body: request, token });
}

export function createEmployee(token: string, request: CreateEmployeeRequest): Promise<EmployeeSummary> {
  return apiRequest<EmployeeSummary>("/admin/employees", { method: "POST", body: request, token });
}

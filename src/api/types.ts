// The shapes of the requests and replies of the FastAPI backend (app/main.py).
// Later these can be generated from http://127.0.0.1:8000/openapi.json with the openapi-typescript tool.

export type Role = "employee" | "hr" | "ceo" | "pm";

export interface LoginRequest {
  emp_id: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  must_change_password: boolean;
  role: Role;
  full_name: string;
  emp_id: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
}

export interface ChatSource {
  number: number;
  chunk_id: string;
  doc_id: string;
  title?: string | null;
  section?: string | null;
  version?: string | number | null;
  effective_date?: string | null;
}

export interface PendingAction {
  id: number;
  action_type: "apply_leave" | "cancel_leave";
  summary: string;
  allows_document: boolean; // true: the employee may upload an optional document before replying yes
  expires_at: string;
}

export interface ChatResponse {
  question: string;
  rewritten_question: string;
  answer: string;
  answerable: boolean;
  sources: ChatSource[];
  pending_action: PendingAction | null;
  asked_at?: string | null; // exact time (UTC) the question was saved
  answered_at?: string | null; // exact time (UTC) the answer was saved
}

/** The logged-in employee's own details (GET /me/profile). A value is null when it is not recorded. */
export interface MyProfile {
  emp_id: string;
  full_name: string;
  role: Role;
  dept: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  address: string | null;
  emergency_contact: string | null;
  manager_name: string | null;
  is_active: boolean;
}

/** One saved message from /chat/history (a question or an answer). Only the newest few per employee are kept. */
export interface ChatHistoryMessage {
  id: number;
  sender: "user" | "assistant";
  message: string;
  sources: ChatSource[];
  created_at: string;
}

export interface RegisterRequest {
  emp_id: string;
  role: Role;
}

export interface ResetPasswordRequest {
  emp_id: string;
}

export interface CredentialsResponse {
  emp_id: string;
  full_name: string;
  role: Role;
  temporary_password: string;
}

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveBalance {
  type_code: string;
  type_name: string;
  limit_type: "per_year" | "per_request";
  days_allowed: number;
  used_days: number;
  pending_days: number;
  remaining_days: number | null; // null for per_request types such as maternity
  max_days_per_request: number | null;
  can_apply_by_chat: boolean;
}

export interface LeaveRequestRow {
  id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  day_type: "full" | "half";
  days: number;
  status: LeaveStatus;
  reason: string | null;
  document_path: string | null;
  description: string;
  decided_by_name: string | null; // who approved or rejected it, once decided
  decision_note: string | null;   // the approver's comment (the reason, for a rejection)
}

export interface LeaveApplyRequest {
  leave_type: string;
  start_date: string;
  end_date?: string;
  day_type: "full" | "half";
  reason?: string;
  document_path?: string;
}

export interface Approval {
  id: number;
  emp_id: string;
  full_name: string;
  leave_type: string;
  description: string;
  reason: string | null;
  has_document: boolean;
  requested_at: string;
}

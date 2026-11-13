// The shapes of the requests and replies of the FastAPI backend (app/main.py).
// Later these can be generated from http://127.0.0.1:8000/openapi.json with the openapi-typescript tool.

export type Role = "employee" | "hr" | "ceo" | "pm" | "superadmin";

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
  attendance_access: AttendanceAccess;
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

export interface CreateEmployeeRequest {
  emp_id: string;
  full_name: string;
  email: string;
  dept?: string | null;
  phone?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;   // "YYYY-MM-DD"
  date_of_joining?: string | null; // "YYYY-MM-DD"
  salary?: number | null;
  is_confidential?: boolean;
}

export interface EmployeeSummary {
  emp_id: string;
  full_name: string;
  email: string;
  dept: string | null;
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

// ---- attendance. Times are UTC text; show them with formatClock (India time).
export type AttendanceAccess = "superadmin" | "hr" | "pm" | "employee" | "none";

export interface AttendanceToday {
  work_date: string;
  day_note: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: string;
  is_late: boolean;
  is_early_leave: boolean;
  worked_minutes: number | null;
  can_check_in: boolean;
  can_check_out: boolean;
  office_start: string;
  office_end: string;
  late_after: string;
  network_check_enabled: boolean;
}

export interface AttendanceDay {
  date: string;
  weekday: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  worked_minutes: number | null;
  is_late: boolean;
  is_early_leave: boolean;
  note: string | null;
}

export interface AttendanceSummary {
  present: number;
  half_day: number;
  absent: number;
  incomplete: number;
  on_leave: number;
  holiday: number;
  weekend: number;
  checked_in: number;
  not_checked_in: number;
  late_days: number;
  early_leave_days: number;
  worked_minutes: number;
}

export interface AttendanceMonth {
  emp_id: string;
  full_name: string;
  month: string;
  days: AttendanceDay[];
  summary: AttendanceSummary;
}

export interface AttendancePersonDay extends AttendanceDay {
  emp_id: string;
  full_name: string;
  dept: string | null;
}

export interface AttendanceTeam {
  date: string;
  people: AttendancePersonDay[];
  summary: AttendanceSummary;
}

export interface AttendanceCorrection {
  id: number;
  employee_id: number;
  emp_id: string | null;
  full_name: string | null;
  dept: string | null;
  work_date: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  current_check_in_at: string | null;
  current_check_out_at: string | null;
  reason: string;
  status: string;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

export interface AttendanceCorrectionRequest {
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
  reason: string;
}

// ---- super admin
export interface SuperadminEmployee {
  emp_id: string;
  full_name: string;
  dept: string | null;
  role: Role;
  has_attendance: boolean;
}

export interface SuperadminLeaveType {
  code: string;
  name: string;
}

export interface SuperadminLeaveRequest {
  emp_id: string;
  leave_type: string;
  start_date: string;
  end_date?: string;
  day_type: "full" | "half";
  reason?: string;
}

export interface SuperadminAttendanceRequest {
  emp_id: string;
  work_date: string;
  check_in_time?: string;
  check_out_time?: string;
}

export interface SuperadminResult {
  message: string;
}

/** One row of the super admin's audit trail (GET /superadmin/audit-log). */
export interface SuperadminAuditEntry {
  id: number;
  actor_emp_id: string;
  target_emp_id: string;
  action: "leave_applied" | "attendance_set";
  details: Record<string, unknown>;
  created_at: string;
}

// ---- attendance admin (office network), HR only
export interface OfficeNetwork {
  id: number;
  label: string;
  cidr: string;
  is_active: boolean;
}

export interface AttendanceAdminSettings {
  network_check_enabled: boolean;
  office_networks: OfficeNetwork[];
}

export interface AddOfficeNetworkRequest {
  label: string;
  cidr: string;
}

export interface NetworkCheckRequest {
  enabled: boolean;
}

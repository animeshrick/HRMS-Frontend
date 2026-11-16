import { apiRequest } from "./client";
import type {
  LeaveBalance,
  SuperadminAttendanceRequest,
  SuperadminAuditEntry,
  SuperadminEmployee,
  SuperadminLeaveRequest,
  SuperadminLeaveType,
  SuperadminResult,
  WhatsAppReportNumber,
  WhatsAppReportSendResult,
} from "./types";

// All of these are for the super admin only. The backend checks the role, hiding the page is just for convenience.
export const getSuperadminEmployees = (token: string) => apiRequest<SuperadminEmployee[]>("/superadmin/employees", { token });

export const getSuperadminLeaveTypes = (token: string) => apiRequest<SuperadminLeaveType[]>("/superadmin/leave-types", { token });

export const getBalancesFor = (token: string, empId: string, onDate: string) =>
  apiRequest<LeaveBalance[]>(`/superadmin/leave-balances/${encodeURIComponent(empId)}?on_date=${onDate}`, { token });

export const applyLeaveFor = (token: string, request: SuperadminLeaveRequest) =>
  apiRequest<SuperadminResult>("/superadmin/leave", { method: "POST", body: request, token });

export const markAttendanceFor = (token: string, request: SuperadminAttendanceRequest) =>
  apiRequest<SuperadminResult>("/superadmin/attendance", { method: "POST", body: request, token });

// Who the super admin acted on, what was done, and when. Newest first.
export const getSuperadminAuditLog = (token: string) => apiRequest<SuperadminAuditEntry[]>("/superadmin/audit-log", { token });

// ---- the twice-daily WhatsApp report (attendance, leave, WFH), sent through AiSensy at 11am and 5pm
export const getWhatsappNumbers = (token: string) => apiRequest<WhatsAppReportNumber[]>("/superadmin/whatsapp-numbers", { token });

export const addWhatsappNumber = (token: string, label: string, phoneNumber: string) =>
  apiRequest<WhatsAppReportNumber>("/superadmin/whatsapp-numbers", { method: "POST", body: { label, phone_number: phoneNumber }, token });

export const removeWhatsappNumber = (token: string, numberId: number) =>
  apiRequest<{ message: string }>(`/superadmin/whatsapp-numbers/${numberId}`, { method: "DELETE", token });

export const sendWhatsappReportNow = (token: string) =>
  apiRequest<WhatsAppReportSendResult[]>("/superadmin/whatsapp-report/send-now", { method: "POST", token });


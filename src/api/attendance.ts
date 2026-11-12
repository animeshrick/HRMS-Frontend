import { apiRequest } from "./client";
import type {
  AttendanceCorrection,
  AttendanceCorrectionRequest,
  AttendanceMonth,
  AttendanceTeam,
  AttendanceToday,
} from "./types";

export const getToday = (token: string) => apiRequest<AttendanceToday>("/attendance/today", { token });

export const checkIn = (token: string) => apiRequest<AttendanceToday>("/attendance/check-in", { method: "POST", token });

export const checkOut = (token: string) => apiRequest<AttendanceToday>("/attendance/check-out", { method: "POST", token });

export const getMyMonth = (token: string, month: string) => apiRequest<AttendanceMonth>(`/attendance/mine?month=${month}`, { token });

// No day means today.
export const getTeamDay = (token: string, day: string | null) =>
  apiRequest<AttendanceTeam>(day ? `/attendance/team?date=${day}` : "/attendance/team", { token });

export const getPersonMonth = (token: string, empId: string, month: string) =>
  apiRequest<AttendanceMonth>(`/attendance/person/${encodeURIComponent(empId)}?month=${month}`, { token });

export const askCorrection = (token: string, request: AttendanceCorrectionRequest) =>
  apiRequest<AttendanceCorrection>("/attendance/corrections", { method: "POST", body: request, token });

export const getMyCorrections = (token: string) => apiRequest<AttendanceCorrection[]>("/attendance/corrections/mine", { token });

export const getCorrectionInbox = (token: string) => apiRequest<AttendanceCorrection[]>("/attendance/corrections/inbox", { token });

export const decideCorrection = (token: string, correctionId: number, decision: "approved" | "rejected", note?: string) =>
  apiRequest<AttendanceCorrection>(`/attendance/corrections/${correctionId}/decision`, { method: "POST", body: { decision, note }, token });

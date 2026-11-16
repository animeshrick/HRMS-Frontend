// Which approved/rejected leaves this person has already seen.
//
// There is no notifications table in the backend, so "seen" is remembered in this
// browser only. That is enough for a red dot: the worst case is that the dot comes
// back on another device, never that a decision is missed.

import type { AttendanceCorrection, LeaveRequestRow, MyDocumentRequest } from "../api/types";

const STORAGE_KEY = "seen-leave-decisions";

export type DecidedLeave = LeaveRequestRow & { status: "approved" | "rejected" };

export function isDecided(leave: LeaveRequestRow): leave is DecidedLeave {
  return leave.status === "approved" || leave.status === "rejected";
}

/** "Approved by Rahul Verma" or "Rejected by Rahul Verma: reason". Empty while the leave is still open. */
export function decisionSummary(leave: LeaveRequestRow): string {
  if (!isDecided(leave)) {
    return "";
  }
  const verb = leave.status === "approved" ? "Approved" : "Rejected";
  const by = leave.decided_by_name ? ` by ${leave.decided_by_name}` : "";
  const note = leave.decision_note?.trim();
  return note ? `${verb}${by}: ${note}` : `${verb}${by}`;
}

/** Each kind of notification has its own ids, so each keeps its own "seen" list. */
export type NotificationKind = "leave" | "correction" | "document-request" | "document-decision";

const STORAGE_KEY_BY_KIND: Record<NotificationKind, string> = {
  leave: STORAGE_KEY,
  correction: "seen-correction-decisions",
  "document-request": "seen-document-requests",
  "document-decision": "seen-document-decisions",
};

function storageKeyFor(employeeId: number | string, kind: NotificationKind): string {
  return `${STORAGE_KEY_BY_KIND[kind]}:${employeeId}`;
}

export type DecidedCorrection = AttendanceCorrection & { status: "approved" | "rejected" };

export function isCorrectionDecided(correction: AttendanceCorrection): correction is DecidedCorrection {
  return correction.status === "approved" || correction.status === "rejected";
}

/** "Approved" or "Rejected: reason" (the remark "Auto" means HR's own request was approved automatically). */
export function correctionSummary(correction: DecidedCorrection): string {
  const verb = correction.status === "approved" ? "Approved" : "Rejected";
  const note = correction.decision_note?.trim();
  return note ? `${verb}: ${note}` : verb;
}

export function readSeenIds(employeeId: number | string, kind: NotificationKind = "leave"): number[] {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(employeeId, kind));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
  } catch {
    return []; // private mode, quota, corrupted value: behave as if nothing was seen
  }
}

export function writeSeenIds(employeeId: number | string, ids: number[], kind: NotificationKind = "leave"): void {
  try {
    window.localStorage.setItem(storageKeyFor(employeeId, kind), JSON.stringify(ids));
  } catch {
    // Storing is a convenience; the app works without it.
  }
}

export type DecidedDocumentRequest = MyDocumentRequest & { status: "approved" | "denied" };

export function isDocumentRequestDecided(request: MyDocumentRequest): request is DecidedDocumentRequest {
  return request.status === "approved" || request.status === "denied";
}

/** "Approved - view-only until 20 Nov 2026" or "Denied". */
export function documentDecisionSummary(request: DecidedDocumentRequest): string {
  if (request.status === "denied") {
    return "Denied";
  }
  return request.is_active ? "Approved - view-only for a limited time" : "Approved, but access has since expired";
}


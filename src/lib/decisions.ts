// Which approved/rejected leaves this person has already seen.
//
// There is no notifications table in the backend, so "seen" is remembered in this
// browser only. That is enough for a red dot: the worst case is that the dot comes
// back on another device, never that a decision is missed.

import type { AttendanceCorrection, LeaveRequestRow } from "../api/types";

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

/** "leave" decisions and "correction" (attendance) decisions have their own ids, so each keeps its own list. */
export type NotificationKind = "leave" | "correction";

function storageKeyFor(employeeId: number | string, kind: NotificationKind): string {
  return kind === "leave" ? `${STORAGE_KEY}:${employeeId}` : `seen-correction-decisions:${employeeId}`;
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

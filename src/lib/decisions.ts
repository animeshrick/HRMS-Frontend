// Which approved/rejected leaves this person has already seen.
//
// There is no notifications table in the backend, so "seen" is remembered in this
// browser only. That is enough for a red dot: the worst case is that the dot comes
// back on another device, never that a decision is missed.

import type { LeaveRequestRow } from "../api/types";

const STORAGE_KEY = "seen-leave-decisions";

export type DecidedLeave = LeaveRequestRow & { status: "approved" | "rejected" };

export function isDecided(leave: LeaveRequestRow): leave is DecidedLeave {
  return leave.status === "approved" || leave.status === "rejected";
}

function storageKeyFor(employeeId: number | string): string {
  return `${STORAGE_KEY}:${employeeId}`;
}

export function readSeenIds(employeeId: number | string): number[] {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(employeeId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
  } catch {
    return []; // private mode, quota, corrupted value: behave as if nothing was seen
  }
}

export function writeSeenIds(employeeId: number | string, ids: number[]): void {
  try {
    window.localStorage.setItem(storageKeyFor(employeeId), JSON.stringify(ids));
  } catch {
    // Storing is a convenience; the app works without it.
  }
}

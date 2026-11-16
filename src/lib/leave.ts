// Shared helpers for leave-like requests (the Leave page and the WFH page both list a type's own
// requests and let the employee cancel one that hasn't happened yet).
import type { LeaveRequestRow } from "../api/types";

// Mirrors check_cancellable in the backend (app/hr/leave/service.py): only a still-pending leave
// can be self-cancelled. Once the super admin has decided it - approved or rejected, started or
// not - the employee can no longer undo it themselves. Showing a Cancel button the server would
// refuse only teaches people to ignore error messages.
export function canCancelLeave(leave: LeaveRequestRow): boolean {
  return leave.status === "pending";
}

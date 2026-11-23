import { apiRequest } from "./client";

// The canonical downtime page keys, matching app/core/downtime.py on the backend.
export type DowntimePageKey =
  | "home"
  | "chat"
  | "documents"
  | "leave_and_wfh"
  | "payslips"
  | "approvals"
  | "attendance"
  | "me"
  | "admin"
  | "superadmin"
  | "messages";

export interface DowntimeStatus {
  down_pages: DowntimePageKey[];
  // A short notice shown at the top of every page. null or missing means there is nothing to show.
  // Set EMERGENCY_BROADCAST in the backend .env; no frontend rebuild is needed to change it.
  emergency_broadcast?: string | null;
}

// Public - no login needed, so this works even on the login page. Set DOWNTIME_PAGES on the
// backend to put one or more pages behind a maintenance screen without a deploy.
export const getDowntimeStatus = () => apiRequest<DowntimeStatus>("/system/downtime");

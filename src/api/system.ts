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
}

// Public - no login needed, so this works even on the login page. Set DOWNTIME_PAGES on the
// backend to put one or more pages behind a maintenance screen without a deploy.
export const getDowntimeStatus = () => apiRequest<DowntimeStatus>("/system/downtime");

import { apiRequest } from "./client";
import type { AddOfficeNetworkRequest, AttendanceAdminSettings, NetworkCheckRequest, OfficeNetwork } from "./types";

// All of these are HR only. The backend checks the role, hiding the page is just for convenience.
export const getAttendanceAdminSettings = (token: string) => apiRequest<AttendanceAdminSettings>("/admin/attendance-settings", { token });

export const setNetworkCheck = (token: string, request: NetworkCheckRequest) =>
  apiRequest<NetworkCheckRequest>("/admin/attendance-settings/network-check", { method: "POST", body: request, token });

export const addOfficeNetwork = (token: string, request: AddOfficeNetworkRequest) =>
  apiRequest<OfficeNetwork>("/admin/office-networks", { method: "POST", body: request, token });

export const setOfficeNetworkActive = (token: string, networkId: number, isActive: boolean) =>
  apiRequest<OfficeNetwork>(`/admin/office-networks/${networkId}/active`, { method: "POST", body: { is_active: isActive }, token });

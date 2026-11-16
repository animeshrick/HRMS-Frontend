import { apiRequest } from "./client";
import type { PayslipMonth, SignedDownload } from "./types";

export const getMyPayslipYears = (token: string) => apiRequest<number[]>("/payroll/payslips/mine/years", { token });

export const getMyPayslipMonths = (token: string, year: number) =>
  apiRequest<PayslipMonth[]>(`/payroll/payslips/mine?year=${year}`, { token });

export const getMyPayslipDownloadUrl = (token: string, month: string) =>
  apiRequest<SignedDownload>(`/payroll/payslips/mine/${month}/download-url`, { token });

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const YEARS_2026 = [2026];
const MONTHS_2026 = [
  { month: "2026-01", label: "January 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-02", label: "February 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-03", label: "March 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-04", label: "April 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-05", label: "May 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-06", label: "June 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-07", label: "July 2026", available: false, disabled_reason: "before_joining" },
  { month: "2026-08", label: "August 2026", available: false, disabled_reason: null },
  { month: "2026-09", label: "September 2026", available: true, disabled_reason: null },
  { month: "2026-10", label: "October 2026", available: true, disabled_reason: null },
  { month: "2026-11", label: "November 2026", available: false, disabled_reason: null },
  { month: "2026-12", label: "December 2026", available: false, disabled_reason: "future" },
];

describe("payslips page", () => {
  it("lists January-December of the newest year, with future and before-joining months disabled", async () => {
    storeSession();
    mockRoutes({ "GET /payroll/payslips/mine/years": { body: YEARS_2026 }, "GET /payroll/payslips/mine?year=2026": { body: MONTHS_2026 } });
    renderWithProviders(<App />, "/payslips");
    expect(await screen.findByText("November")).toBeInTheDocument();
    expect(screen.getByText("October")).toBeInTheDocument();
    expect(screen.getByText("December")).toBeInTheDocument();
    expect(screen.getByText("January")).toBeInTheDocument();
    expect(screen.getAllByText("Not generated yet")).toHaveLength(2);       // August and November: in employment, no payslip yet
    expect(screen.getAllByText("Ready")).toHaveLength(2);                   // September and October
    expect(screen.getByText("Not due yet")).toBeInTheDocument();            // December
    expect(screen.getAllByText("Before you joined")).toHaveLength(7);       // January-July
    expect(screen.getAllByRole("button", { name: "Generate and download" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Not available" })).toHaveLength(8); // Jan-Jul and Dec
    // Only one year is available, so no year switcher is shown.
    expect(screen.queryByRole("group", { name: "Year" })).not.toBeInTheDocument();
  });

  it("lets you switch years", async () => {
    storeSession();
    const decemberMonths = MONTHS_2026.map((entry) => ({ ...entry, month: entry.month.replace("2026", "2025"), label: entry.label.replace("2026", "2025"), disabled_reason: "before_joining" }));
    mockRoutes({
      "GET /payroll/payslips/mine/years": { body: [2026, 2025] },
      "GET /payroll/payslips/mine?year=2026": { body: MONTHS_2026 },
      "GET /payroll/payslips/mine?year=2025": { body: decemberMonths },
    });
    renderWithProviders(<App />, "/payslips");
    expect(await screen.findByText("November")).toBeInTheDocument(); // defaults to the newest year
    await userEvent.click(screen.getByRole("button", { name: "2025" }));
    await screen.findByText("November"); // still renders the (different) 2025 months
    expect(screen.getAllByText("Before you joined")).toHaveLength(12); // every month of 2025 is before joining
  });

  it("downloads a payslip, generating it on first request", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "GET /payroll/payslips/mine/years": { body: YEARS_2026 },
      "GET /payroll/payslips/mine?year=2026": { body: MONTHS_2026 },
      "GET /payroll/payslips/mine/2026-11/download-url": { body: { url: "https://signed.example/payslips/3/2026-11-01-a.pdf", valid_for_seconds: 300 } },
    });
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    renderWithProviders(<App />, "/payslips");
    const buttons = await screen.findAllByRole("button", { name: "Generate and download" }); // August and November
    const novemberCard = screen.getByText("November").closest(".card") as HTMLElement;
    await userEvent.click(within(novemberCard).getByRole("button", { name: "Generate and download" }));
    expect(buttons).toHaveLength(2);
    expect(callsTo(fetchMock, "GET /payroll/payslips/mine/2026-11/download-url")).toHaveLength(1);
    expect(openSpy).toHaveBeenCalledWith("https://signed.example/payslips/3/2026-11-01-a.pdf", "_blank", "noopener");
  });

  it("shows nothing booked yet when no years are returned", async () => {
    storeSession();
    mockRoutes({ "GET /payroll/payslips/mine/years": { body: [] } });
    renderWithProviders(<App />, "/payslips");
    expect(await screen.findByText(/No payslip years yet/)).toBeInTheDocument();
  });

  it("is hidden for the super admin account", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({ "GET /superadmin/employees": { body: [] }, "GET /superadmin/leave-types": { body: [] } });
    renderWithProviders(<App />, "/home");
    expect(screen.queryByRole("link", { name: "Payslips" })).not.toBeInTheDocument();
  });
});

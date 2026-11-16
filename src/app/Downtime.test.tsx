// Per-page maintenance mode (PageDowntimeGuard), driven by GET /system/downtime.
import { screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

describe("per-page downtime", () => {
  it("shows a maintenance notice on a page the backend marks down", async () => {
    storeSession({ attendanceAccess: "employee" });
    mockRoutes({
      "GET /system/downtime": { body: { down_pages: ["payslips"] } },
      "GET /payroll/payslips/mine/years": { body: [2026] },
      "GET /payroll/payslips/mine?year=2026": { body: [] },
    });
    renderWithProviders(<App />, "/payslips");
    expect(await screen.findByText("This page is down for maintenance")).toBeInTheDocument();
    expect(screen.queryByText("My payslips")).not.toBeInTheDocument();
  });

  it("leaves an unaffected page working normally", async () => {
    storeSession({ attendanceAccess: "employee" });
    mockRoutes({
      "GET /system/downtime": { body: { down_pages: ["payslips"] } },
      "GET /leave/balances": { body: [] },
    });
    renderWithProviders(<App />, "/leave");
    expect(await screen.findByRole("heading", { name: "My leave" })).toBeInTheDocument();
    expect(screen.queryByText("This page is down for maintenance")).not.toBeInTheDocument();
  });

  it("shows the normal page once nothing is marked down", async () => {
    storeSession({ attendanceAccess: "employee" });
    mockRoutes({
      "GET /system/downtime": { body: { down_pages: [] } },
      "GET /payroll/payslips/mine/years": { body: [2026] },
      "GET /payroll/payslips/mine?year=2026": { body: [] },
    });
    renderWithProviders(<App />, "/payslips");
    expect(await screen.findByText("My payslips")).toBeInTheDocument();
  });

  // The AI assistant is a floating widget now (AiChatWidget.tsx), not a routed page, so it checks
  // the same "chat" key itself instead of going through PageDowntimeGuard.
  it("hides the AI chat widget's button when the backend marks \"chat\" down", async () => {
    storeSession({ attendanceAccess: "employee" });
    mockRoutes({ "GET /system/downtime": { body: { down_pages: ["chat"] } } });
    renderWithProviders(<App />, "/change-password");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open chat" })).not.toBeInTheDocument());
  });

  it("shows the AI chat widget's button once \"chat\" is not marked down", async () => {
    storeSession({ attendanceAccess: "employee" });
    mockRoutes({ "GET /system/downtime": { body: { down_pages: [] } } });
    renderWithProviders(<App />, "/change-password");
    expect(await screen.findByRole("button", { name: "Open chat" })).toBeInTheDocument();
  });
});

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach } from "vitest";
import { App } from "../app/App";
import { mockRoutes, renderWithProviders, storeSession } from "./renderWithProviders";

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => window.localStorage.clear());

const CORRECTIONS = [
  { id: 4, employee_id: 3, work_date: "2026-11-09", requested_check_in: null, requested_check_out: "2026-11-09T13:30:00+00:00", reason: "Forgot", status: "rejected", decision_note: "No proof", created_at: "2026-11-10T05:00:00Z" },
  { id: 3, employee_id: 3, work_date: "2026-11-06", requested_check_in: null, requested_check_out: null, reason: "Forgot", status: "pending", decision_note: null, created_at: "2026-11-10T05:00:00Z" },
];

describe("notification bell", () => {
  it("shows a decided attendance correction, clears the dot once opened, and ignores Auto approvals", async () => {
    storeSession();
    mockRoutes({
      "GET /attendance/corrections/mine": { body: [...CORRECTIONS, { ...CORRECTIONS[0], id: 5, work_date: "2026-11-05", status: "approved", decision_note: "Auto" }] },
      "GET /attendance/today": { body: {} },
    });
    renderWithProviders(<App />, "/change-password");
    const bell = await screen.findByRole("button", { name: "1 new decision" }); // the Auto one does not count
    await userEvent.click(bell);
    expect(screen.getByText("Attendance corrections")).toBeInTheDocument();
    expect(screen.getByText("Correction for Mon, 09 Nov")).toBeInTheDocument();
    expect(screen.getByText("Rejected: No proof")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No new notifications" })).toBeInTheDocument();
  });

  it("shows a pending document request and a decided one, and clears the dot once opened", async () => {
    storeSession();
    mockRoutes({
      "GET /attendance/corrections/mine": { body: [] },
      "GET /attendance/today": { body: {} },
      "GET /documents/requests/inbox": {
        body: [{ id: 1, document: { id: 9, original_filename: "handbook.pdf" }, requester: { emp_id: "EMP002", full_name: "Ann Employee" }, requested_at: "2026-11-10T00:00:00Z" }],
      },
      "GET /documents/requests/mine": {
        body: [{ id: 2, document: { id: 10, original_filename: "my-notes.docx" }, status: "approved", requested_at: "2026-11-01T00:00:00Z", decided_at: "2026-11-02T00:00:00Z", expires_at: "2099-01-01T00:00:00Z", is_active: true }],
      },
    });
    renderWithProviders(<App />, "/change-password");
    const bell = await screen.findByRole("button", { name: "2 new decisions" });
    await userEvent.click(bell);
    expect(screen.getByText("Document requests waiting for you")).toBeInTheDocument();
    expect(screen.getByText("handbook.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Ann Employee \(EMP002\) asked for access/)).toBeInTheDocument();
    expect(screen.getByText("Document access decisions")).toBeInTheDocument();
    expect(screen.getByText("my-notes.docx")).toBeInTheDocument();
    expect(screen.getByText("Approved - view-only for a limited time")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No new notifications" })).toBeInTheDocument();
  });
});

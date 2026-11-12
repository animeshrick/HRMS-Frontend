import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const SUMMARY = { present: 1, half_day: 0, absent: 0, incomplete: 0, on_leave: 0, holiday: 0, weekend: 0, checked_in: 0, not_checked_in: 0, late_days: 0, early_leave_days: 0, worked_minutes: 540 };
const TODAY = {
  work_date: "2026-11-12", day_note: null, checked_in_at: null, checked_out_at: null, status: "not_checked_in", is_late: false, is_early_leave: false,
  worked_minutes: null, can_check_in: true, can_check_out: false, office_start: "10:00 AM", office_end: "7:00 PM", late_after: "10:45 AM", network_check_enabled: false,
};
const MONTH = {
  emp_id: "EMP003", full_name: "Test User", month: "2026-11", summary: SUMMARY,
  days: [{ date: "2026-11-10", weekday: "Tue", status: "present", check_in_at: "2026-11-10T04:30:00Z", check_out_at: "2026-11-10T13:30:00Z", worked_minutes: 540, is_late: false, is_early_leave: false, note: null }],
};
const EMPLOYEE_ROUTES = {
  "GET /attendance/today": { body: TODAY },
  "GET /attendance/mine?month=2026-11": { body: MONTH },
  "GET /attendance/corrections/mine": { body: [] },
};

describe("attendance page", () => {
  it("shows the month in Indian time and checks in", async () => {
    storeSession();
    // After the check-in the page asks for today again, so the fake switches to the checked-in state.
    const checkedIn = { ...TODAY, status: "checked_in", checked_in_at: "2026-11-12T04:35:00Z", can_check_in: false, can_check_out: true };
    let hasCheckedIn = false;
    const fetchMock = mockRoutes({
      ...EMPLOYEE_ROUTES,
      "GET /attendance/today": () => ({ body: hasCheckedIn ? checkedIn : TODAY }),
      "POST /attendance/check-in": () => {
        hasCheckedIn = true;
        return { body: checkedIn };
      },
    });
    renderWithProviders(<App />, "/attendance");
    expect(await screen.findByText("10:00 AM", { selector: "td" })).toBeInTheDocument(); // 04:30 UTC
    expect(screen.getByText("7:00 PM", { selector: "td" })).toBeInTheDocument(); // 13:30 UTC
    expect(screen.getByRole("button", { name: "Check out" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText(/In 10:05 AM/)).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /attendance/check-in")).toHaveLength(1);
  });

  it("shows the rule error when check in is refused", async () => {
    storeSession();
    mockRoutes({ ...EMPLOYEE_ROUTES, "POST /attendance/check-in": { status: 403, body: { detail: "Check in only from the office network.", code: "attendance_rule" } } });
    renderWithProviders(<App />, "/attendance");
    await userEvent.click(await screen.findByRole("button", { name: "Check in" }));
    expect(await screen.findByText(/only from the office network/)).toBeInTheDocument();
  });

  it("sends a correction request", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...EMPLOYEE_ROUTES,
      "POST /attendance/corrections": { body: { id: 5, employee_id: 3, work_date: "2026-11-10", requested_check_in: null, requested_check_out: "19:00", reason: "Forgot", status: "pending", created_at: "2026-11-12T05:00:00Z" } },
    });
    renderWithProviders(<App />, "/attendance");
    await screen.findByText("10:00 AM", { selector: "td" });
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled(); // needs a time
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-10");
    await userEvent.type(screen.getByLabelText(/Check-out time/), "19:00");
    await userEvent.type(screen.getByLabelText("Reason"), "Forgot");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/waiting for approval/)).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /attendance/corrections")).toHaveLength(1);
  });

  it("an employee has no team link", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance");
    await screen.findByText("10:00 AM", { selector: "td" });
    expect(screen.getByRole("link", { name: "Attendance" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Team attendance" })).not.toBeInTheDocument();
  });

  it("the CEO has no attendance link and is sent to the chat", async () => {
    storeSession({ role: "ceo", attendanceAccess: "none" });
    mockRoutes({});
    renderWithProviders(<App />, "/attendance");
    expect(await screen.findByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Attendance" })).not.toBeInTheDocument();
  });
});

describe("team attendance page", () => {
  const TEAM = {
    date: "2026-11-12", summary: SUMMARY,
    people: [{ emp_id: "EMP003", full_name: "Ann Employee", dept: "IT", date: "2026-11-12", weekday: "Thu", status: "present", check_in_at: "2026-11-12T04:30:00Z", check_out_at: null, worked_minutes: null, is_late: true, is_early_leave: false, note: null }],
  };
  const INBOX = [{ id: 9, employee_id: 3, emp_id: "EMP003", full_name: "Ann Employee", dept: "IT", work_date: "2026-11-10", requested_check_in: null, requested_check_out: "19:00", current_check_in_at: "2026-11-10T04:30:00Z", current_check_out_at: null, reason: "Forgot", status: "pending", decided_at: null, decision_note: null, created_at: "2026-11-12T05:00:00Z" }];

  it("lets a PM see the team and approve a correction", async () => {
    storeSession({ role: "pm", attendanceAccess: "pm" });
    const fetchMock = mockRoutes({
      "GET /attendance/team": { body: TEAM },
      "GET /attendance/corrections/inbox": { body: INBOX },
      "POST /attendance/corrections/9/decision": { body: { ...INBOX[0], status: "approved" } },
    });
    renderWithProviders(<App />, "/attendance/team");
    await screen.findByText("Ann Employee");
    const table = screen.getByRole("table");
    expect(within(table).getByText("Late")).toBeInTheDocument();
    expect(await screen.findByText(/out 19:00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(callsTo(fetchMock, "POST /attendance/corrections/9/decision")).toHaveLength(1);
  });

  it("sends an employee away from the team page", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance/team");
    expect(await screen.findByRole("heading", { name: "Attendance" })).toBeInTheDocument();
  });
});

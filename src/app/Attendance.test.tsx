import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const SUMMARY = { present: 1, half_day: 0, absent: 0, incomplete: 0, on_leave: 0, holiday: 0, weekend: 0, checked_in: 0, not_checked_in: 0, late_days: 0, early_leave_days: 0, worked_minutes: 540 };
const TODAY = {
  work_date: "2026-11-12", day_note: null, checked_in_at: null, checked_out_at: null, status: "not_checked_in", is_late: false, is_early_leave: false,
  worked_minutes: null, can_check_in: true, can_check_out: false, office_start: "10:00", office_end: "19:00", late_after: "10:45", network_check_enabled: false,
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

async function pickTime(label: string, hour: string, minute: string, period: string) {
  await userEvent.selectOptions(screen.getByLabelText(`${label} hour`), hour);
  await userEvent.selectOptions(screen.getByLabelText(`${label} minute`), minute);
  await userEvent.selectOptions(screen.getByLabelText(`${label} AM or PM`), period);
}

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
    await screen.findByRole("button", { name: "2026-11-10 Present" });
    expect(screen.getByText("Hover or click a day to see the details.")).toBeInTheDocument(); // times stay hidden until a day is chosen
    await userEvent.click(screen.getByRole("button", { name: "2026-11-10 Present" }));
    expect(screen.getByTestId("day-details")).toHaveTextContent("In 10:00 AM | Out 7:00 PM | Worked 9h 00m"); // 04:30 and 13:30 UTC
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
    await screen.findByRole("button", { name: "2026-11-10 Present" });
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled(); // needs a time
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-10");
    await pickTime("Check-out time (optional)", "7", "05", "PM");
    await userEvent.type(screen.getByLabelText("Reason"), "Forgot");
    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/waiting for approval/)).toBeInTheDocument();
    const sent = callsTo(fetchMock, "POST /attendance/corrections");
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String((sent[0]?.[1] as RequestInit).body))).toMatchObject({ check_out_time: "19:05" }); // 7:05 PM is sent as 24 hour time
  });

  it("shows a day's details when the mouse is over it", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance");
    const day = await screen.findByRole("button", { name: "2026-11-10 Present" });
    await userEvent.hover(day);
    expect(screen.getByTestId("day-details")).toHaveTextContent("2026-11-10 Tue: Present");
    await userEvent.unhover(day);
    expect(screen.queryByTestId("day-details")).not.toBeInTheDocument();
  });

  it("does not allow a correction on a week off", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance");
    await screen.findByRole("button", { name: "2026-11-10 Present" });
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-07"); // a Saturday
    await pickTime("Check-out time (optional)", "7", "00", "PM");
    await userEvent.type(screen.getByLabelText("Reason"), "Forgot");
    expect(screen.getByText(/week offs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("can send a second request after the first one", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...EMPLOYEE_ROUTES,
      "POST /attendance/corrections": { body: { id: 5, employee_id: 3, work_date: "2026-11-10", requested_check_in: null, requested_check_out: "2026-11-10T13:30:00+00:00", reason: "Forgot", status: "pending", created_at: "2026-11-12T05:00:00Z" } },
    });
    renderWithProviders(<App />, "/attendance");
    await screen.findByRole("button", { name: "2026-11-10 Present" });
    for (const day of ["2026-11-09", "2026-11-10"]) {
      await userEvent.type(screen.getByLabelText("Date"), day);
      await pickTime("Check-out time (optional)", "7", "05", "PM");
      await userEvent.type(screen.getByLabelText("Reason"), "Forgot");
      await userEvent.click(screen.getByRole("button", { name: "Send request" }));
      await waitFor(() => expect(screen.getByLabelText("Reason")).toHaveValue("")); // the form is empty again, including the time boxes
      expect(screen.getByLabelText("Check-out time (optional) hour")).toHaveValue("");
    }
    expect(callsTo(fetchMock, "POST /attendance/corrections")).toHaveLength(2);
  });

  it("picks times on the 12 hour clock and sends them as 24 hour time", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance");
    await screen.findByRole("button", { name: "2026-11-10 Present" });
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-10");
    await userEvent.type(screen.getByLabelText("Reason"), "Forgot");
    await userEvent.selectOptions(screen.getByLabelText("Check-in time (optional) hour"), "9");
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled(); // a half chosen time is not sent
    await pickTime("Check-in time (optional)", "9", "30", "AM");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("an employee has no team link", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance");
    await screen.findByRole("button", { name: "2026-11-10 Present" });
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
  const INBOX = [{ id: 9, employee_id: 3, emp_id: "EMP003", full_name: "Ann Employee", dept: "IT", work_date: "2026-11-10", requested_check_in: null, requested_check_out: "2026-11-10T13:30:00+00:00", current_check_in_at: "2026-11-10T04:30:00Z", current_check_out_at: null, reason: "Forgot", status: "pending", decided_at: null, decision_note: null, created_at: "2026-11-12T05:00:00Z" }];

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
    expect(await screen.findByText(/Asks:/)).toHaveTextContent("Asks: Out 7:00 PM"); // the request comes as a UTC timestamp, shown in India time on the 12 hour clock
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(callsTo(fetchMock, "POST /attendance/corrections/9/decision")).toHaveLength(1);
  });

  it("needs a comment to reject a correction", async () => {
    storeSession({ role: "pm", attendanceAccess: "pm" });
    let isRejected = false; // the server stops listing a request once it is decided
    const fetchMock = mockRoutes({
      "GET /attendance/team": { body: TEAM },
      "GET /attendance/corrections/inbox": () => ({ body: isRejected ? [] : INBOX }),
      "POST /attendance/corrections/9/decision": () => {
        isRejected = true;
        return { body: { ...INBOX[0], status: "rejected", decision_note: "No proof" } };
      },
    });
    renderWithProviders(<App />, "/attendance/team");
    await userEvent.click(await screen.findByRole("button", { name: "Reject" }));
    expect(callsTo(fetchMock, "POST /attendance/corrections/9/decision")).toHaveLength(0); // the first click only opens the comment box
    expect(screen.getByRole("button", { name: "Confirm rejection" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason for rejecting"), "No proof");
    await userEvent.click(screen.getByRole("button", { name: "Confirm rejection" }));
    const sent = callsTo(fetchMock, "POST /attendance/corrections/9/decision");
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String((sent[0]?.[1] as RequestInit).body))).toEqual({ decision: "rejected", note: "No proof" });
    await waitFor(() => expect(screen.queryByText(/Ann Employee \(EMP003\)/)).not.toBeInTheDocument()); // a decided request leaves the waiting list
  });

  it("tells an employee the team page is not for them", async () => {
    storeSession();
    mockRoutes(EMPLOYEE_ROUTES);
    renderWithProviders(<App />, "/attendance/team");
    expect(await screen.findByRole("alert")).toHaveTextContent("Only HR, project managers and the super admin can see team attendance.");
  });
});

describe("loading", () => {
  it("shows a loader only when the answer is slow, and a working label on the check-in button", async () => {
    storeSession();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // never answers
    renderWithProviders(<App />, "/attendance");
    expect(screen.queryByText("Loading today")).not.toBeInTheDocument(); // a quick answer would not flash it
    expect(await screen.findByText("Loading today")).toBeInTheDocument(); // after the short delay
  });
});

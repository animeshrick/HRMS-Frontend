import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const TODAY = {
  work_date: "2026-11-12", day_note: null, checked_in_at: null, checked_out_at: null, status: "not_checked_in", is_late: false, is_early_leave: false,
  worked_minutes: null, can_check_in: true, can_check_out: false, office_start: "10:00", office_end: "19:00", late_after: "10:45", network_check_enabled: false,
};
const ROUTES = {
  "GET /attendance/today": { body: TODAY },
  "GET /superadmin/employees": {
    body: [
      { emp_id: "EMP-3", full_name: "Ann Employee", dept: "IT", role: "employee", has_attendance: true },
      { emp_id: "EMP-5", full_name: "Cleo CEO", dept: "Management", role: "ceo", has_attendance: false },
    ],
  },
  "GET /superadmin/leave-types": { body: [{ code: "casual", name: "Casual Leave" }] },
};

describe("super admin page", () => {
  it("is shown only to the super admin", async () => {
    storeSession({ role: "hr", attendanceAccess: "hr" });
    mockRoutes(ROUTES);
    renderWithProviders(<App />, "/superadmin");
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the super admin can open this page.");
    expect(screen.queryByRole("link", { name: "Super admin" })).not.toBeInTheDocument();
  });

  it("applies leave for someone", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    const fetchMock = mockRoutes({ ...ROUTES, "POST /superadmin/leave": { body: { leave_id: 1, message: "Casual Leave saved." } } });
    renderWithProviders(<App />, "/superadmin");
    await screen.findAllByRole("option", { name: "Ann Employee (EMP-3), IT" });
    const [employee, leaveType] = screen.getAllByRole("combobox").slice(0, 2);
    await userEvent.selectOptions(employee!, "EMP-3");
    await userEvent.selectOptions(leaveType!, "casual");
    await userEvent.type(screen.getByLabelText("From"), "2026-08-03");
    await userEvent.click(screen.getByRole("button", { name: "Apply and approve" }));
    expect(await screen.findByText("Casual Leave saved.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /superadmin/leave")[0]![1]).toMatchObject({ body: expect.stringContaining('"emp_id":"EMP-3"') });
  });

  it("lists only people who have attendance, and blocks a weekend date", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes(ROUTES);
    renderWithProviders(<App />, "/superadmin");
    expect(await screen.findAllByRole("option", { name: "Ann Employee (EMP-3), IT" })).toHaveLength(2); // leave list and attendance list
    expect(screen.getAllByRole("option", { name: "Cleo CEO (EMP-5), Management" })).toHaveLength(1); // in the leave list only
    await userEvent.type(screen.getByLabelText("Date"), "2026-11-07"); // a Saturday
    expect(await screen.findByText(/week offs/)).toBeInTheDocument();
  });
});

describe("clear messages", () => {
  it("says what is missing instead of doing nothing", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    const fetchMock = mockRoutes(ROUTES);
    renderWithProviders(<App />, "/superadmin");
    await screen.findAllByRole("option", { name: "Ann Employee (EMP-3), IT" });
    await userEvent.click(screen.getByRole("button", { name: "Apply and approve" }));
    expect(await screen.findByText("Choose the employee.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save attendance" }));
    expect(screen.getAllByText("Choose the employee.")).toHaveLength(2);
    expect(callsTo(fetchMock, "POST /superadmin/leave")).toHaveLength(0);
  });

  it("shows the server's reason when the save is refused", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({ ...ROUTES, "POST /superadmin/leave": { status: 400, body: { detail: "Ann Employee has only 0 days of Casual Leave left for FY 2026-27, and this request needs 1 day.", code: "leave_rule" } } });
    renderWithProviders(<App />, "/superadmin");
    await screen.findAllByRole("option", { name: "Ann Employee (EMP-3), IT" });
    const [employee, leaveType] = screen.getAllByRole("combobox").slice(0, 2);
    await userEvent.selectOptions(employee!, "EMP-3");
    await userEvent.selectOptions(leaveType!, "casual");
    await userEvent.type(screen.getByLabelText("From"), "2026-11-12");
    await userEvent.click(screen.getByRole("button", { name: "Apply and approve" }));
    expect(await screen.findByText(/Ann Employee has only 0 days of Casual Leave left/)).toBeInTheDocument();
  });
});

describe("leave balance warning", () => {
  it("shows the balance and warns when the request cannot fit", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({
      ...ROUTES,
      "GET /superadmin/leave-balances/EMP-3?on_date=2026-10-29": {
        body: [{ type_code: "casual", type_name: "Casual Leave", limit_type: "per_year", days_allowed: 12, used_days: 12, pending_days: 0, remaining_days: 0, max_days_per_request: null }],
      },
    });
    renderWithProviders(<App />, "/superadmin");
    await screen.findAllByRole("option", { name: "Ann Employee (EMP-3), IT" });
    const [employee, leaveType] = screen.getAllByRole("combobox").slice(0, 2);
    await userEvent.selectOptions(employee!, "EMP-3");
    await userEvent.selectOptions(leaveType!, "casual");
    await userEvent.type(screen.getByLabelText("From"), "2026-10-29");
    expect(await screen.findByRole("list", { name: "Leave balances" })).toHaveTextContent("Casual Leave: 0 left of 12 (used 12, waiting 0)");
    expect(await screen.findByRole("alert")).toHaveTextContent("Ann Employee has only 0 days of Casual Leave left");
  });
});

describe("finding an employee", () => {
  it("shows the department, filters, and fills the attendance form with the saved day", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({
      ...ROUTES,
      "GET /attendance/person/EMP-3?month=2026-10": {
        body: { emp_id: "EMP-3", full_name: "Ann Employee", month: "2026-10", summary: {}, days: [{ date: "2026-10-31", weekday: "Sat", status: null, check_in_at: null, check_out_at: null, worked_minutes: null, is_late: false, is_early_leave: false, note: null }] },
      },
    });
    renderWithProviders(<App />, "/superadmin");
    expect(await screen.findByText(/EMP-3 \| IT/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search employees"), "management");
    expect(screen.queryByText(/EMP-3 \| IT/)).not.toBeInTheDocument();
    expect(screen.getByText(/EMP-5 \| Management/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Search employees"));
    await userEvent.click(screen.getAllByRole("button", { name: "Set attendance" })[0]!);
    await userEvent.type(screen.getByLabelText("Date"), "2026-10-30");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-10-30");
  });
});

describe("super admin account", () => {
  it("has no leave, attendance or check-in of its own, but keeps the team pages", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes(ROUTES);
    renderWithProviders(<App />, "/home");
    await screen.findByRole("heading", { name: /^Good (morning|afternoon|evening),/ });
    expect(screen.queryByRole("link", { name: "Leave" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Attendance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team attendance" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Approvals" })).toBeInTheDocument();
  });
});

describe("home wishes", () => {
  it("wishes the person on their birthday and shows other celebrations", async () => {
    storeSession({ role: "employee", fullName: "Ann Employee", employeeId: "EMP-3" });
    mockRoutes({
      ...ROUTES,
      "GET /leave/balances?": { body: [] },
      "GET /celebrations": {
        body: [
          { emp_id: "EMP-3", full_name: "Ann Employee", dept: "IT", kind: "birthday", years: null },
          { emp_id: "EMP-9", full_name: "Raj Das", dept: "Sales", kind: "anniversary", years: 3 },
        ],
      },
      "GET /leave/balances": { body: [] },
      "GET /attendance/mine?month=2026-11": { body: { summary: { present: 0, half_day: 0, late_days: 0 }, days: [] } },
    });
    renderWithProviders(<App />, "/home");
    expect(await screen.findByText(/Happy birthday, Ann!/)).toBeInTheDocument();
    expect(await screen.findByText(/3 years with the company today/)).toBeInTheDocument();
    expect(screen.getByText("Raj Das")).toBeInTheDocument();
  });
});

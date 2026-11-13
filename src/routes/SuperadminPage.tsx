import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPersonMonth } from "../api/attendance";
import {
  applyLeaveFor,
  getBalancesFor,
  getSuperadminAuditLog,
  getSuperadminEmployees,
  getSuperadminLeaveTypes,
  markAttendanceFor,
} from "../api/superadmin";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { Loading } from "../components/Loading";
import { DayMarks, statusText } from "../components/MonthTable";
import { TimeField } from "../components/TimeField";
import { useToast } from "../components/Toast";
import { BUTTON_PRIMARY, Card, CardTitle, INPUT, PageHeader } from "../components/ui";
import { describeError } from "../lib/errors";
import { companyToday, formatClock, formatMinutes, formatShortTime } from "../lib/time";

// Saturday and Sunday are week offs. The backend refuses them (and company holidays) too.
const isWeekOff = (day: string) => day !== "" && [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());

export function SuperadminPage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const toast = useToast();
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({ queryKey: ["superadmin-employees"], queryFn: () => getSuperadminEmployees(token) });
  const leaveTypesQuery = useQuery({ queryKey: ["superadmin-leave-types"], queryFn: () => getSuperadminLeaveTypes(token) });
  const auditLogQuery = useQuery({ queryKey: ["superadmin-audit-log"], queryFn: () => getSuperadminAuditLog(token) });
  const employees = employeesQuery.data ?? [];
  const leaveCardReference = useRef<HTMLDivElement>(null);
  const attendanceCardReference = useRef<HTMLDivElement>(null);

  // ---- find an employee
  const [search, setSearch] = useState("");
  const searchText = search.trim().toLowerCase();
  const foundEmployees = employees.filter((person) =>
    [person.emp_id, person.full_name, person.dept ?? ""].some((text) => text.toLowerCase().includes(searchText)),
  );

  // ---- leave
  const [leaveEmployee, setLeaveEmployee] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [dayType, setDayType] = useState<"full" | "half">("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const leaveMutation = useMutation({
    mutationFn: () =>
      applyLeaveFor(token, {
        emp_id: leaveEmployee,
        leave_type: leaveType,
        start_date: startDate,
        end_date: dayType === "half" ? startDate : endDate || startDate,
        day_type: dayType,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: ["superadmin-balances"] });
      void queryClient.invalidateQueries({ queryKey: ["superadmin-audit-log"] });
      setStartDate("");
      setEndDate("");
      setReason("");
    },
  });
  const leaveBlocked = isWeekOff(startDate) || isWeekOff(endDate);

  // The balances of the chosen person for the leave year of the start date, so a request that cannot fit is seen before saving.
  const balanceDate = startDate || companyToday();
  const balancesQuery = useQuery({
    queryKey: ["superadmin-balances", leaveEmployee, balanceDate],
    queryFn: () => getBalancesFor(token, leaveEmployee, balanceDate),
    enabled: leaveEmployee !== "",
  });
  const chosenBalance = balancesQuery.data?.find((balance) => balance.type_code === leaveType);
  const chosenPerson = employees.find((person) => person.emp_id === leaveEmployee);
  // Monday to Friday days of the request (company holidays are not known here, so this is a close estimate; the server decides).
  const requestedDays = (() => {
    if (!startDate) return 0;
    const last = dayType === "half" ? startDate : endDate || startDate;
    let count = 0;
    for (let day = new Date(`${startDate}T00:00:00Z`); day <= new Date(`${last}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 1)) {
      if (![0, 6].includes(day.getUTCDay())) count += 1;
    }
    return dayType === "half" ? count / 2 : count;
  })();
  const isShort = chosenBalance !== undefined && chosenBalance.remaining_days !== null && requestedDays > chosenBalance.remaining_days;

  function chooseForLeave(empId: string) {
    setLeaveEmployee(empId);
    leaveCardReference.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const [leaveProblem, setLeaveProblem] = useState<string | null>(null);

  /** The first thing wrong with the leave form, in words, or null. */
  function findLeaveProblem(): string | null {
    if (!leaveEmployee) return "Choose the employee.";
    if (!leaveType) return "Choose the leave type.";
    if (!startDate) return dayType === "half" ? "Choose the date." : "Choose the first date.";
    if (dayType === "full" && endDate && endDate < startDate) return "The last date is before the first date.";
    if (leaveBlocked) return "Saturday and Sunday are week offs. Please choose working days.";
    return null;
  }

  function submitLeave(event: FormEvent) {
    event.preventDefault();
    const problem = findLeaveProblem();
    setLeaveProblem(problem);
    if (!problem) {
      leaveMutation.mutate();
    }
  }

  // ---- attendance
  const [attendanceEmployee, setAttendanceEmployee] = useState("");
  const [attendanceDate, setAttendanceDate] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [formVersion, setFormVersion] = useState(0); // a new number makes the time pickers show empty again
  const attendanceMutation = useMutation({
    mutationFn: () =>
      markAttendanceFor(token, { emp_id: attendanceEmployee, work_date: attendanceDate, check_in_time: checkIn || undefined, check_out_time: checkOut || undefined }),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: ["superadmin-audit-log"] });
      setCheckIn("");
      setCheckOut("");
      setFormVersion((version) => version + 1);
    },
  });
  const attendanceBlocked = isWeekOff(attendanceDate);

  function chooseForAttendance(empId: string) {
    setAttendanceEmployee(empId);
    attendanceCardReference.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  // What is already saved for that person on that day, so the admin sees what will be replaced.
  const dayQuery = useQuery({
    queryKey: ["superadmin-day", attendanceEmployee, attendanceDate.slice(0, 7)],
    queryFn: () => getPersonMonth(token, attendanceEmployee, attendanceDate.slice(0, 7)),
    enabled: attendanceEmployee !== "" && attendanceDate.length === 10,
  });
  const savedDay = dayQuery.data?.days.find((day) => day.date === attendanceDate);

  const [attendanceProblem, setAttendanceProblem] = useState<string | null>(null);

  /** The first thing wrong with the attendance form, in words, or null. */
  function findAttendanceProblem(): string | null {
    if (!attendanceEmployee) return "Choose the employee.";
    if (!attendanceDate) return "Choose the date.";
    if (attendanceDate > companyToday()) return "That day has not come yet.";
    if (attendanceBlocked) return "Saturday and Sunday are week offs. Please choose a working day.";
    if (!checkIn && !checkOut) return "Enter the check-in time, the check-out time, or both.";
    if (checkIn && checkOut && checkOut <= checkIn) return "The check-out time must be after the check-in time.";
    if (!checkIn && dayQuery.data && !savedDay?.check_in_at) return "No check-in is saved for this day, so please enter the check-in time too.";
    return null;
  }

  function submitAttendance(event: FormEvent) {
    event.preventDefault();
    const problem = findAttendanceProblem();
    setAttendanceProblem(problem);
    if (!problem) {
      attendanceMutation.mutate();
    }
  }

  return (
    <div className="page">
      <PageHeader title="Super admin" subtitle="Apply leave and set attendance for anyone, on any past date. Weekends and company holidays cannot be used." />
      {employeesQuery.isPending && <Loading fill="inline" label="Loading employees" delayMilliseconds={300} />}
      {employeesQuery.isError && <ErrorMessage message={`Could not load the employees. ${describeError(employeesQuery.error)}`} />}
      {leaveTypesQuery.isError && <ErrorMessage message={`Could not load the leave types. ${describeError(leaveTypesQuery.error)}`} />}

      <Card label="Find an employee">
        <CardTitle>Find an employee</CardTitle>
        <p className="mb-3 text-sm text-ink-2">For internal use. Search by ID, name or department, then choose what the employee asked for.</p>
        <input
          type="search"
          aria-label="Search employees"
          placeholder="Search by ID, name or department"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={`${INPUT} block w-full`}
        />
        <ul className="mt-3 max-h-72 divide-y divide-line overflow-y-auto text-sm">
          {foundEmployees.length === 0 && !employeesQuery.isPending && <li className="py-2 text-ink-3">No employee matches.</li>}
          {foundEmployees.map((person) => (
            <li key={person.emp_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium text-ink">{person.full_name}</span>
                <span className="text-ink-3">
                  {" "}
                  {person.emp_id} | {person.dept ?? "No department"}
                </span>
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => chooseForLeave(person.emp_id)} className="btn btn-sm btn-quiet">
                  Apply leave
                </button>
                <button
                  type="button"
                  disabled={!person.has_attendance}
                  onClick={() => chooseForAttendance(person.emp_id)}
                  className="btn btn-sm btn-quiet"
                >
                  Set attendance
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div ref={leaveCardReference} />
      <Card label="Apply leave">
        <CardTitle>Apply leave for someone</CardTitle>
        <p className="mb-3 text-sm text-ink-2">The leave is approved at once and still uses the person's leave balance.</p>
        <form onSubmit={submitLeave} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Employee
            <select value={leaveEmployee} onChange={(event) => setLeaveEmployee(event.target.value)} className={`${INPUT} mt-1 block w-full`}>
              <option value="">Choose</option>
              {employees.map((person) => (
                <option key={person.emp_id} value={person.emp_id}>
                  {person.full_name} ({person.emp_id}), {person.dept ?? "No department"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Leave type
            <select value={leaveType} onChange={(event) => setLeaveType(event.target.value)} className={`${INPUT} mt-1 block w-full`}>
              <option value="">Choose</option>
              {leaveTypesQuery.data?.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Day type
            <select value={dayType} onChange={(event) => setDayType(event.target.value as "full" | "half")} className={`${INPUT} mt-1 block w-full`}>
              <option value="full">Full day</option>
              <option value="half">Half day</option>
            </select>
          </label>
          <span className="hidden sm:block" />
          {leaveEmployee && balancesQuery.data && (
            <ul className="text-sm text-ink-2 sm:col-span-2" aria-label="Leave balances">
              {balancesQuery.data
                .filter((balance) => balance.remaining_days !== null)
                .map((balance) => (
                  <li key={balance.type_code}>
                    {balance.type_name}: <span className="font-medium text-ink">{balance.remaining_days} left</span> of {balance.days_allowed} (used {balance.used_days}, waiting {balance.pending_days})
                  </li>
                ))}
            </ul>
          )}
          <label className="text-sm">
            {dayType === "half" ? "Date" : "From"}
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${INPUT} mt-1 block w-full`} />
          </label>
          {dayType === "full" && (
            <label className="text-sm">
              To (optional)
              <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className={`${INPUT} mt-1 block w-full`} />
            </label>
          )}
          <label className="text-sm sm:col-span-2">
            Reason (optional)
            <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={`${INPUT} mt-1 block w-full`} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" disabled={leaveMutation.isPending} className={BUTTON_PRIMARY}>
              {leaveMutation.isPending ? "Saving..." : "Apply and approve"}
            </button>
          </div>
        </form>
        {isShort && chosenBalance && (
          <p role="alert" className="mt-3 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
            {chosenPerson?.full_name} has only {chosenBalance.remaining_days} days of {chosenBalance.type_name} left, and this request needs about {requestedDays}. Saving will be refused.
          </p>
        )}
        {leaveProblem ? <ErrorMessage message={leaveProblem} /> : leaveBlocked && <ErrorMessage message="Saturday and Sunday are week offs. Please choose working days." />}
        {balancesQuery.isError && <ErrorMessage message={`Could not load the leave balance. ${describeError(balancesQuery.error)}`} />}
        {leaveMutation.isError && <ErrorMessage message={describeError(leaveMutation.error)} />}
      </Card>

      <div ref={attendanceCardReference} />
      <Card label="Set attendance">
        <CardTitle>Set attendance for someone</CardTitle>
        <p className="mb-3 text-sm text-ink-2">Times are Indian time. The status (present, half day, late) is worked out by the normal rules. Existing times for that day are replaced.</p>
        <form onSubmit={submitAttendance} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Employee
            <select value={attendanceEmployee} onChange={(event) => setAttendanceEmployee(event.target.value)} className={`${INPUT} mt-1 block w-full`}>
              <option value="">Choose</option>
              {employees
                .filter((person) => person.has_attendance)
                .map((person) => (
                  <option key={person.emp_id} value={person.emp_id}>
                    {person.full_name} ({person.emp_id}), {person.dept ?? "No department"}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Date
            <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} className={`${INPUT} mt-1 block w-full`} />
          </label>
          <TimeField key={`in-${formVersion}`} label="Check-in time" value={checkIn} onChange={setCheckIn} />
          <TimeField key={`out-${formVersion}`} label="Check-out time (optional)" value={checkOut} onChange={setCheckOut} />
          <div className="sm:col-span-2">
            <button type="submit" disabled={attendanceMutation.isPending} className={BUTTON_PRIMARY}>
              {attendanceMutation.isPending ? "Saving..." : "Save attendance"}
            </button>
          </div>
        </form>
        {savedDay && !attendanceBlocked && (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2" data-testid="saved-day">
            {savedDay.status
              ? `Saved now: ${statusText(savedDay.status)}${savedDay.check_in_at ? ` | In ${formatClock(savedDay.check_in_at)}` : ""}${savedDay.check_out_at ? ` | Out ${formatClock(savedDay.check_out_at)}` : ""}${savedDay.worked_minutes !== null ? ` | Worked ${formatMinutes(savedDay.worked_minutes)}` : ""}`
              : `Nothing is saved for this day${savedDay.note ? ` (${savedDay.note})` : ""}.`}
            <DayMarks day={savedDay} />
          </p>
        )}
        {attendanceProblem ? <ErrorMessage message={attendanceProblem} /> : attendanceBlocked && <ErrorMessage message="Saturday and Sunday are week offs. Please choose a working day." />}
        {dayQuery.isError && <ErrorMessage message={`Could not load the saved attendance of that day. ${describeError(dayQuery.error)}`} />}
        {attendanceMutation.isError && <ErrorMessage message={describeError(attendanceMutation.error)} />}
      </Card>

      <Card label="Audit log">
        <CardTitle>Recent super admin actions</CardTitle>
        <p className="mb-3 text-sm text-ink-2">Every leave or attendance change made here for someone else, newest first.</p>
        {auditLogQuery.isLoading && <p className="text-sm text-ink-3">Loading...</p>}
        {auditLogQuery.isError && <ErrorMessage message={describeError(auditLogQuery.error)} />}
        {auditLogQuery.data && auditLogQuery.data.length === 0 && <p className="text-sm text-ink-3">Nothing yet.</p>}
        {auditLogQuery.data && auditLogQuery.data.length > 0 && (
          <ul className="space-y-1.5">
            {auditLogQuery.data.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                <span className="font-medium text-ink">{entry.target_emp_id}</span>{" "}
                <span className="text-ink-2">
                  {entry.action === "leave_applied"
                    ? `leave applied (${String(entry.details.leave_type ?? "")}, ${String(entry.details.start_date ?? "")}${entry.details.end_date && entry.details.end_date !== entry.details.start_date ? ` to ${String(entry.details.end_date)}` : ""})`
                    : `attendance set for ${String(entry.details.work_date ?? "")}`}
                </span>
                <span className="ml-2 text-ink-3">{formatShortTime(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

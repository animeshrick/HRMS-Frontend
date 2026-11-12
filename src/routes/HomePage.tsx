import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getMyMonth } from "../api/attendance";
import { getCelebrations } from "../api/celebrations";
import { getApprovals, getBalances } from "../api/leave";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { TodayCard } from "../components/TodayCard";
import { Card, CardTitle, PageHeader } from "../components/ui";
import { describeError } from "../lib/errors";
import { companyToday } from "../lib/time";

const clockFormat = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true });

function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** The wishes for this person today: their own birthday or work anniversary, and a Friday or Monday message. */
function buildWishes(firstName: string, today: string, mine: { kind: string; years: number | null }[]): string[] {
  const wishes: string[] = [];
  if (mine.some((item) => item.kind === "birthday")) {
    wishes.push(`Happy birthday, ${firstName}! Everyone here is glad you are part of the team.`);
  }
  const anniversary = mine.find((item) => item.kind === "anniversary");
  if (anniversary) {
    wishes.push(`Happy work anniversary, ${firstName}. Thank you for ${anniversary.years} ${anniversary.years === 1 ? "year" : "years"} with us.`);
  }
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  if (weekday === 5) {
    wishes.push(`Happy weekend, ${firstName}. Thank you for this week's work, and rest well.`);
  } else if (weekday === 1) {
    wishes.push(`Welcome back, ${firstName}. Wishing you a calm and good start to the week.`);
  }
  return wishes;
}

function Stat({ label, value, to, hint }: { label: string; value: ReactNode; to: string; hint?: string }) {
  return (
    <Link to={to} className="block rounded-xl border border-line bg-surface p-4 transition hover:border-brand">
      <p className="text-sm text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </Link>
  );
}

export function HomePage() {
  const { session } = useAuth();
  const token = session!.accessToken;
  const employeeId = session!.employeeId;
  const [now, setNow] = useState(() => new Date());
  const isSuperadmin = session!.role === "superadmin"; // no leave and no check-in of its own
  const hasAttendance = session!.attendanceAccess !== "none" && !isSuperadmin;
  const isApprover = session!.role !== "employee";

  // The clock moves once a minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const balancesQuery = useQuery({ queryKey: ["balances", employeeId], queryFn: () => getBalances(token), enabled: !isSuperadmin });
  const approvalsQuery = useQuery({ queryKey: ["approvals", employeeId], queryFn: () => getApprovals(token), enabled: isApprover });
  const celebrationsQuery = useQuery({ queryKey: ["celebrations", companyToday(now)], queryFn: () => getCelebrations(token) });
  const month = companyToday(now).slice(0, 7);
  const monthQuery = useQuery({ queryKey: ["attendance-month", employeeId, month], queryFn: () => getMyMonth(token, month), enabled: hasAttendance });

  const failedQuery = [balancesQuery, approvalsQuery, monthQuery, celebrationsQuery].find((query) => query.isError);
  const yearlyBalances = (balancesQuery.data ?? []).filter((balance) => balance.remaining_days !== null);
  const remainingDays = yearlyBalances.reduce((total, balance) => total + (balance.remaining_days ?? 0), 0);
  const hourNow = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(now)) % 24;
  const firstName = session!.fullName.split(" ")[0] ?? "";
  const celebrations = celebrationsQuery.data ?? [];
  const mine = celebrations.filter((item) => item.emp_id === session!.employeeId);
  const others = celebrations.filter((item) => item.emp_id !== session!.employeeId);
  const wishes = buildWishes(firstName, companyToday(now), mine);

  return (
    <div className="mx-auto h-full max-w-5xl space-y-6 overflow-y-auto px-4 py-6">
      <PageHeader title={`${greetingFor(hourNow)}, ${firstName}`} subtitle={clockFormat.format(now)} />

      {wishes.length > 0 && (
        <Card label="Wishes">
          <div className="space-y-1">
            {wishes.map((wish) => (
              <p key={wish} className="text-base text-ink">
                {wish}
              </p>
            ))}
          </div>
        </Card>
      )}

      {failedQuery && <ErrorMessage message={`Some details could not be loaded. ${describeError(failedQuery.error)}`} />}

      <div className="grid gap-4 md:grid-cols-3">
        {balancesQuery.data && <Stat label="Leave left this year" value={`${remainingDays} days`} to="/leave" hint={yearlyBalances.length === 1 ? "1 leave type" : `${yearlyBalances.length} leave types`} />}
        {hasAttendance && monthQuery.data && (
          <Stat
            label="Present this month"
            value={`${monthQuery.data.summary.present + monthQuery.data.summary.half_day} days`}
            to="/attendance"
            hint={`${monthQuery.data.summary.late_days} late`}
          />
        )}
        {isApprover && approvalsQuery.data && <Stat label="Waiting for you" value={approvalsQuery.data.length} to="/approvals" hint="leave requests" />}
      </div>

      {hasAttendance && <TodayCard />}

      {others.length > 0 && (
        <Card label="Celebrating today">
          <CardTitle>Celebrating today</CardTitle>
          <ul className="space-y-1 text-sm text-ink-2">
            {others.map((item) => (
              <li key={`${item.emp_id}-${item.kind}`}>
                <span className="font-medium text-ink">{item.full_name}</span>
                {item.dept ? `, ${item.dept}` : ""}:{" "}
                {item.kind === "birthday" ? "birthday today. Send your wishes." : `${item.years} ${item.years === 1 ? "year" : "years"} with the company today.`}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card label="Quick links">
        <CardTitle>Ask the assistant</CardTitle>
        <p className="text-sm text-ink-2">Ask about policies, apply for leave or check a balance in plain words.</p>
        <Link to="/chat" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:opacity-90">
          Open chat
        </Link>
      </Card>
    </div>
  );
}

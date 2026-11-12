import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { useAuth, type Session } from "../app/AuthContext";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import {
  ApprovalIcon,
  ChatIcon,
  ClockIcon,
  CloseIcon,
  HomeIcon,
  KeyIcon,
  LeaveIcon,
  LogoutIcon,
  MenuIcon,
  MoonIcon,
  ShieldIcon,
  SunIcon,
  TeamIcon,
  UserIcon,
} from "./icons";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { ToastProvider } from "./Toast";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

/** The sidebar links this person may use, in groups. A person with a temporary password gets only the change-password page. */
function buildNavigation(session: Session): { title: string; items: NavItem[] }[] {
  if (session.mustChangePassword) {
    return [{ title: "Account", items: [{ to: "/change-password", label: "Change password", icon: <KeyIcon /> }] }];
  }
  const canManageAttendance = ["superadmin", "hr", "pm"].includes(session.attendanceAccess);
  const isSuperadmin = session.role === "superadmin"; // an admin account only: no leave and no check-in of its own
  const work: NavItem[] = [
    { to: "/home", label: "Home", icon: <HomeIcon /> },
    { to: "/chat", label: "Chat", icon: <ChatIcon /> },
  ];
  if (!isSuperadmin) {
    work.push({ to: "/leave", label: "Leave", icon: <LeaveIcon /> });
  }
  if (!isSuperadmin && session.attendanceAccess !== "none") {
    work.push({ to: "/attendance", label: "Attendance", icon: <ClockIcon />, end: true });
  }
  const manage: NavItem[] = [{ to: "/approvals", label: "Approvals", icon: <ApprovalIcon /> }];
  if (canManageAttendance) {
    manage.push({ to: "/attendance/team", label: "Team attendance", icon: <TeamIcon /> });
  }
  if (session.role === "hr" || session.role === "superadmin") {
    manage.push({ to: "/admin", label: "HR admin", icon: <ShieldIcon /> });
  }
  if (session.role === "superadmin") {
    manage.push({ to: "/superadmin", label: "Super admin", icon: <ShieldIcon /> });
  }
  return [
    { title: "Workspace", items: work },
    { title: "Manage", items: manage },
    { title: "Account", items: [{ to: "/me", label: "My profile", icon: <UserIcon /> }, { to: "/change-password", label: "Change password", icon: <KeyIcon /> }] },
  ];
}

const ROLE_NAMES: Record<string, string> = { superadmin: "Super admin", hr: "HR", pm: "Project manager", ceo: "CEO", employee: "Employee" };

function initialsOf(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("");
}

function Sidebar({ session, onNavigate, onSignOut }: { session: Session; onNavigate?: () => void; onSignOut: () => void }) {
  const groups = buildNavigation(session);
  return (
    <div className="flex h-full w-64 flex-col bg-side text-side-ink">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo size={40} />
        <span className="leading-tight">
          <span className="block text-base font-semibold text-white">HR Assistant</span>
          <span className="block text-xs text-side-ink/70">Semicolon</span>
        </span>
      </div>
      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1 text-xs text-side-ink/60">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 ${
                        isActive
                          ? "bg-side-active text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-brand [&>svg]:text-brand"
                          : "text-side-ink hover:bg-side-active/60 hover:text-white"
                      }`
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-side-line p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-ink">
            {initialsOf(session.fullName)}
          </span>
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-white">{session.fullName}</p>
            <p className="truncate text-xs text-side-ink/70">
              {session.employeeId}, {ROLE_NAMES[session.role] ?? session.role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-side-ink transition duration-150 hover:bg-side-active/60 hover:text-white"
        >
          <LogoutIcon />
          Log out
        </button>
      </div>
    </div>
  );
}

export function Layout() {
  const { session, signOut } = useAuth();
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  // The drawer (the sidebar on a phone) closes on Escape.
  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setIsDrawerOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  if (!session) {
    return null;
  }

  // The name of the open page, shown in the top bar.
  const currentPage = buildNavigation(session)
    .flatMap((group) => group.items)
    .filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    .sort((first, second) => second.to.length - first.to.length)[0];

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-canvas">
        <aside className="hidden shrink-0 lg:block">
          <Sidebar session={session} onSignOut={() => signOut()} />
        </aside>

        {isDrawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setIsDrawerOpen(false)} />
            <div className="drawer-in absolute inset-y-0 left-0">
              <Sidebar session={session} onNavigate={() => setIsDrawerOpen(false)} onSignOut={() => signOut()} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setIsDrawerOpen((wasOpen) => !wasOpen)}
              aria-label={isDrawerOpen ? "Close menu" : "Open menu"}
              className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 lg:hidden"
            >
              {isDrawerOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
            <p aria-hidden="true" className="min-w-0 flex-1 truncate text-sm font-medium text-ink-2">
              <span className="text-ink-3">Semicolon Marketing</span>
              {currentPage && <span className="text-ink-3"> / </span>}
              {currentPage && <span className="text-ink">{currentPage.label}</span>}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                className="rounded-lg p-2 text-ink-2 transition hover:bg-surface-2 hover:text-ink"
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>
              {session.role !== "superadmin" && <NotificationBell />}
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

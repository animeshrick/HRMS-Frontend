import { NavLink, Outlet } from "react-router";
import { useAuth } from "../app/AuthContext";

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-indigo-100 text-indigo-800" : "text-slate-600 hover:bg-slate-100"}`;

export function Layout() {
  const { session, signOut } = useAuth();
  if (!session) {
    return null;
  }
  const canOpenAdmin = session.role === "hr";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <nav className="flex items-center gap-1" aria-label="Main">
          <span className="mr-3 font-semibold text-slate-900">HR Assistant</span>
          {!session.mustChangePassword && (
            <NavLink to="/chat" className={linkClassName}>
              Chat
            </NavLink>
          )}
          {!session.mustChangePassword && (
            <NavLink to="/leave" className={linkClassName}>
              Leave
            </NavLink>
          )}
          {!session.mustChangePassword && (
            <NavLink to="/approvals" className={linkClassName}>
              Approvals
            </NavLink>
          )}
          {canOpenAdmin && !session.mustChangePassword && (
            <NavLink to="/admin" className={linkClassName}>
              HR admin
            </NavLink>
          )}
          {!session.mustChangePassword && (
            <NavLink to="/me" className={linkClassName}>
              My profile
            </NavLink>
          )}
          <NavLink to="/change-password" className={linkClassName}>
            Change password
          </NavLink>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600">
            {session.fullName} ({session.employeeId})
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

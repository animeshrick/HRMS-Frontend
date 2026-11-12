// Route guards. They only decide what to show; the backend enforces the real permissions.
import { Navigate, Outlet, useLocation } from "react-router";
import { NotAvailable } from "../components/NotAvailable";
import { useAuth } from "./AuthContext";

/** Must be logged in. A user with a temporary password can only see the change-password page. */
export function RequireLogin() {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

/** Only HR and the super admin see the admin pages (the backend checks the same). */
export function RequireHr() {
  const { session } = useAuth();
  return session?.role === "hr" || session?.role === "superadmin" ? <Outlet /> : <NotAvailable message="Only HR can open the HR admin page." />;
}

/** Everyone except the CEO and the CTO has an attendance section. */
export function RequireAttendance() {
  const { session } = useAuth();
  return session && session.attendanceAccess !== "none" ? <Outlet /> : <NotAvailable message="Attendance is not available for your account." />;
}

/** Leave and check-in are for people who work here. The super admin is an admin account only and has neither. */
export function RequireOwnWork() {
  const { session } = useAuth();
  return session?.role === "superadmin" ? <NotAvailable message="The super admin account has no leave or attendance of its own. Use the Super admin page to save them for employees." /> : <Outlet />;
}

/** Only the super admin sees the super admin page. */
export function RequireSuperadmin() {
  const { session } = useAuth();
  return session?.role === "superadmin" ? <Outlet /> : <NotAvailable message="Only the super admin can open this page." />;
}

/** HR, the PM and the super admin see the team attendance page. */
export function RequireAttendanceManager() {
  const { session } = useAuth();
  return ["superadmin", "hr", "pm"].includes(session?.attendanceAccess ?? "") ? <Outlet /> : <NotAvailable message="Only HR, project managers and the super admin can see team attendance." />;
}

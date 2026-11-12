// Route guards. They only decide what to show; the backend enforces the real permissions.
import { Navigate, Outlet, useLocation } from "react-router";
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

/** Only HR sees the admin pages (the backend allows only the HR role as well). */
export function RequireHr() {
  const { session } = useAuth();
  return session?.role === "hr" ? <Outlet /> : <Navigate to="/chat" replace />;
}

/** Everyone except the CEO and the CTO has an attendance section. */
export function RequireAttendance() {
  const { session } = useAuth();
  return session && session.attendanceAccess !== "none" ? <Outlet /> : <Navigate to="/chat" replace />;
}

/** HR and the PM see the team attendance page. */
export function RequireAttendanceManager() {
  const { session } = useAuth();
  return session?.attendanceAccess === "hr" || session?.attendanceAccess === "pm" ? <Outlet /> : <Navigate to="/attendance" replace />;
}

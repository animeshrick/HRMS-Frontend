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

import { Navigate, Route, Routes } from "react-router";
import { Layout } from "../components/Layout";
import { AdminPage } from "../routes/AdminPage";
import { AttendancePage } from "../routes/AttendancePage";
import { AttendanceTeamPage } from "../routes/AttendanceTeamPage";
import { DowntimePage } from "../routes/DowntimePage";
import { PageDowntimeGuard } from "../components/PageDowntimeGuard";
import { DocumentsPage } from "../routes/DocumentsPage";
import { PayslipsPage } from "../routes/PayslipsPage";
import { HomePage } from "../routes/HomePage";
import { SuperadminPage } from "../routes/SuperadminPage";
import { ApprovalsPage } from "../routes/ApprovalsPage";
import { ChangePasswordPage } from "../routes/ChangePasswordPage";
import { ChatPage } from "../routes/ChatPage";
import { LeavePage } from "../routes/LeavePage";
import { WfhPage } from "../routes/WfhPage";
import { LoginPage } from "../routes/LoginPage";
import { NotFoundPage } from "../routes/NotFoundPage";
import { ProfilePage } from "../routes/ProfilePage";
import { RequireAttendance, RequireAttendanceManager, RequireHr, RequireLogin, RequireOwnWork, RequireSuperadmin } from "./RouteGuards";

// Planned maintenance switch. Set VITE_DOWNTIME=true in .env (or .env.local) to take the whole
// app offline for every visitor, logged in or not, without touching any route or guard below.
const DOWNTIME = String(import.meta.env.VITE_DOWNTIME ?? "")
  .trim()
  .toLowerCase() === "true";

export function App() {
  if (DOWNTIME) {
    return <DowntimePage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireLogin />}>
        <Route element={<Layout />}>
          <Route path="/home" element={<PageDowntimeGuard pageKey="home"><HomePage /></PageDowntimeGuard>} />
          <Route path="/chat" element={<PageDowntimeGuard pageKey="chat"><ChatPage /></PageDowntimeGuard>} />
          <Route path="/documents" element={<PageDowntimeGuard pageKey="documents"><DocumentsPage /></PageDowntimeGuard>} />
          <Route element={<RequireOwnWork />}>
            <Route path="/leave" element={<PageDowntimeGuard pageKey="leave_and_wfh"><LeavePage /></PageDowntimeGuard>} />
            <Route path="/wfh" element={<PageDowntimeGuard pageKey="leave_and_wfh"><WfhPage /></PageDowntimeGuard>} />
            <Route path="/payslips" element={<PageDowntimeGuard pageKey="payslips"><PayslipsPage /></PageDowntimeGuard>} />
          </Route>
          <Route path="/approvals" element={<PageDowntimeGuard pageKey="approvals"><ApprovalsPage /></PageDowntimeGuard>} />
          <Route element={<RequireAttendance />}>
            <Route element={<RequireOwnWork />}>
              <Route path="/attendance" element={<PageDowntimeGuard pageKey="attendance"><AttendancePage /></PageDowntimeGuard>} />
            </Route>
            <Route element={<RequireAttendanceManager />}>
              <Route path="/attendance/team" element={<PageDowntimeGuard pageKey="attendance"><AttendanceTeamPage /></PageDowntimeGuard>} />
            </Route>
          </Route>
          <Route path="/me" element={<PageDowntimeGuard pageKey="me"><ProfilePage /></PageDowntimeGuard>} />
          {/* Deliberately never gated by downtime - a forced password change must never be locked out, same as the backend. */}
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<RequireHr />}>
            <Route path="/admin" element={<PageDowntimeGuard pageKey="admin"><AdminPage /></PageDowntimeGuard>} />
          </Route>
          <Route element={<RequireSuperadmin />}>
            <Route path="/superadmin" element={<PageDowntimeGuard pageKey="superadmin"><SuperadminPage /></PageDowntimeGuard>} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

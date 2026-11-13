import { Navigate, Route, Routes } from "react-router";
import { Layout } from "../components/Layout";
import { AdminPage } from "../routes/AdminPage";
import { AttendancePage } from "../routes/AttendancePage";
import { AttendanceTeamPage } from "../routes/AttendanceTeamPage";
import { DowntimePage } from "../routes/DowntimePage";
import { HomePage } from "../routes/HomePage";
import { SuperadminPage } from "../routes/SuperadminPage";
import { ApprovalsPage } from "../routes/ApprovalsPage";
import { ChangePasswordPage } from "../routes/ChangePasswordPage";
import { ChatPage } from "../routes/ChatPage";
import { LeavePage } from "../routes/LeavePage";
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
          <Route path="/home" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route element={<RequireOwnWork />}>
            <Route path="/leave" element={<LeavePage />} />
          </Route>
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route element={<RequireAttendance />}>
            <Route element={<RequireOwnWork />}>
              <Route path="/attendance" element={<AttendancePage />} />
            </Route>
            <Route element={<RequireAttendanceManager />}>
              <Route path="/attendance/team" element={<AttendanceTeamPage />} />
            </Route>
          </Route>
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<RequireHr />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route element={<RequireSuperadmin />}>
            <Route path="/superadmin" element={<SuperadminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

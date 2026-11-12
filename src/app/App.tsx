import { Navigate, Route, Routes } from "react-router";
import { Layout } from "../components/Layout";
import { AdminPage } from "../routes/AdminPage";
import { AttendancePage } from "../routes/AttendancePage";
import { AttendanceTeamPage } from "../routes/AttendanceTeamPage";
import { ApprovalsPage } from "../routes/ApprovalsPage";
import { ChangePasswordPage } from "../routes/ChangePasswordPage";
import { ChatPage } from "../routes/ChatPage";
import { LeavePage } from "../routes/LeavePage";
import { LoginPage } from "../routes/LoginPage";
import { NotFoundPage } from "../routes/NotFoundPage";
import { ProfilePage } from "../routes/ProfilePage";
import { RequireAttendance, RequireAttendanceManager, RequireHr, RequireLogin } from "./RouteGuards";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireLogin />}>
        <Route element={<Layout />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route element={<RequireAttendance />}>
            <Route path="/attendance" element={<AttendancePage />} />
            <Route element={<RequireAttendanceManager />}>
              <Route path="/attendance/team" element={<AttendanceTeamPage />} />
            </Route>
          </Route>
          <Route path="/me" element={<ProfilePage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route element={<RequireHr />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

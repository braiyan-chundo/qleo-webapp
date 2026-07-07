import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage';
import { MyTasksPage } from '@/features/tasks/pages/MyTasksPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { UsersAdminPage } from '@/features/users/pages/UsersAdminPage';
import { AuditLogPage } from '@/features/audit/pages/AuditLogPage';
import { HolidaysAdminPage } from '@/features/work-calendar/pages/HolidaysAdminPage';
import { SessionGate } from '@/shared/components/SessionGate';
import { AdminRoute } from '@/shared/components/AdminRoute';
import { AuthLayout } from '@/shared/layouts/AuthLayout';
import { AppLayout } from '@/shared/layouts/AppLayout';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<SessionGate />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route
                path="/projects/:id/tasks/:taskId"
                element={<TaskDetailPage />}
              />
              <Route path="/tasks" element={<MyTasksPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />

              {/* Área de administración (solo ADMIN) */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<UsersAdminPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/calendar" element={<HolidaysAdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;


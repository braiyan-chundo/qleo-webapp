import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage';
import { MyTasksPage } from '@/features/tasks/pages/MyTasksPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { HelpPage } from '@/features/help/pages/HelpPage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { UsersAdminPage } from '@/features/users/pages/UsersAdminPage';
import { AuditLogPage } from '@/features/audit/pages/AuditLogPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { HolidaysAdminPage } from '@/features/work-calendar/pages/HolidaysAdminPage';
import { SessionGate } from '@/shared/components/SessionGate';
import { PublicOnlyRoute } from '@/shared/components/PublicOnlyRoute';
import { AdminRoute } from '@/shared/components/AdminRoute';
import { AuthLayout } from '@/shared/layouts/AuthLayout';
import { AppLayout } from '@/shared/layouts/AppLayout';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { NotFoundPage } from '@/shared/components/NotFoundPage';
import { useThemeColorMeta } from '@/shared/hooks/use-theme-color-meta';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

function App() {
  // Sincroniza la barra del SO con el tema activo (QL-47).
  useThemeColorMeta();

  return (
    <TooltipProvider>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            {/* Rutas públicas: con sesión activa redirigen a la ruta previa o al inicio (QL-49). */}
            <Route element={<PublicOnlyRoute />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
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
                <Route path="/help" element={<HelpPage />} />
                {/* Analíticas (QL-66): autenticada; overview solo ADMIN, por-proyecto
                    ADMIN o creador (el backend autoriza). El acceso del menú es adminOnly. */}
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Área de administración (solo ADMIN) */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<UsersAdminPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />
                  <Route path="/calendar" element={<HolidaysAdminPage />} />
                </Route>
              </Route>
            </Route>

            {/* Ruta comodín: 404 de marca (QL-50). */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  );
}

export default App;


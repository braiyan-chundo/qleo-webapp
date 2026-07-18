import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { WallPage } from '@/features/wall/pages/WallPage';
import { ProjectsPage } from '@/features/projects/pages/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/pages/ProjectDetailPage';
import { MyTasksPage } from '@/features/tasks/pages/MyTasksPage';
import { TaskDetailPage } from '@/features/tasks/pages/TaskDetailPage';
import { TaskRedirectPage } from '@/features/tasks/pages/TaskRedirectPage';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { HelpPage } from '@/features/help/pages/HelpPage';
import { NotificationsPage } from '@/features/notifications/pages/NotificationsPage';
import { UsersAdminPage } from '@/features/users/pages/UsersAdminPage';
import { AdminSettingsPage } from '@/features/admin/pages/AdminSettingsPage';
import { AuditLogPage } from '@/features/audit/pages/AuditLogPage';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { CalendarPage } from '@/features/work-calendar/pages/CalendarPage';
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
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              </Route>
            </Route>

            <Route element={<SessionGate />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                {/* Muro Corporativo en ruta propia (QL-95, D-K1). */}
                <Route path="/muro" element={<WallPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route
                  path="/projects/:id/tasks/:taskId"
                  element={<TaskDetailPage />}
                />
                <Route path="/tasks" element={<MyTasksPage />} />
                {/* Resolutor de push `/tasks/:taskId` → ruta anidada real (§3.10/§3.17).
                    Va antes del comodín `*`; distinto segmento que `/tasks`, no colisiona. */}
                <Route path="/tasks/:taskId" element={<TaskRedirectPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
                {/* Analíticas (QL-66): autenticada; overview solo ADMIN, por-proyecto
                    ADMIN o creador (el backend autoriza). El acceso del menú es adminOnly. */}
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                {/* Calendario (QL-162): autenticado. La página se ramifica por rol —el MEMBER ve
                    su calendario de solo lectura; el ADMIN, la administración con sus secciones. El
                    menú ya no es `adminOnly`. */}
                <Route path="/calendar" element={<CalendarPage />} />

                {/* Área de administración (solo ADMIN) */}
                <Route element={<AdminRoute />}>
                  {/* QL-165: sub-secciones del Calendario ADMIN como sub-rutas (antes `?tab=`), para
                      que el resaltado del sidebar case por `pathname`. Un MEMBER que entre queda
                      redirigido por el guard. Todas montan `CalendarPage` (rama ADMIN). */}
                  <Route path="/calendar/festivos" element={<CalendarPage />} />
                  <Route path="/calendar/turnos" element={<CalendarPage />} />
                  <Route path="/calendar/mallas" element={<CalendarPage />} />
                  <Route path="/admin" element={<UsersAdminPage />} />
                  {/* QL-149: Configuración (tabs; hoy solo el catálogo de Etiquetas). */}
                  <Route
                    path="/admin/configuracion"
                    element={<AdminSettingsPage />}
                  />
                  <Route path="/audit" element={<AuditLogPage />} />
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


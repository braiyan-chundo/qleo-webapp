import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
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
import { AiPage } from '@/features/ai/pages/AiPage';
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
import { QleoLoader } from '@/shared/components/QleoLoader';

// (HU-0202) Recordatorios en su propio chunk: el bundle principal ya roza el límite de 2 MiB del
// precache del service worker (`injectManifest`). El chunk se precachea igual: funciona sin red.
const RemindersPage = lazy(() =>
  import('@/features/reminders/pages/RemindersPage').then((m) => ({ default: m.RemindersPage })),
);

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
                {/* Recordatorios personales (HU-0202): toda cuenta autenticada, sin gate de rol
                    (D-15). La push de un recordatorio sin tarea abre esta ruta (§3.74 §6). */}
                <Route
                  path="/recordatorios"
                  element={
                    <Suspense
                      fallback={
                        <div className="flex justify-center p-8">
                          <QleoLoader />
                        </div>
                      }
                    >
                      <RemindersPage />
                    </Suspense>
                  }
                />
                {/* Panel de IA (QL-190): autenticado; el acceso lo gatea `GET /ai/status`
                    (canal `canUseAi`; ADMIN y Dirección siempre pasan, QL-195). El nav se oculta
                    con `canUseAi()`, pero la seguridad real la impone el `AiAccessGuard`. */}
                <Route path="/ia" element={<AiPage />} />
                {/* Resolutor de push `/tasks/:taskId` → ruta anidada real (§3.10/§3.17).
                    Va antes del comodín `*`; distinto segmento que `/tasks`, no colisiona. */}
                <Route path="/tasks/:taskId" element={<TaskRedirectPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/help" element={<HelpPage />} />
                {/* Analíticas (QL-66): autenticada; el resumen global es del área de
                    administración —ADMIN o Dirección (QL-195)— y el por-proyecto además del
                    creador (el backend autoriza). El acceso del menú es adminOnly. */}
                <Route path="/analytics" element={<AnalyticsPage />} />
                {/* (QL-200, §3.72 §6) El push de las alertas de gestión de PERSONA abre
                    `/analytics/users` — la ruta de la API, no la del front. El click in-app ya se
                    traduce en `notification-nav`, pero el push lo abre el service worker
                    directamente contra el origen: sin este alias, tocar la notificación desde el
                    móvil aterriza en el 404. */}
                <Route
                  path="/analytics/users"
                  element={<Navigate to="/analytics" replace />}
                />
                <Route path="/notifications" element={<NotificationsPage />} />
                {/* Calendario (QL-162): **ruta única** autenticada. La página se ramifica por rol —el
                    MEMBER ve su calendario de solo lectura; administración/Dirección, la gestión con sus
                    secciones en **tabs** (`?tab=`, dentro de la misma ruta). Se revirtieron las
                    sub-rutas `/calendar/festivos|turnos|mallas` de QL-165. */}
                <Route path="/calendar" element={<CalendarPage />} />

                {/* Área de administración: ADMIN o Dirección (QL-195, ver `AdminRoute`) */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<UsersAdminPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />
                </Route>

                {/* QL-149: Configuración (tabs: Etiquetas, Perfiles de permisos, Avatares,
                    Conexión IA). (QL-198b) Además de Dirección, la abre quien tenga
                    `LABEL_MANAGE` delegado —el permiso habilita curar el catálogo de Etiquetas,
                    que vive aquí—; la página filtra sus tabs, así que un delegado solo ve esa. */}
                <Route element={<AdminRoute allowWithPermission="LABEL_MANAGE" />}>
                  <Route
                    path="/admin/configuracion"
                    element={<AdminSettingsPage />}
                  />
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


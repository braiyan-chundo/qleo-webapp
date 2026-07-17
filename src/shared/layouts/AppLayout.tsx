import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/shared/components/AppSidebar';
import { BottomNav } from '@/shared/components/BottomNav';
import { PushNotificationBanner } from '@/features/push/components/PushNotificationBanner';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { GlobalSearch } from '@/features/search/components/GlobalSearch';
import { LogOut, UserCircle } from 'lucide-react';
import { AuthedAvatar, identityAvatarFallback } from '@/shared/components/AuthedAvatar';
import { QleoLogo } from '@/shared/components/QleoLogo';
import { getDailySlogan } from '@/shared/config/slogans';
import { useAppBadgeSync } from '@/shared/hooks/use-app-badge-sync';
import { useNavHistoryTracker } from '@/shared/hooks/use-nav-history-tracker';
import { useAppUpdateToast, useReportAppVersion } from '@/features/app-version/hooks/use-app-version';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function AppLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Mantiene el badge del icono de la app en sync con los no leídos mientras la PWA está
  // abierta (QL-118); complementa el badge que pinta el service worker con la app cerrada.
  useAppBadgeSync();

  // Registra el historial de navegación interno de la app (QL-140) para que el `BackButton`
  // genérico sepa a dónde volver y qué mostrar en su tooltip. Vive aquí (no en cada página)
  // porque `AppLayout` permanece montado entre rutas del área autenticada.
  useNavHistoryTracker();

  // (QL-148) Reporta `__APP_VERSION__` al backend una vez por carga (con sesión válida) para que
  // publique el aviso de nueva versión en el muro. Vive aquí porque `AppLayout` solo se monta con
  // sesión (dentro de `SessionGate`) y permanece montado en toda el área autenticada.
  useReportAppVersion();
  // (QL-148) Si venimos de pulsar "Actualizar", confirma con un toast que el build nuevo ya cargó.
  useAppUpdateToast();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background text-on-background font-body-md antialiased overflow-hidden">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
          {/* TopNavBar */}
          <header className="glass flex justify-between items-center w-full px-6 py-4 z-40 border-b border-outline-variant/30 elevation-1 sticky top-0">
            <div className="flex items-center gap-4 flex-1">
              {/* Sidebar Trigger — solo desktop (en móvil se navega con el bottom nav) */}
              <SidebarTrigger className="text-on-surface-variant hover:bg-surface-container-low w-10 h-10 hidden md:inline-flex" />

              {/* Logo compacto + eslogan del día — solo móvil (QL-56; en desktop viven en el
                  sidebar). El eslogan se trunca para no empujar las acciones de la derecha. */}
              <div className="flex min-w-0 flex-col md:hidden">
                <QleoLogo
                  beta
                  size={24}
                  className="shrink-0 text-primary dark:text-inverse-primary dark:glow-text"
                  textClassName="text-xl"
                />
                <span className="truncate text-[11px] leading-none text-on-surface-variant">
                  {getDailySlogan()}
                </span>
              </div>

              {/* Buscador global (QL-28): command palette con ⌘K, integrado en la topbar.
                  En md+ la barra ancha; en móvil (QL-33) queda como icono en las acciones. */}
              <div className="hidden flex-1 max-w-md md:block">
                <GlobalSearch />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Buscador compacto (solo móvil, QL-33): icono de lupa que abre el command. */}
              <div className="md:hidden">
                <GlobalSearch variant="icon" />
              </div>
              <ThemeToggle />
              <NotificationBell />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <AuthedAvatar
                    avatarDownloadUrl={user?.avatarDownloadUrl}
                    avatarUrl={user?.avatarUrl}
                    name={user?.name ?? 'Usuario'}
                    className="w-10 h-10 border border-outline-variant/50 cursor-pointer hover:ring-2 ring-primary/20 transition-all"
                    fallbackClassName={identityAvatarFallback}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm">
                  <DropdownMenuLabel className="font-bold text-on-surface">{user?.name || 'Usuario'}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-outline-variant/30" />
                  <DropdownMenuItem
                    onSelect={() => navigate('/profile')}
                    className="cursor-pointer rounded-lg"
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    Mi cuenta
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-outline-variant/30" />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setLogoutOpen(true);
                    }}
                    className="text-error focus:text-error focus:bg-error-container/20 cursor-pointer rounded-lg"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se cerrará tu sesión actual y volverás al inicio de sesión.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleLogout}>
                      Cerrar sesión
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </header>

          {/* Banner de notificaciones desactivadas (QL-46): tope del área autenticada. */}
          <PushNotificationBanner />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
            <Outlet />
          </main>

          {/* Bottom navigation (solo móvil, QL-22) */}
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}

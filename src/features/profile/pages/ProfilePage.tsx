import { Bell, KeyRound, Palette, SlidersHorizontal, UserCog } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

import { useMyProfile } from '../hooks/use-profile';
import { ProfileInfoForm } from '../components/ProfileInfoForm';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { NotificationsSettings } from '../components/NotificationsSettings';
import { ThemePreference } from '../components/ThemePreference';

/**
 * Página "Mi cuenta" (QL-26, §3.15; rediseño QL-34). En desktop, dos columnas: datos del
 * perfil (izq) y cambio de contraseña (der), con una tarjeta de preferencias
 * (notificaciones push + tema) debajo a lo ancho. En móvil todo se apila. El dato del
 * servidor vive en la caché de TanStack Query (`useMyProfile`); no hay estado de servidor
 * en Zustand (solo se refresca la sesión).
 */
export function ProfilePage() {
  const { data: user, isLoading, isError, error } = useMyProfile();

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-on-surface">Mi cuenta</h1>
        <p className="mt-1 text-on-surface-variant">
          Gestiona tus datos de perfil, tu contraseña y tus preferencias.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : isError || !user ? (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error instanceof Error
            ? error.message
            : 'No se pudo cargar tu perfil.'}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fila principal: datos + contraseña en 2 columnas (apiladas en móvil). */}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2">
                <UserCog className="size-5 text-on-surface-variant" />
                <h2 className="text-lg font-semibold text-on-surface">
                  Datos del perfil
                </h2>
              </div>
              <ProfileInfoForm user={user} />
            </section>

            <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
              <div className="mb-5 flex items-center gap-2">
                <KeyRound className="size-5 text-on-surface-variant" />
                <h2 className="text-lg font-semibold text-on-surface">
                  Cambiar contraseña
                </h2>
              </div>
              <ChangePasswordForm />
            </section>
          </div>

          {/* Preferencias: notificaciones push + tema (QL-34). */}
          <section className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-on-surface-variant" />
              <h2 className="text-lg font-semibold text-on-surface">
                Preferencias
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-on-surface-variant" />
                  <h3 className="text-sm font-semibold text-on-surface">
                    Notificaciones
                  </h3>
                </div>
                <NotificationsSettings />
              </div>

              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-on-surface-variant" />
                  <h3 className="text-sm font-semibold text-on-surface">
                    Apariencia
                  </h3>
                </div>
                <ThemePreference />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

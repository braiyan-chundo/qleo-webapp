import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { analyticsKeys } from '@/features/analytics/hooks/use-analytics';
import { hasAtLeastRole } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

import {
  settingsService,
  type AppSettings,
  type ManagementAlertSettings,
  type UpdateAppSettingsDto,
  type UpdateManagementAlertSettingsDto,
} from '../services/settings.service';

/**
 * Hooks de datos del feature Ajustes (QL-129). Todo dato del servidor pasa por aquí
 * (TanStack Query); los componentes usan estos hooks y nunca llaman al service ni manejan
 * loading/error a mano.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const settingsKeys = {
  all: ['settings'] as const,
  app: () => [...settingsKeys.all, 'app'] as const,
  /** (QL-200) Umbrales de las alertas de gestión (`/settings/management-alerts`, Dirección). */
  managementAlerts: () => [...settingsKeys.all, 'management-alerts'] as const,
};

/**
 * Ajustes globales de la app. Es un dato que cambia muy de vez en cuando (un ADMIN edita el
 * correo de soporte cada mucho) → `staleTime` generoso para no refetchear en cada visita a
 * la Ayuda. El consumidor cae al `DEFAULT_SUPPORT_EMAIL` mientras carga o si falla.
 */
export function useAppSettings() {
  return useQuery({
    queryKey: settingsKeys.app(),
    queryFn: () => settingsService.get(),
    staleTime: 60 * 60 * 1000,
  });
}

/** Actualiza los ajustes (solo ADMIN) e invalida la query para que la UI refleje el valor. */
export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateAppSettingsDto) => settingsService.update(dto),
    onSuccess: (settings: AppSettings) => {
      // El PATCH ya devuelve el settings actualizado: se siembra la caché para que el valor
      // nuevo se pinte al instante y se invalida para reconciliar con el servidor.
      queryClient.setQueryData(settingsKeys.app(), settings);
      queryClient.invalidateQueries({ queryKey: settingsKeys.app() });
      toast.success('Correo de soporte actualizado.');
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo actualizar el correo de soporte.',
      );
    },
  });
}

/**
 * (QL-200, §3.72 §4) Umbrales de las alertas de gestión. **Solo Dirección** (403 para un MEMBER),
 * así que la query ni se lanza sin ese rol: el backend protege igual, pero pedirla desde un
 * MEMBER sería un 403 garantizado por cada montaje.
 *
 * La consume la pantalla de umbrales **y también** la tabla de rendimiento, que necesita
 * `complianceMinSample` para poder decir *"2 de 5 compromisos necesarios"*. `staleTime` generoso:
 * es configuración que se toca muy de vez en cuando.
 */
export function useManagementAlertSettings() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: settingsKeys.managementAlerts(),
    queryFn: () => settingsService.getManagementAlerts(),
    enabled: !!token && hasAtLeastRole(user, 'MANAGER'),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * (QL-200) Guarda (parcialmente) los umbrales. **Solo Dirección.**
 *
 * Invalida además `analyticsKeys.users()` y no por costumbre: `complianceMinSample` es el mismo
 * listón que decide `complianceReliable` en `GET /analytics/users`, así que subirlo o bajarlo
 * cambia **qué filas de la tabla de rendimiento enseñan porcentaje y cuáles dicen "sin datos
 * suficientes"**. Sin esta invalidación, Dirección sube el mínimo, vuelve a Analíticas y ve la
 * tabla anterior — que ahora miente.
 */
export function useUpdateManagementAlertSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateManagementAlertSettingsDto) =>
      settingsService.updateManagementAlerts(dto),
    onSuccess: (settings: ManagementAlertSettings) => {
      queryClient.setQueryData(settingsKeys.managementAlerts(), settings);
      queryClient.invalidateQueries({ queryKey: settingsKeys.managementAlerts() });
      queryClient.invalidateQueries({ queryKey: analyticsKeys.users() });
      toast.success('Umbrales de alertas actualizados.');
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'No se pudieron actualizar los umbrales.',
      );
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  settingsService,
  type AppSettings,
  type UpdateAppSettingsDto,
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

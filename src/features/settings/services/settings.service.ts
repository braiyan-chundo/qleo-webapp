import { api } from '@/core/api/fetch-client';

/**
 * Servicio del feature Ajustes (QL-129). Configuración **global** de la app (singleton):
 * la lee cualquier autenticado y solo un ADMIN la edita. Devuelve `T` directo (el
 * fetch-client ya desenvuelve `{ success, data }` y maneja el 401 global).
 */

/**
 * Correo de soporte por defecto. Es el mismo default que aplica el backend cuando aún no se
 * ha guardado ningún ajuste; el front lo replica para tener **siempre** una dirección que
 * mostrar mientras la query carga o si falla — la sección de Soporte nunca puede quedarse
 * sin correo de contacto.
 */
export const DEFAULT_SUPPORT_EMAIL = 'sistemas@viajeshappy.com.co';

/** Ajustes globales de la app (`GET /settings`, cualquier autenticado). */
export interface AppSettings {
  /** Dirección a la que escribe el equipo desde Ayuda › Soporte. */
  supportEmail: string;
}

/** Body parcial de `PATCH /settings` (solo ADMIN; 403 si no). */
export type UpdateAppSettingsDto = Partial<AppSettings>;

export const settingsService = {
  /** Ajustes globales. Accesible a cualquier autenticado. */
  get: (): Promise<AppSettings> => api.get<AppSettings>('/settings'),

  /** Actualiza los ajustes (solo ADMIN). Devuelve el settings ya actualizado. */
  update: (dto: UpdateAppSettingsDto): Promise<AppSettings> =>
    api.patch<AppSettings>('/settings', dto),
};

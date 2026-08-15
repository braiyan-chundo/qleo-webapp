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

/**
 * (QL-200, §3.72 §4) Umbrales de las **alertas de gestión**. Viven en una ruta **aparte** de
 * `GET /settings` a propósito: esa lectura está abierta a cualquier autenticado (es el correo de
 * soporte) y el listón de cumplimiento es materia de Dirección. Los dos verbos exigen `MANAGER`+.
 */
export interface ManagementAlertSettings {
  /** **Kill switch** de TODAS las alertas de gestión. En `false` el cron no emite ninguna. */
  enabled: boolean;
  /** Pendientes a partir de las cuales se avisa de acumulación (`>=`). */
  pendingThreshold: number;
  /** % de cumplimiento por debajo del cual se avisa (`<`). */
  complianceThreshold: number;
  /**
   * Muestra mínima para fiarse del %. **Un solo listón, dos superficies**: es el mismo número
   * que decide `complianceReliable` en `GET /analytics/users`, así que subirlo hace que la tabla
   * de rendimiento diga "sin datos suficientes" en más filas *y* que el cron deje de alertar
   * sobre ellas.
   */
  complianceMinSample: number;
  /** Incumplimientos dentro de la ventana para considerar reincidencia (`>=`). */
  breachThreshold: number;
  /** Días de la ventana de reincidencia. */
  breachWindowDays: number;
  /** Horas de silencio entre dos avisos de la misma condición sobre la misma persona. */
  cooldownHours: number;
  /** Tope de avisos de "tarea vencida" por barrido; el resto se reparte en los siguientes. */
  maxOverduePerSweep: number;
}

/**
 * Body de `PATCH /settings/management-alerts`: **parcial**, solo se aplican los campos presentes.
 * Los rangos los valida el backend con 400 (ver `managementAlertsSchema`, que los espeja).
 */
export type UpdateManagementAlertSettingsDto = Partial<ManagementAlertSettings>;

export const settingsService = {
  /** Ajustes globales. Accesible a cualquier autenticado. */
  get: (): Promise<AppSettings> => api.get<AppSettings>('/settings'),

  /** Actualiza los ajustes (solo ADMIN). Devuelve el settings ya actualizado. */
  update: (dto: UpdateAppSettingsDto): Promise<AppSettings> =>
    api.patch<AppSettings>('/settings', dto),

  /** (QL-200) Umbrales de las alertas de gestión (**Dirección**; 403 para un MEMBER). */
  getManagementAlerts: (): Promise<ManagementAlertSettings> =>
    api.get<ManagementAlertSettings>('/settings/management-alerts'),

  /** (QL-200) Actualiza (parcialmente) los umbrales. Devuelve el bloque ya actualizado. */
  updateManagementAlerts: (
    dto: UpdateManagementAlertSettingsDto,
  ): Promise<ManagementAlertSettings> =>
    api.patch<ManagementAlertSettings>('/settings/management-alerts', dto),
};

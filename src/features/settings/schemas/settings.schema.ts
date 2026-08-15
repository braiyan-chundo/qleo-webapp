import { z } from 'zod';

/**
 * Schema del formulario de ajustes (QL-129). Hoy solo el correo de soporte, que edita un
 * ADMIN desde Ayuda › Soporte. Mensajes en español (los ve el usuario final).
 */
export const supportEmailSchema = z.object({
  supportEmail: z
    .string()
    .trim()
    .min(1, 'El correo es obligatorio')
    .email('Correo electrónico inválido'),
});

export type SupportEmailFormValues = z.infer<typeof supportEmailSchema>;

/**
 * (QL-200, §3.72 §4) Rangos de cada umbral, **espejo exacto** de los `@Min`/`@Max` del backend
 * (`UpdateManagementAlertSettingsDto`). Se declaran una vez y de aquí salen el `zod`, el `min`/
 * `max` del `<input type="number">` y el texto de ayuda: así el campo, la validación de cliente y
 * el 400 del servidor no pueden decir tres cosas distintas.
 */
export const MANAGEMENT_ALERT_RANGES = {
  pendingThreshold: { min: 1, max: 1000 },
  complianceThreshold: { min: 0, max: 100 },
  complianceMinSample: { min: 1, max: 1000 },
  breachThreshold: { min: 1, max: 1000 },
  breachWindowDays: { min: 1, max: 365 },
  cooldownHours: { min: 1, max: 8760 },
  maxOverduePerSweep: { min: 1, max: 500 },
} as const;

/**
 * Entero acotado, con mensajes en español (los lee Dirección, no un desarrollador).
 *
 * Es `z.number()` y no `z.coerce.number()` a propósito: el campo se registra con
 * `valueAsNumber`, así que a zod ya le llega un número — y `coerce` habría dejado el tipo de
 * entrada del formulario en `unknown`, que es incompatible con el resolver tipado de RHF. Un
 * campo vacío llega como `NaN`, que `z.number()` rechaza con el mensaje de `error`.
 */
function boundedInt(range: { min: number; max: number }) {
  return z
    .number({ error: 'Escribe un número entero' })
    .int('Tiene que ser un número entero')
    .min(range.min, `Mínimo ${range.min}`)
    .max(range.max, `Máximo ${range.max}`);
}

/**
 * (QL-200) Esquema de la pantalla de **umbrales de alertas de gestión**.
 *
 * `enabled` es el **kill switch** y va aquí como un campo más aunque no tenga validación: es la
 * palanca para desplegar en silencio (§3.72 §10 — el primer barrido tras subir el feature avisa
 * de las vencidas del histórico), y sacarlo del formulario lo convertiría en un ajuste oculto.
 */
export const managementAlertsSchema = z.object({
  enabled: z.boolean(),
  pendingThreshold: boundedInt(MANAGEMENT_ALERT_RANGES.pendingThreshold),
  complianceThreshold: boundedInt(MANAGEMENT_ALERT_RANGES.complianceThreshold),
  complianceMinSample: boundedInt(MANAGEMENT_ALERT_RANGES.complianceMinSample),
  breachThreshold: boundedInt(MANAGEMENT_ALERT_RANGES.breachThreshold),
  breachWindowDays: boundedInt(MANAGEMENT_ALERT_RANGES.breachWindowDays),
  cooldownHours: boundedInt(MANAGEMENT_ALERT_RANGES.cooldownHours),
  maxOverduePerSweep: boundedInt(MANAGEMENT_ALERT_RANGES.maxOverduePerSweep),
});

export type ManagementAlertsFormValues = z.infer<typeof managementAlertsSchema>;

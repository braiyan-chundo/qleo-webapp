import * as z from 'zod';

/**
 * Esquemas del flujo "¿Olvidaste tu contraseña?" (OTP por correo, §3.30 de
 * `INTEGRACION_FRONTEND.md`). Un esquema por paso de la página, con mensajes en español.
 * La validación de la contraseña fuerte replica el estándar del backend (mín. 8 con
 * mayúscula, minúscula, número y símbolo) para dar feedback inmediato antes del `confirm`.
 */

/** Mensaje único del estándar de contraseña fuerte (idéntico al del backend). */
export const STRONG_PASSWORD_MESSAGE =
  'La contraseña debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y símbolo.';

/**
 * Requisitos individuales de la contraseña fuerte. Se reutilizan tanto para la validación
 * zod como para el indicador/lista de requisitos en la UI (checklist en vivo).
 */
export const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (v: string) => v.length >= 8 },
  { id: 'uppercase', label: 'Una letra mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'lowercase', label: 'Una letra minúscula', test: (v: string) => /[a-z]/.test(v) },
  { id: 'number', label: 'Un número', test: (v: string) => /[0-9]/.test(v) },
  { id: 'symbol', label: 'Un símbolo (!@#$…)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

/** Un password cumple el estándar fuerte si pasa todos los requisitos. */
const isStrongPassword = (value: string) =>
  PASSWORD_REQUIREMENTS.every((req) => req.test(value));

/** Paso 1: solicitar el código con el correo de la cuenta. */
export const requestResetSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});
export type RequestResetValues = z.infer<typeof requestResetSchema>;

/** Paso 2: validar el OTP de 6 dígitos numéricos. */
export const verifyOtpSchema = z.object({
  code: z
    .string()
    .length(6, 'El código tiene 6 dígitos')
    .regex(/^\d{6}$/, 'El código solo contiene números'),
});
export type VerifyOtpValues = z.infer<typeof verifyOtpSchema>;

/** Paso 3: nueva contraseña fuerte + confirmación que debe coincidir. */
export const newPasswordSchema = z
  .object({
    newPassword: z.string().refine(isStrongPassword, STRONG_PASSWORD_MESSAGE),
    confirmPassword: z.string().min(1, 'Confirma la contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

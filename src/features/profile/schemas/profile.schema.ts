import * as z from 'zod';

/**
 * Esquemas de los formularios de la página "Mi cuenta" (QL-26, §3.15).
 * - Datos del perfil: `name` obligatorio; `jobTitle`/`avatarUrl` opcionales (texto libre;
 *   `avatarUrl` sin subida de imagen, solo URL).
 * - Contraseña: actual requerida + nueva (mín. 6, según el backend) con confirmación.
 */

export const profileFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  jobTitle: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
  /**
   * QL-193 (§3.66): día civil `'YYYY-MM-DD'`, o `''` si no hay fecha. El formulario guarda
   * **la cadena que se enviará**, no un `Date`, para que no haya ninguna conversión a UTC
   * entre lo que el usuario elige y lo que viaja al backend. Las reglas de fondo (no futura,
   * ≥1900) las valida el backend y llegan como `error.code`.
   */
  birthDate: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Introduce tu contraseña actual'),
    newPassword: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

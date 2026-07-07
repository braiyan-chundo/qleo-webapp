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

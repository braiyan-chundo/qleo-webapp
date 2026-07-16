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

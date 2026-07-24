import * as z from 'zod';

/**
 * Esquemas de los formularios de administración de usuarios (§3.2).
 * - Alta: `password` obligatorio (mín. 6, según el backend).
 * - Edición: todos opcionales; `password` opcional (si se deja vacío no se cambia).
 */

const roleEnum = z.enum(['ADMIN', 'MEMBER']);
const statusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email no válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: roleEnum,
  jobTitle: z.string().trim().optional(),
  // QL-127: por defecto un miembro nuevo NO puede crear proyectos (se otorga explícitamente).
  canCreateProjects: z.boolean(),
  // QL-184: permiso de usar el panel de IA. Al revés que arriba, el default es activado.
  canUseAi: z.boolean(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email no válido'),
  role: roleEnum,
  status: statusEnum,
  jobTitle: z.string().trim().optional(),
  // QL-127: permiso de crear proyectos (solo aplica a MEMBER; el ADMIN siempre puede).
  canCreateProjects: z.boolean(),
  // QL-184: permiso de usar el panel de IA (solo aplica a MEMBER; el ADMIN siempre puede).
  canUseAi: z.boolean(),
  // Vacío = no cambiar la contraseña; si viene, debe cumplir el mínimo.
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 6, 'Mínimo 6 caracteres'),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

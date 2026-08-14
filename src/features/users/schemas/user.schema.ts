import * as z from 'zod';

/**
 * Esquemas de los formularios de administración de usuarios (§3.2).
 * - Alta: `password` obligatorio (mín. 6, según el backend).
 * - Edición: todos opcionales; `password` opcional (si se deja vacío no se cambia).
 */

// QL-195 (§3.67): tres roles de plataforma. `MANAGER` se pinta «Dirección» en la UI.
const roleEnum = z.enum(['ADMIN', 'MANAGER', 'MEMBER']);
const statusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email no válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  role: roleEnum,
  jobTitle: z.string().trim().optional(),
  // QL-193 (§3.66): día civil 'YYYY-MM-DD' o '' si no se informa. Se guarda la cadena que se
  // va a enviar (no un `Date`) para que no medie ninguna conversión a UTC. Las reglas de fondo
  // (no futura, ≥1900) las valida el backend vía `error.code`.
  birthDate: z.string().optional(),
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
  // QL-193 (§3.66): día civil 'YYYY-MM-DD'; vacío = borrar la fecha guardada.
  birthDate: z.string().optional(),
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

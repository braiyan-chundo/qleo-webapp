import * as z from 'zod';

/**
 * Esquema del formulario de **perfil de permisos** (QL-198, §3.70).
 *
 * `permissions` NO se valida contra una lista fija a propósito: las claves salen del catálogo que
 * sirve el backend (`GET /permission-profiles/catalog`), que crece. Una clave inventada la rechaza
 * el backend con 400 `PERMISSION_INVALID` — y si eso ocurre es un bug del front (está mandando algo
 * que no salió de `/catalog`), no un error del usuario que un `z.enum` deba tapar.
 *
 * Un perfil **sin permisos es válido** (§3.70 §2): nace vacío y se compone después.
 */
export const permissionProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: z.string().trim().optional(),
  permissions: z.array(z.string()),
  /** Retirado (`false`) = deja de conceder sus permisos a quien ya lo tiene. Solo en edición. */
  active: z.boolean(),
});

export type PermissionProfileFormValues = z.infer<typeof permissionProfileFormSchema>;

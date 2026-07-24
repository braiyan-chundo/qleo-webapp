import type { User } from '@/store/auth.store';

/**
 * Reglas de permiso de **plataforma** derivadas del usuario en sesión. Utilidad compartida
 * (sin lógica de negocio de ningún feature): centraliza expresiones que si no se repetirían
 * en cada consumidor y se desincronizarían al cambiar la regla.
 */

/**
 * ¿El usuario puede crear proyectos? (QL-127)
 *
 * El permiso efectivo es `role === 'ADMIN' || canCreateProjects === true`:
 * - **ADMIN siempre puede**, independientemente del flag. El flag es el permiso que un
 *   administrador concede a un MEMBER, así que a un ADMIN no le aplica y el backend ni lo
 *   consulta para él. Sin esta rama, un ADMIN con el flag en `false` (el default) se
 *   quedaría sin el botón de crear aunque `POST /projects` sí le respondería 201.
 * - Un MEMBER solo puede si un ADMIN se lo otorgó (default `false`).
 *
 * Es la **única fuente** de esta regla en el front; refleja el gate del backend, que
 * responde 403 `PROJECT_CREATE_FORBIDDEN` si no se cumple.
 */
export function canCreateProjects(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN' || !!user?.canCreateProjects;
}

/**
 * ¿El usuario puede usar el **panel de IA**? (QL-184)
 *
 * El permiso efectivo es `role === 'ADMIN' || (canUseAi ?? true)`:
 * - **ADMIN siempre puede**, el flag no le aplica (el backend ni lo consulta para él).
 * - Un MEMBER puede **por defecto**: el default es activado (al revés que `canCreateProjects`).
 *   Solo un ADMIN lo **revoca** explícitamente (`PATCH /users/:id { canUseAi: false }`).
 *
 * El **`?? true`** es deliberado: los usuarios creados antes del campo no lo tienen en Mongo y el
 * backend los resuelve con acceso, así que el front debe tratar la ausencia como `true`.
 *
 * Es la **única fuente** de esta regla en el front; refleja el `AiAccessGuard` del backend, que
 * responde 403 `AI_ACCESS_DENIED` si no se cumple. (El cableado al nav del panel llega en QL-190.)
 */
export function canUseAi(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN' || (user?.canUseAi ?? true);
}

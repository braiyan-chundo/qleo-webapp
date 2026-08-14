import type { User, UserRole } from '@/store/auth.store';

/**
 * Reglas de permiso de **plataforma** derivadas del usuario en sesión. Utilidad compartida
 * (sin lógica de negocio de ningún feature): centraliza expresiones que si no se repetirían
 * en cada consumidor y se desincronizarían al cambiar la regla.
 */

/**
 * QL-195 (§3.67) — **PODER** relativo de los roles de plataforma. ÚNICA definición de la
 * jerarquía en el front.
 *
 * ⚠️ Es un **espejo** de `USER_ROLE_PRECEDENCE` en
 * `qleo-api/src/common/utils/user-role.util.ts`, que es la autoridad real: el `RolesGuard` y
 * todos los servicios del backend deciden con esa tabla. **Si las dos divergen, la UI ofrece
 * acciones que la API rechaza** (o esconde acciones que la API sí permitiría). Es exactamente
 * el fallo que ya ocurrió en QL-192 con la precedencia de los roles POR TAREA
 * (`ROLE_POWER` en `@/features/tasks/lib/roles.ts`, el precedente a imitar): al tocar una,
 * se toca la otra en el mismo cambio.
 */
const USER_ROLE_PRECEDENCE: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
};

/**
 * QL-195 — Etiqueta legible de cada rol de plataforma. `MANAGER` es **«Dirección»** en toda la
 * UI (término pedido por el cliente): nunca «Manager», «Gerente» ni «Administrador Manager».
 */
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Dirección',
  MEMBER: 'Miembro',
};

/**
 * Los roles en orden de mayor a menor poder. Es la lista que recorren los selectores y filtros
 * de rol, para que **añadir un cuarto rol** no exija volver a peinar el repo buscando `<option>`
 * escritos a mano — que es exactamente lo que costó QL-195.
 */
export const USER_ROLES: readonly UserRole[] = ['ADMIN', 'MANAGER', 'MEMBER'];

/**
 * Nivel de un rol que puede llegar como `string` cualquiera. El `user` del store se **persiste
 * en localStorage**, así que una sesión vieja (o de otra versión del producto) puede traer un
 * valor que ya no existe: vale `0`, por debajo de cualquier mínimo exigible ⇒ **fallo seguro**.
 */
function levelOf(role: string | null | undefined): number {
  if (!role) return 0;
  return USER_ROLE_PRECEDENCE[role as UserRole] ?? 0;
}

/**
 * QL-195 — ¿`role` alcanza al menos el nivel de `minimum`? Variante para cuando solo se tiene
 * el **valor del rol** y no el usuario: una fila de la tabla de usuarios, el campo de un
 * formulario. Con un usuario en la mano, usa {@link hasAtLeastRole}.
 */
export function roleIsAtLeast(
  role: UserRole | null | undefined,
  minimum: UserRole,
): boolean {
  return levelOf(role) >= USER_ROLE_PRECEDENCE[minimum];
}

/**
 * QL-195 (§3.67) — ¿El usuario en sesión alcanza al menos el rol `minimum`?
 *
 * Es la pregunta que hay que hacerse en **toda** decisión de permiso por rol de plataforma, en
 * vez de `user.role === 'ADMIN'`: esa igualdad deja a **Dirección** (`MANAGER`) fuera de
 * pantallas que el backend sí le autoriza, y la divergencia entre lo que la UI muestra y lo que
 * la API concede es justo el fallo que QL-195 tenía que evitar.
 *
 * ```ts
 * hasAtLeastRole(user, 'MANAGER'); // true para ADMIN y MANAGER  ← el caso normal
 * hasAtLeastRole(user, 'ADMIN');   // true solo para ADMIN
 * ```
 *
 * `hasAtLeastRole(user, 'ADMIN')` casi nunca es lo correcto. En todo el producto solo quedan
 * **tres** acciones exclusivas de ADMIN: conectar, cancelar la conexión y desconectar la cuenta
 * de ChatGPT (`features/ai`), porque usan la cuenta personal de OpenAI del usuario de sistemas.
 * Todo lo demás —usuarios, auditoría, dashboard, analítica, etiquetas, turnos, mallas,
 * calendario laboral, avatares, ajustes, muro, y en tareas descartar/restaurar/hard-delete— es
 * `'MANAGER'`.
 */
export function hasAtLeastRole(
  user: User | null | undefined,
  minimum: UserRole,
): boolean {
  return roleIsAtLeast(user?.role, minimum);
}

/**
 * ¿El usuario puede crear proyectos? (QL-127)
 *
 * El permiso efectivo es `hasAtLeastRole(user,'MANAGER') || canCreateProjects === true`:
 * - **ADMIN y Dirección siempre pueden**, independientemente del flag. El flag es el permiso
 *   que se concede a un MEMBER, así que a ellos no les aplica y el backend ni lo consulta.
 *   Sin esta rama, un ADMIN con el flag en `false` (el default) se quedaría sin el botón de
 *   crear aunque `POST /projects` sí le respondería 201.
 * - Un MEMBER solo puede si se lo otorgaron (default `false`).
 *
 * (QL-195) El *bypass* se abrió a Dirección junto con el resto de permisos de administración.
 *
 * Es la **única fuente** de esta regla en el front; refleja el gate del backend, que
 * responde 403 `PROJECT_CREATE_FORBIDDEN` si no se cumple.
 */
export function canCreateProjects(user: User | null | undefined): boolean {
  return hasAtLeastRole(user, 'MANAGER') || !!user?.canCreateProjects;
}

/**
 * ¿El usuario puede usar el **panel de IA**? (QL-184)
 *
 * El permiso efectivo es `hasAtLeastRole(user,'MANAGER') || (canUseAi ?? true)`:
 * - **ADMIN y Dirección siempre pueden**, el flag no les aplica (el backend ni lo consulta).
 * - Un MEMBER puede **por defecto**: el default es activado (al revés que `canCreateProjects`).
 *   Solo se **revoca** explícitamente (`PATCH /users/:id { canUseAi: false }`).
 *
 * El **`?? true`** es deliberado: los usuarios creados antes del campo no lo tienen en Mongo y el
 * backend los resuelve con acceso, así que el front debe tratar la ausencia como `true`.
 *
 * (QL-195) El *bypass* se abrió a Dirección. Ojo: esto es el acceso al **panel de IA**, que no
 * tiene nada que ver con enlazar la cuenta de ChatGPT — eso sigue siendo solo de ADMIN.
 *
 * Es la **única fuente** de esta regla en el front; refleja el `AiAccessGuard` del backend, que
 * responde 403 `AI_ACCESS_DENIED` si no se cumple. (El cableado al nav del panel llega en QL-190.)
 */
export function canUseAi(user: User | null | undefined): boolean {
  return hasAtLeastRole(user, 'MANAGER') || (user?.canUseAi ?? true);
}

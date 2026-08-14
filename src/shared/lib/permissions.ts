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
 * QL-198 (§3.70) — Claves del catálogo de permisos de plataforma **a las que el front
 * reacciona**. NO es el catálogo: el catálogo lo sirve `GET /permission-profiles/catalog` y
 * **seguirá creciendo**, así que el editor de perfiles se renderiza desde ese array y nunca
 * desde esta unión (una casilla hardcodeada se quedaría coja en el siguiente permiso).
 *
 * Esta unión existe solo para que `hasPermission(user, 'WALL_PIN')` no acepte un literal mal
 * escrito en un punto de decisión de la UI. Al añadir un gate nuevo en el front, se añade aquí
 * la clave; hasta entonces el permiso viaja igual en `effectivePermissions` y se puede conceder
 * desde el editor sin tocar este archivo.
 */
export type PlatformPermission =
  | 'PROJECT_CREATE'
  | 'AI_USE'
  | 'TASK_DISCARD'
  | 'LABEL_MANAGE'
  | 'WALL_PIN';

/**
 * QL-198 (§3.70) — Permiso efectivo de plataforma, **leído** de `user.effectivePermissions`.
 *
 * El backend lo calcula con la misma función que usan sus guards (`rol ⊇ catálogo` para
 * ADMIN/Dirección; `flag individual ∪ permisos del perfil activo` para un MEMBER). **No
 * reimplementes esa fórmula**: es exactamente el fallo de QL-192 —dos copias de una regla que
 * divergen— y aquí acabaría ofreciendo botones que la API responde con 403.
 *
 * El *fallback* cubre un caso real y acotado: el `user` del store se **persiste en
 * localStorage**, así que una sesión abierta antes de QL-198 no trae el array hasta el primer
 * `GET /auth/me`. Mientras tanto se resuelve con la expresión anterior a QL-198, que es correcta
 * para un usuario **sin perfil** (§0 del contrato) — y sin perfil están todos hasta que Dirección
 * cree el primero. Los tres permisos de QL-198b caen a `false`: nunca existieron como flag suelto,
 * así que no hay nada heredado que respetar.
 */
export function hasPermission(
  user: User | null | undefined,
  permission: PlatformPermission,
): boolean {
  const effective = user?.effectivePermissions;
  if (Array.isArray(effective)) return effective.includes(permission);

  if (hasAtLeastRole(user, 'MANAGER')) return true;
  if (permission === 'PROJECT_CREATE') return !!user?.canCreateProjects;
  if (permission === 'AI_USE') return user?.canUseAi ?? true;
  return false;
}

/**
 * ¿El usuario puede crear proyectos? (QL-127)
 *
 * (QL-198, §3.70) Ahora es `effectivePermissions.includes('PROJECT_CREATE')`: el permiso puede
 * venir del **rol** (ADMIN/Dirección lo tienen siempre), del **flag individual**
 * (`canCreateProjects`, que no se migró ni se retiró) o del **perfil** asignado — y los tres
 * suman. La expresión antigua (`rol || flag`) seguía acertando mientras nadie tuviera perfil,
 * pero empieza a mentir en cuanto Dirección crea el primero.
 *
 * Es la **única fuente** de esta regla en el front; refleja el gate del backend, que
 * responde 403 `PROJECT_CREATE_FORBIDDEN` si no se cumple.
 */
export function canCreateProjects(user: User | null | undefined): boolean {
  return hasPermission(user, 'PROJECT_CREATE');
}

/**
 * ¿El usuario puede usar el **panel de IA**? (QL-184)
 *
 * (QL-198, §3.70) Ahora es `effectivePermissions.includes('AI_USE')`. Ojo con el default
 * invertido de `canUseAi` (`?? true`): resolverlo a mano con `user.canUseAi ?? false` dejaría
 * sin IA a media plantilla, porque los usuarios anteriores al campo no lo tienen guardado. Con
 * `effectivePermissions` el backend ya lo ha resuelto.
 *
 * Esto es el acceso al **panel de IA**, que no tiene nada que ver con enlazar la cuenta de
 * ChatGPT — eso sigue siendo solo de ADMIN (rol, no permiso).
 *
 * Es la **única fuente** de esta regla en el front; refleja el `AiAccessGuard` del backend, que
 * responde 403 `AI_ACCESS_DENIED` si no se cumple.
 */
export function canUseAi(user: User | null | undefined): boolean {
  return hasPermission(user, 'AI_USE');
}

/**
 * QL-198b (§3.70 §9.2) — ¿Puede curar el **catálogo global de etiquetas**? (renombrar, cambiar
 * icono/color y **archivar**). Alcance global: el catálogo es único y compartido.
 *
 * **Eliminar** una etiqueta NO entra aquí: sigue pidiendo rol `MANAGER`+ porque la arrastra en
 * cascada fuera de todos los proyectos y tareas que la usaban y no hay deshacer. Archivar es la
 * vía reversible y sí está delegada, así que el delegado no se queda a medias.
 */
export function canManageLabels(user: User | null | undefined): boolean {
  return hasPermission(user, 'LABEL_MANAGE');
}

/**
 * QL-198b (§3.70 §9.3) — ¿Puede **fijar/desfijar** mensajes del Muro? Alcance global. No
 * habilita editar ni borrar mensajes ajenos (eso sigue siendo del autor / del rol) y no dispara
 * ninguna notificación.
 */
export function canPinWallMessages(user: User | null | undefined): boolean {
  return hasPermission(user, 'WALL_PIN');
}

/**
 * QL-198b (§3.70 §9.1) — ¿Puede **descartar/restaurar** la tarea de `projectId`?
 *
 * Es el primer permiso del catálogo que **no se responde solo con `effectivePermissions`**:
 * tiene **alcance por proyecto**.
 *
 * ```
 * ADMIN / Dirección  →  cualquier tarea (alcance global, como siempre)
 * resto              →  TASK_DISCARD  ∧  ser MIEMBRO del proyecto de la tarea
 * ```
 *
 * `memberProjectIds` sale de `GET /projects`, que para un no-ADMIN ya devuelve **solo** los
 * proyectos donde es miembro (§3.20) — no hace falta endpoint nuevo. Lo sirve
 * `useMyProjectIds()` (`@/features/projects/hooks/use-projects`).
 *
 * **`undefined` = "todavía no sé cuáles son sus proyectos"** y entonces manda el permiso a secas.
 * No es dejadez: en las vistas normales esa respuesta ya es correcta —`GET /tasks`, `/tasks/mine`,
 * `/tasks/:id` y el buscador filtran por membresía, y a un no-miembro le responden 404, así que
 * toda tarea que la API le sirve a un MEMBER está ya en un proyecto suyo—. Tratar el `undefined`
 * como "no" escondería el botón mientras carga la lista, y lo escondería **para siempre** a quien
 * tenga más proyectos de los que cabe en una página. La comprobación de membresía suma cuando se
 * conoce entera: cubre los casos raros (deep link, caché vieja, una vista futura que no filtre).
 *
 * El backend responde 403 `TASK_DISCARD_FORBIDDEN` tanto si falta el permiso como si la tarea es
 * de un proyecto ajeno (no los distingue a propósito, para que el error no sea un oráculo de
 * permisos): trátalo como parte del flujo, enseña el `message` y deja de ofrecer el botón.
 */
export function canDiscardTaskIn(
  user: User | null | undefined,
  projectId: string | undefined,
  memberProjectIds: ReadonlySet<string> | undefined,
): boolean {
  if (hasAtLeastRole(user, 'MANAGER')) return true;
  if (!hasPermission(user, 'TASK_DISCARD')) return false;
  if (!memberProjectIds) return true;
  return !!projectId && memberProjectIds.has(projectId);
}

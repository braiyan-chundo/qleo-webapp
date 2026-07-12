import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/shared/lib/initials';
import { useAuthedAvatar } from '@/shared/hooks/use-authed-avatar';

type AvatarRootProps = ComponentProps<typeof Avatar>;

/**
 * Clase estándar del fallback de **iniciales sobre el color de identidad** (`primary-container`),
 * fuente única para todos los avatares de la app.
 *
 * Contraste correcto en **claro** (texto `on-primary-container`, casi blanco, sobre el azul del
 * contenedor) y aspecto neón intacto en **oscuro** (`dark:text-primary`, se re-afirma el color
 * original → el modo oscuro NO cambia). Antes se usaba `text-primary` también en claro, lo que
 * dejaba iniciales azules sobre fondo azul (ilegibles). Añade el tamaño con una clase extra:
 * `cn(identityAvatarFallback, 'text-xs')`.
 */
export const identityAvatarFallback =
  'bg-primary-container text-on-primary-container dark:text-primary font-bold';

interface AuthedAvatarProps extends Omit<AvatarRootProps, 'children'> {
  /** Proxy privado del avatar SUBIDO (`/users/:id/avatar`); requiere token → fetch+blob. */
  avatarDownloadUrl?: string | null;
  /** Fallback EXTERNO: URL de imagen pública usable directamente en `<img src>`. */
  avatarUrl?: string | null;
  /** Nombre para derivar las iniciales del último fallback. */
  name: string;
  /** Clases extra para el `AvatarFallback` (color del contenedor de iniciales…). */
  fallbackClassName?: string;
}

/**
 * Avatar unificado de Qleo (QL-32, §3.15). Resuelve la fuente de la imagen en **cascada**
 * con la prioridad del contrato:
 *   1. `avatarDownloadUrl` → `fetch` autenticado (token) → `blob:` URL (cacheado por
 *      TanStack Query, revocado al expirar del caché). En loading no rompe; en **404/error**
 *      cae al siguiente fallback.
 *   2. `avatarUrl` (URL externa) → `<img src>` directo.
 *   3. Iniciales derivadas de `name`.
 *
 * Sustituye los `Avatar`/`<img src={avatarUrl}>` sueltos: centraliza el fetch autenticado,
 * el caché del blob y el fallback en toda la app (topbar, comentarios, listas, pickers…).
 */
export function AuthedAvatar({
  avatarDownloadUrl,
  avatarUrl,
  name,
  fallbackClassName,
  ...avatarProps
}: AuthedAvatarProps) {
  const { data: blobUrl, isError } = useAuthedAvatar(avatarDownloadUrl);

  // Cascada: blob del avatar subido → URL externa → iniciales. En 404 la query devuelve
  // `null` (no error); `isError` cubre fallos reales de red — en ambos casos degradamos.
  const resolvedSrc = (!isError && blobUrl) || avatarUrl || undefined;
  const altName = name || 'Usuario';

  return (
    // Los props restantes (incl. los inyectados por `asChild` de un trigger) van al root.
    <Avatar {...avatarProps}>
      {resolvedSrc && <AvatarImage src={resolvedSrc} alt={altName} />}
      <AvatarFallback className={cn(fallbackClassName)}>
        {initials(altName)}
      </AvatarFallback>
    </Avatar>
  );
}

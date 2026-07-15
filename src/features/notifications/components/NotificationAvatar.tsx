import { Bell } from 'lucide-react';

import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { cn } from '@/lib/utils';

import type { NotificationActor } from '../services/notifications.service';

interface NotificationAvatarProps {
  /** Actor humano poblado, o `null` en las notis del sistema (§3.10, `DEADLINE_APPROACHING`). */
  actor: NotificationActor | null;
  className?: string;
}

/**
 * Avatar de una fila de notificación. Muestra el avatar del actor humano, o un icono de
 * sistema (campana) cuando la noti **no tiene actor** (notis automáticas del sistema, §3.10).
 * Iguala el tamaño del `AuthedAvatar size="sm"` (size-6) para no descuadrar la fila.
 */
export function NotificationAvatar({ actor, className }: NotificationAvatarProps) {
  if (!actor) {
    return (
      <span
        aria-hidden
        className={cn(
          'flex size-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant',
          className,
        )}
      >
        <Bell className="size-3.5" />
      </span>
    );
  }

  return (
    <AuthedAvatar
      size="sm"
      className={className}
      avatarDownloadUrl={actor.avatarDownloadUrl}
      avatarUrl={actor.avatarUrl}
      name={actor.name}
    />
  );
}

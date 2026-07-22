import { Bell, ThumbsDown, type LucideIcon } from 'lucide-react';

import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { cn } from '@/lib/utils';

import type { NotificationActor, NotificationType } from '../services/notifications.service';

/**
 * (QL-171) Icono distintivo por tipo, pintado como **insignia** sobre el avatar del actor. Es un
 * mapa **parcial** a propósito: la mayoría de tipos se entienden con el texto y no necesitan
 * adorno; solo se marca lo que conviene reconocer de un vistazo en la campana. Añadir un tipo
 * aquí es todo lo que hace falta para que su fila lo muestre.
 */
const NOTIFICATION_TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = {
  TASK_REVIEW_REJECTED: ThumbsDown,
};

interface NotificationAvatarProps {
  /** Actor humano poblado, o `null` en las notis del sistema (§3.10, `DEADLINE_APPROACHING`). */
  actor: NotificationActor | null;
  /** Tipo de la notificación; decide la insignia de icono (si la hay). */
  type?: NotificationType;
  className?: string;
}

/**
 * Avatar de una fila de notificación. Muestra el avatar del actor humano, o un icono de
 * sistema (campana) cuando la noti **no tiene actor** (notis automáticas del sistema, §3.10).
 * Iguala el tamaño del `AuthedAvatar size="sm"` (size-6) para no descuadrar la fila.
 */
export function NotificationAvatar({ actor, type, className }: NotificationAvatarProps) {
  const TypeIcon = type ? NOTIFICATION_TYPE_ICON[type] : undefined;

  const avatar = !actor ? (
    <span
      aria-hidden
      className={cn(
        'flex size-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant',
        !TypeIcon && className,
      )}
    >
      <Bell className="size-3.5" />
    </span>
  ) : (
    <AuthedAvatar
      size="sm"
      className={TypeIcon ? undefined : className}
      avatarDownloadUrl={actor.avatarDownloadUrl}
      avatarUrl={actor.avatarUrl}
      name={actor.name}
    />
  );

  if (!TypeIcon) return avatar;

  return (
    <span className={cn('relative inline-flex', className)}>
      {avatar}
      <span
        aria-hidden
        className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-error-container text-on-error-container"
      >
        <TypeIcon className="size-2.5" />
      </span>
    </span>
  );
}

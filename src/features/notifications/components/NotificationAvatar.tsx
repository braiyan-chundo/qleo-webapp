import { BadgeCheck, Bell, Hourglass, ThumbsDown, type LucideIcon } from 'lucide-react';

import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { cn } from '@/lib/utils';

import type { NotificationActor, NotificationType } from '../services/notifications.service';

/** Insignia de un tipo: su icono y el par de tokens M3 del círculo que lo enmarca. */
interface NotificationTypeBadge {
  icon: LucideIcon;
  /** Clases de token M3. El color **es** el mensaje: rojo solo donde algo se frenó. */
  className: string;
}

/**
 * (QL-171) Icono distintivo por tipo, pintado como **insignia** sobre el avatar del actor. Es un
 * mapa **parcial** a propósito: la mayoría de tipos se entienden con el texto y no necesitan
 * adorno; solo se marca lo que conviene reconocer de un vistazo en la campana. Añadir un tipo
 * aquí es todo lo que hace falta para que su fila lo muestre.
 *
 * (QL-197) Las tres del fin abierto se distinguen por color: ámbar la que **pide** algo a
 * Dirección, verde-terciario la autorización y rojo la denegación (la única que deja la tarea
 * frenada). Autorizar no se pinta de rojo: no es un problema.
 */
const NOTIFICATION_TYPE_BADGE: Partial<Record<NotificationType, NotificationTypeBadge>> = {
  TASK_REVIEW_REJECTED: {
    icon: ThumbsDown,
    className: 'bg-error-container text-on-error-container',
  },
  TASK_OPEN_ENDED_REQUESTED: {
    icon: Hourglass,
    className: 'bg-warning-container text-on-warning-container',
  },
  TASK_OPEN_ENDED_APPROVED: {
    icon: BadgeCheck,
    className: 'bg-tertiary-container text-on-tertiary-container',
  },
  TASK_OPEN_ENDED_REJECTED: {
    icon: ThumbsDown,
    className: 'bg-error-container text-on-error-container',
  },
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
  const badge = type ? NOTIFICATION_TYPE_BADGE[type] : undefined;

  const avatar = !actor ? (
    <span
      aria-hidden
      className={cn(
        'flex size-6 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant',
        !badge && className,
      )}
    >
      <Bell className="size-3.5" />
    </span>
  ) : (
    <AuthedAvatar
      size="sm"
      className={badge ? undefined : className}
      avatarDownloadUrl={actor.avatarDownloadUrl}
      avatarUrl={actor.avatarUrl}
      name={actor.name}
    />
  );

  if (!badge) return avatar;

  const TypeIcon = badge.icon;

  return (
    <span className={cn('relative inline-flex', className)}>
      {avatar}
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full',
          badge.className,
        )}
      >
        <TypeIcon className="size-2.5" />
      </span>
    </span>
  );
}

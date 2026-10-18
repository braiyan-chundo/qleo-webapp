import {
  AlarmClock,
  BadgeCheck,
  Bell,
  CalendarX,
  GaugeCircle,
  Hourglass,
  Layers,
  Repeat,
  ThumbsDown,
  type LucideIcon,
} from 'lucide-react';

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
  // (QL-200) Las cuatro de gestión llevan insignia propia: sin actor humano, el icono es lo
  // único que las distingue de un vistazo en la campana. Solo la de tarea vencida va en rojo —
  // es la única que señala un hecho consumado sobre un compromiso concreto; las tres de persona
  // van en ámbar porque describen una situación a revisar, no un fallo probado.
  MGMT_TASK_OVERDUE: {
    icon: CalendarX,
    className: 'bg-error-container text-on-error-container',
  },
  MGMT_PENDING_BUILDUP: {
    icon: Layers,
    className: 'bg-warning-container text-on-warning-container',
  },
  MGMT_LOW_COMPLIANCE: {
    icon: GaugeCircle,
    className: 'bg-warning-container text-on-warning-container',
  },
  MGMT_REPEATED_BREACH: {
    icon: Repeat,
    className: 'bg-warning-container text-on-warning-container',
  },
  // (HU-0202, DS-8) Recordatorio personal: del sistema, reloj sobre el círculo de la campana.
  REMINDER: {
    icon: AlarmClock,
    className: 'bg-primary-container text-on-primary-container',
  },
};

interface NotificationAvatarProps {
  /** Actor humano poblado, o `null` en las notis del sistema (§3.10, `DEADLINE_APPROACHING`). */
  actor: NotificationActor | null;
  /**
   * (QL-200, §3.72 §6) **Sujeto** de una alerta de gestión: de quién habla el aviso. Se usa solo
   * cuando **no hay actor**, que es siempre en las `MGMT_*`.
   *
   * ⚠️ No es un "actor de repuesto": el sujeto **no ha hecho nada**. Se pinta su cara porque el
   * aviso trata de él y reconocerlo de un vistazo es justo lo que Dirección necesita, pero el
   * texto de la fila nunca le atribuye una acción (ver `notification-text`).
   */
  subject?: NotificationActor | null;
  /** Tipo de la notificación; decide la insignia de icono (si la hay). */
  type?: NotificationType;
  className?: string;
}

/**
 * Avatar de una fila de notificación. Muestra el avatar del actor humano, el del **sujeto** si la
 * noti es del sistema pero trata de alguien (QL-200), o un icono de sistema (campana) cuando no
 * hay ni lo uno ni lo otro (§3.10, `DEADLINE_APPROACHING`).
 * Iguala el tamaño del `AuthedAvatar size="sm"` (size-6) para no descuadrar la fila.
 */
export function NotificationAvatar({
  actor,
  subject,
  type,
  className,
}: NotificationAvatarProps) {
  const badge = type ? NOTIFICATION_TYPE_BADGE[type] : undefined;
  const person = actor ?? subject ?? null;

  const avatar = !person ? (
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
      avatarDownloadUrl={person.avatarDownloadUrl}
      avatarUrl={person.avatarUrl}
      name={person.name}
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

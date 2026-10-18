import type { Notification } from '../services/notifications.service';

/**
 * Compone el texto de una notificación en el front (§3.10: el backend NO manda texto
 * redactado). Extensible por `type`. **El `actor` puede ser `null`** (notis del sistema como
 * `DEADLINE_APPROACHING`), así que siempre se usa con fallback.
 *
 * (QL-137) Usa `task.title` / `project.name` ya poblados (§3.36) para nombrar el objeto:
 * *"Ana te asignó «Reservar hotel»"* en vez de *"Ana te asignó una tarea"*. Ambos pueden ser
 * `null` (la tarea/proyecto se borró) aunque el id crudo siga presente ⇒ **siempre** con
 * fallback al texto genérico de antes.
 */
export function notificationText(notification: Notification): string {
  const actor = notification.actor?.name ?? 'Alguien';
  const task = quoted(notification.task?.title);
  const project = quoted(notification.project?.name);

  switch (notification.type) {
    case 'MENTION':
      return `${actor} te mencionó en ${task ?? 'una tarea'}`;
    case 'WALL_MENTION':
      return `${actor} te mencionó en el muro`;
    case 'DEADLINE_EXTENSION_REQUEST': {
      const date = notification.requestedDate
        ? formatShortDate(notification.requestedDate)
        : 'una nueva fecha';
      const target = task ? ` de ${task}` : '';
      const reason = notification.reason?.trim();
      const base = `${actor} solicita mover la fecha límite${target} al ${date}`;
      return reason ? `${base}: ${reason}` : base;
    }
    case 'TASK_ASSIGNED':
      return `${actor} te asignó ${task ?? 'una tarea'}`;
    case 'PROJECT_MEMBER_ADDED':
      return `${actor} te agregó a ${project ?? 'un proyecto'}`;
    case 'TASK_MOVED':
      return `${actor} cambió el estado de ${task ?? 'una tarea'}`;
    case 'TASK_REVIEW_REJECTED': {
      // (QL-171) El motivo del rechazo viaja en `reason` (el `rejectionComment` de la tarea).
      const reason = notification.reason?.trim();
      const base = `${actor} rechazó la revisión de ${task ?? 'una tarea'}`;
      return reason ? `${base}: ${reason}` : base;
    }
    case 'TASK_OPEN_ENDED_REQUESTED': {
      // (QL-197, §3.69) Va al directivo ELEGIDO: es una acción pendiente suya, así que la frase
      // pide algo ("necesita tu autorización") en vez de solo informar.
      const reason = notification.reason?.trim();
      const base = `${actor} necesita tu autorización para dejar ${task ?? 'una tarea'} sin fecha de fin`;
      return reason ? `${base}: ${reason}` : base;
    }
    case 'TASK_OPEN_ENDED_APPROVED': {
      // Va al Creador. El comentario es OPCIONAL al autorizar, así que puede no venir.
      const reason = notification.reason?.trim();
      const base = `${actor} autorizó dejar ${task ?? 'una tarea'} sin fecha de fin`;
      return reason ? `${base}: ${reason}` : base;
    }
    case 'TASK_OPEN_ENDED_REJECTED': {
      // Va al Creador. Aquí el motivo es obligatorio en el backend, pero se compone igual con
      // fallback: la tarea sigue bloqueada y lo que hay que decirle es la salida.
      const reason = notification.reason?.trim();
      const base = `${actor} no autorizó dejar ${task ?? 'una tarea'} sin fecha de fin`;
      return reason
        ? `${base}: ${reason}`
        : `${base}. Ponle una fecha de finalización para desbloquearla`;
    }
    case 'DEADLINE_APPROACHING':
      // Noti del sistema (sin actor): se compone sin nombre.
      return task ? `${task} está por vencer` : 'Una de tus tareas está por vencer';

    case 'REMINDER': {
      // (HU-0202, §3.74 §6) Del sistema y solo para su dueña: el mensaje viaja en `reason`.
      const reason = notification.reason?.trim();
      return reason ? `Recordatorio: ${reason}` : 'Recordatorio';
    }

    // ───────────────── (QL-200, §3.72 §6) Alertas de gestión ─────────────────
    // Las cuatro son del **sistema** (`actor: null`) y hablan de un tercero (`subject`). El
    // backend manda el detalle **ya redactado** en `reason` —el mismo texto que va en el push—
    // así que aquí NO se vuelve a componer la frase: reescribirla en cliente es cómo la campana
    // y el push acaban diciendo cosas distintas del mismo aviso. El fallback solo cubre el caso
    // raro de que `reason` no llegue, y se cuida de no atribuirle a nadie una acción.
    case 'MGMT_TASK_OVERDUE': {
      const reason = notification.reason?.trim();
      if (reason) return reason;
      return task ? `${task} sigue vencida sin cerrar` : 'Hay una tarea vencida sin cerrar';
    }
    case 'MGMT_PENDING_BUILDUP': {
      const reason = notification.reason?.trim();
      return reason ?? `${subjectName(notification)} acumula tareas pendientes por encima del umbral`;
    }
    case 'MGMT_LOW_COMPLIANCE': {
      const reason = notification.reason?.trim();
      return (
        reason ??
        `${subjectName(notification)} está por debajo del umbral de cumplimiento de plazos`
      );
    }
    case 'MGMT_REPEATED_BREACH': {
      const reason = notification.reason?.trim();
      return (
        reason ?? `${subjectName(notification)} acumula varios incumplimientos de plazo`
      );
    }

    default:
      return `${actor} generó una notificación`;
  }
}

/**
 * (QL-200) Nombre del **sujeto** de una alerta de gestión, con fallback neutro. Nunca "Alguien":
 * el sujeto no es un actor anónimo que hizo algo, es la persona de la que trata el aviso.
 */
function subjectName(notification: Notification): string {
  return notification.subject?.name?.trim() || 'Un miembro del equipo';
}

/**
 * Entrecomilla un nombre para intercalarlo en la frase, o `undefined` si no hay nada que
 * mostrar. Un proyecto borrado llega con `name: ''` (§3.36) → se trata como ausente.
 */
function quoted(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? `«${trimmed}»` : undefined;
}

/** ISO → fecha corta en español (ej. "2 jul 2026"). Cadena vacía si es inválida. */
function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** ISO → antigüedad relativa breve en español (ej. "hace 5 min", "hace 2 h", "hace 3 d"). */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

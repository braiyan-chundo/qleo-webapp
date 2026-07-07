import type { Notification } from '../services/notifications.service';

/**
 * Compone el texto de una notificación en el front (§3.10: el backend NO manda texto
 * redactado). Extensible por `type`; hoy solo `MENTION`.
 */
export function notificationText(notification: Notification): string {
  const actor = notification.actor.name;
  switch (notification.type) {
    case 'MENTION':
      return `${actor} te mencionó en una tarea`;
    case 'DEADLINE_EXTENSION_REQUEST': {
      const date = notification.requestedDate
        ? formatShortDate(notification.requestedDate)
        : 'una nueva fecha';
      const reason = notification.reason?.trim();
      const base = `${actor} solicita mover la fecha límite al ${date}`;
      return reason ? `${base}: ${reason}` : base;
    }
    default:
      return `${actor} generó una notificación`;
  }
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

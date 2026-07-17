import type { Notification } from '../services/notifications.service';

/**
 * Agrupación por fecha de la bandeja (QL-137): **Hoy / Ayer / Esta semana / Anteriores**.
 * Función pura sobre la lista que ya viene ordenada `createdAt` desc del backend: no reordena
 * nada, solo corta la lista en tramos, así que el orden dentro de cada grupo es el del servidor.
 */

/** Etiqueta de un tramo. El orden del array define el orden de pintado. */
export type NotificationGroupLabel = 'Hoy' | 'Ayer' | 'Esta semana' | 'Anteriores';

export interface NotificationGroup {
  label: NotificationGroupLabel;
  items: Notification[];
}

const GROUP_ORDER: readonly NotificationGroupLabel[] = [
  'Hoy',
  'Ayer',
  'Esta semana',
  'Anteriores',
];

/** Medianoche local del día de `date`. Base de las comparaciones (no se compara por UTC). */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Tramo al que pertenece una fecha ISO, relativo a `now`. "Esta semana" = los 7 días anteriores
 * a hoy (ventana móvil), no la semana natural: es lo que espera quien mira una bandeja, y evita
 * que un lunes por la mañana "Esta semana" salga vacío.
 */
export function notificationGroupOf(iso: string, now: Date = new Date()): NotificationGroupLabel {
  const date = new Date(iso);
  // Fecha inválida → al cajón de sastre; nunca se descarta una notificación por eso.
  if (Number.isNaN(date.getTime())) return 'Anteriores';

  const today = startOfDay(now);
  const day = startOfDay(date);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);

  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return 'Esta semana';
  return 'Anteriores';
}

/**
 * Reparte las notificaciones en los tramos, **omitiendo los vacíos** (no se pinta "Ayer" si no
 * hay nada de ayer). Mantiene el orden de entrada dentro de cada tramo.
 */
export function groupNotificationsByDate(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationGroup[] {
  const buckets = new Map<NotificationGroupLabel, Notification[]>();

  for (const notification of notifications) {
    const label = notificationGroupOf(notification.createdAt, now);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(notification);
    else buckets.set(label, [notification]);
  }

  return GROUP_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    items: buckets.get(label) as Notification[],
  }));
}

import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Repeat,
  Timer,
  type LucideIcon,
} from 'lucide-react';

import type { ReminderKind } from '../types/reminder.types';

/** Icono de cada tipo de programación, igual en la fila, el formulario y la ayuda (maqueta). */
export const KIND_ICONS: Record<ReminderKind, LucideIcon> = {
  ONCE: CalendarCheck,
  DAILY: Repeat,
  WEEKLY: CalendarDays,
  DATES: CalendarPlus,
  INTERVAL: Timer,
};

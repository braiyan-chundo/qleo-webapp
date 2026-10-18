import { Check, CircleAlert, Pause, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { ReminderResponseDto } from '../types/reminder.types';
import { BLOCKED_TEXT } from '../lib/reminder-blocked';
import { finishedOutcome } from '../lib/reminder-display';

type Tone = 'neutral' | 'warning' | 'primary';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  warning: 'bg-warning-container text-on-warning-container',
  primary: 'bg-primary-container text-on-primary-container',
};

interface PillProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: string;
  className?: string;
}

/** Píldora de estado (`Badge`), con tono por token y el texto siempre visible. */
export function StatePill({ tone = 'neutral', icon: Icon, children, className }: PillProps) {
  return (
    <Badge className={cn('max-md:h-[22px]', TONES[tone], className)}>
      {Icon && <Icon aria-hidden />}
      {children}
    </Badge>
  );
}

/**
 * Píldora del estado de un recordatorio que no está simplemente activo: «En pausa», «En pausa ·
 * tarea …», «Cumplido» o «No sonó». `null` si está activo.
 */
export function ReminderStatePill({
  reminder,
}: {
  reminder: Pick<ReminderResponseDto, 'status' | 'blockedReason' | 'schedule'>;
}) {
  if (reminder.status === 'FINISHED') {
    return finishedOutcome(reminder.schedule) === 'MISSED' ? (
      <StatePill tone="warning" icon={CircleAlert}>
        No sonó
      </StatePill>
    ) : (
      <StatePill icon={Check}>Cumplido</StatePill>
    );
  }
  if (reminder.blockedReason) {
    const blocked = BLOCKED_TEXT[reminder.blockedReason];
    return <StatePill icon={blocked.icon}>{blocked.label}</StatePill>;
  }
  if (reminder.status === 'PAUSED') return <StatePill icon={Pause}>En pausa</StatePill>;
  return null;
}

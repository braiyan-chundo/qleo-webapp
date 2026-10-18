import { useState, type ReactNode } from 'react';
import { BellRing, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ReminderKind, ReminderPreviewDto } from '../types/reminder.types';
import { bogotaToday, formatPreviewDay } from '../lib/bogota-time';
import { groupPreviewByDay, previewFooter, SKIP_REASON_LABELS } from '../lib/reminder-display';

interface ReminderPreviewProps {
  kind: ReminderKind;
  /** Respuesta de `POST /reminders/preview`, o `undefined` si aún no hay. */
  data: ReminderPreviewDto | undefined;
  /** La programación está incompleta: se pide lo que falta. */
  incomplete: boolean;
  /** Hay una petición en vuelo (se conserva lo anterior). */
  loading: boolean;
  /** La vista previa falló: el formulario sigue utilizable sin ella. */
  failed: boolean;
  /** Editando: en fechas sueltas el rango se llama «fechas pendientes». */
  editing?: boolean;
}

const HINTS: Record<ReminderKind, string> = {
  ONCE: 'la fecha y la hora',
  DATES: 'la fecha y la hora',
  DAILY: 'la hora',
  WEEKLY: 'los días y la hora',
  INTERVAL: 'la franja y los días',
};

function rangeLabel(kind: ReminderKind, count: number, editing: boolean): string {
  if (kind === 'ONCE') return 'una vez';
  if (kind === 'DATES') {
    if (editing) return 'fechas pendientes';
    return count === 1 ? 'tu fecha' : `tus ${count} fechas`;
  }
  return 'próximos 14 días';
}

/**
 * «Así sonará» (DS-4, AC-06, AC-37): los avisos que devolvió el servidor con el calendario de
 * quien llama, tachando los que se omitirían y diciendo por qué. No recalcula nada: lo que pinta
 * es `occurrences[].skipped`.
 */
export function ReminderPreview({
  kind,
  data,
  incomplete,
  loading,
  failed,
  editing = false,
}: ReminderPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const today = bogotaToday();

  const header = (range?: string) => (
    <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-on-surface">
      <BellRing className="size-3.5" aria-hidden />
      Así sonará
      {range && <span className="font-normal text-on-surface-variant">· {range}</span>}
      {loading && (
        <Loader2 className="ml-auto size-3.5 animate-spin text-on-surface-variant" aria-hidden />
      )}
    </p>
  );

  let body: ReactNode;
  let range: string | undefined;

  if (incomplete) {
    body = (
      <p className="text-[13px] text-on-surface-variant">
        Elige {HINTS[kind]} para ver cuándo te llegará el aviso.
      </p>
    );
  } else if (failed && !data) {
    body = (
      <p className="text-[13px] text-on-surface-variant">
        No pudimos calcular la vista previa ahora; puedes guardar igual.
      </p>
    );
  } else if (!data) {
    body = (
      <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        Calculando…
      </p>
    );
  } else {
    const days = groupPreviewByDay(data.occurrences);
    const limit = kind === 'INTERVAL' ? 3 : 5;
    const visible = expanded ? days : days.slice(0, limit);
    const footer = previewFooter(kind, data.occurrences, data.truncated);
    const more = days.length > limit;
    const toggleLabel = expanded
      ? 'Ver menos'
      : kind === 'INTERVAL'
        ? 'Ver todos'
        : kind === 'DATES'
          ? 'Ver todas'
          : 'Ver los 14 días';
    range = rangeLabel(kind, data.occurrences.length, editing);

    body =
      days.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant">Sin avisos por delante.</p>
      ) : (
        <>
          <ul className="grid gap-1">
            {visible.map((day) => (
              <li key={day.date} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[13px]">
                <span className="min-w-[88px] text-on-surface-variant">
                  {formatPreviewDay(day.date, today)}
                </span>
                {day.times.map((t) => (
                  <span
                    key={t.time}
                    className={cn(
                      'tabular-nums',
                      t.skipped
                        ? 'font-normal text-on-surface-variant line-through'
                        : 'font-medium text-on-surface',
                    )}
                  >
                    {t.time}
                    {t.skipped && <span className="sr-only"> (no sonará)</span>}
                  </span>
                ))}
                {day.skipped && (
                  <span className="text-xs font-medium text-warning">
                    No sonará · {SKIP_REASON_LABELS[day.skipped]}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {(footer || more) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
              {footer && <span>{footer}</span>}
              {more && (
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setExpanded((v) => !v)}
                  className="h-auto p-0 text-xs font-medium max-md:min-h-11"
                >
                  {toggleLabel}
                </Button>
              )}
            </div>
          )}
        </>
      );
  }

  return (
    <div
      aria-live="polite"
      className="rounded-xl bg-surface-container px-4 py-3.5 dark:bg-surface-container-highest"
    >
      {header(range)}
      {body}
    </div>
  );
}

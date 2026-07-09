import { Paperclip } from 'lucide-react';

import { ChartCard } from './analytics-primitives';
import { formatDuration } from '../lib/format';
import type { ProjectAnalytics } from '../services/analytics.service';

/**
 * 2.5 — Adjuntos del proyecto por scope (generales del proyecto vs. de tareas) + 2.4
 * complemento (duración media inicio→fin). Magnitudes pequeñas → número grande + barra
 * apilada con leyenda numérica, no un chart pesado (guía `dataviz`).
 */
export function AttachmentsCard({
  attachments,
  flowDuration,
}: {
  attachments: ProjectAnalytics['attachments'];
  flowDuration: ProjectAnalytics['flowDuration'];
}) {
  const total = attachments.total;
  const projectPct = total > 0 ? (attachments.project / total) * 100 : 0;

  return (
    <ChartCard title="Adjuntos y flujo" description="Documentos del proyecto y duración inicio→fin.">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Adjuntos */}
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-on-surface-variant" />
            <span className="text-2xl font-bold tabular-nums text-on-surface">{total}</span>
            <span className="text-sm text-on-surface-variant">adjuntos</span>
          </div>

          <div
            className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high"
            role="img"
            aria-label={`${attachments.project} generales, ${attachments.task} de tareas`}
          >
            {total > 0 && (
              <>
                <div
                  className="h-full"
                  style={{ width: `${projectPct}%`, backgroundColor: 'var(--primary)' }}
                />
                <div
                  className="h-full"
                  style={{ width: `${100 - projectPct}%`, backgroundColor: 'var(--tertiary)' }}
                />
              </>
            )}
          </div>

          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <dt className="inline-flex items-center gap-1.5 text-on-surface-variant">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                Generales del proyecto
              </dt>
              <dd className="font-semibold tabular-nums text-on-surface">{attachments.project}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="inline-flex items-center gap-1.5 text-on-surface-variant">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: 'var(--tertiary)' }} />
                De tareas
              </dt>
              <dd className="font-semibold tabular-nums text-on-surface">{attachments.task}</dd>
            </div>
          </dl>
        </div>

        {/* Flujo inicio→fin */}
        <div className="sm:border-l sm:border-outline-variant/30 sm:pl-5">
          <p className="text-xs font-medium text-on-surface-variant">Duración media inicio→fin</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">
            {flowDuration.taskCount > 0 ? formatDuration(flowDuration.avgMs) : '—'}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {flowDuration.taskCount > 0
              ? `Sobre ${flowDuration.taskCount} ${flowDuration.taskCount === 1 ? 'tarea' : 'tareas'} con inicio y fin marcados.`
              : 'Marca columnas de inicio y fin para medir la duración.'}
          </p>
        </div>
      </div>
    </ChartCard>
  );
}

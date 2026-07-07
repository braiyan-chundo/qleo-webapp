import { Link } from 'react-router-dom';
import { AtSign, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { timeAgo } from '@/features/notifications/lib/notification-text';
import type { MentionSummary } from '../services/dashboard.service';

interface RecentMentionsCardProps {
  mentions: MentionSummary[];
}

/**
 * Bloque "Menciones recientes" (§3.14). El endpoint devuelve un resumen reducido
 * (`MentionSummary`: sin actor), así que el texto es fijo ("Te mencionaron…"); la
 * antigüedad reusa `timeAgo` de `features/notifications/lib`. Cada mención enlaza a
 * `/notifications` (bandeja completa, donde se marca leída/abre la tarea). Vacío → aviso.
 */
export function RecentMentionsCard({ mentions }: RecentMentionsCardProps) {
  const hasMentions = mentions.length > 0;

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-on-surface">
          <AtSign className="size-4 text-on-surface-variant" />
          Menciones recientes
        </h2>
        <Link
          to="/notifications"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver todas
          <ChevronRight className="size-4" />
        </Link>
      </div>

      {hasMentions ? (
        <ul className="space-y-1">
          {mentions.map((mention) => (
            <li key={mention.id}>
              <Link
                to="/notifications"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-container"
              >
                {!mention.isRead && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                )}
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    mention.isRead
                      ? 'text-on-surface-variant'
                      : 'font-medium text-on-surface',
                  )}
                >
                  Te mencionaron en una tarea
                </span>
                <span className="shrink-0 text-xs text-on-surface-variant">
                  {timeAgo(mention.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-sm text-on-surface-variant">
          Sin menciones recientes.
        </p>
      )}
    </section>
  );
}

import { useState } from 'react';
import {
  BadgeCheck,
  CalendarOff,
  Hourglass,
  MessageSquareQuote,
  ThumbsDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hasAtLeastRole } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';

import type { Task } from '../../services/tasks.service';
import { OPEN_ENDED_PRESENTATION, isOpenEndedPending } from '../../lib/open-ended';
import { formatDateTime } from '../../lib/time';
import { ApproveOpenEndedDialog } from './ApproveOpenEndedDialog';
import { RejectOpenEndedDialog } from './RejectOpenEndedDialog';

interface OpenEndedSectionProps {
  task: Task;
  projectId: string;
}

/** Marco de la sección según el tono del estado. `APPROVED` va neutro: es legítimo, no un aviso. */
const TONE_CLASS = {
  pending: 'border-warning/30 bg-warning-container/40',
  rejected: 'border-error/30 bg-error-container/50',
  neutral: 'border-outline-variant/40 bg-surface-container-lowest',
} as const;

/**
 * (QL-197, §3.69) Sección **"Fecha de finalización abierta"** del detalle de tarea. Solo existe
 * si la tarea tiene una solicitud (`openEndedStatus != null`), que es el caso raro: en el
 * histórico y en el alta normal es `null`.
 *
 * Distingue los tres estados con el contraste que importa:
 * - `PENDING` → esperando a Dirección. **Bloqueada.**
 * - `REJECTED` → denegado. **Bloqueada**, y el texto dice cuál es la salida (ponerle fecha).
 * - `APPROVED` → "sin fecha de fin" **sin alarma visual**: es legítimo, no un problema.
 *
 * Si el usuario en sesión es **Dirección** (`hasAtLeastRole(user,'MANAGER')`) y la solicitud
 * sigue `PENDING`, ofrece resolverla. Resolver lo puede **cualquier** miembro de Dirección, no
 * solo el directivo al que se le pidió — si solo pudiera él, unas vacaciones suyas congelarían
 * la tarea—, así que el gate es el rol, no `openEndedRequestedTo.id`.
 */
export function OpenEndedSection({ task, projectId }: OpenEndedSectionProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const status = task.openEndedStatus;
  // El caso normal (y el de todas las tareas anteriores a la HU): no hay nada que contar.
  if (!status) return null;

  const presentation = OPEN_ENDED_PRESENTATION[status];
  const canResolve = isOpenEndedPending(task) && hasAtLeastRole(currentUser, 'MANAGER');
  const StatusIcon =
    status === 'PENDING' ? Hourglass : status === 'REJECTED' ? ThumbsDown : BadgeCheck;

  return (
    <>
      <section className={cn('rounded-lg border px-4 py-3', TONE_CLASS[presentation.tone])}>
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
          <CalendarOff className="size-3.5" />
          Fecha de finalización
        </p>

        <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface">
          <StatusIcon className="size-4" />
          {presentation.label}
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">{presentation.description}</p>

        {/* Quién la pidió y a quién. `openEndedRequestedTo` es a quién se NOTIFICÓ; quien
            responde puede ser otra persona de Dirección, y por eso se muestran por separado. */}
        <dl className="mt-3 space-y-1 border-t border-outline-variant/40 pt-2 text-xs">
          {task.openEndedRequestedBy && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-on-surface-variant">Solicitado por</dt>
              <dd className="text-on-surface">
                {task.openEndedRequestedBy.name}
                {task.openEndedRequestedAt &&
                  ` · ${formatDateTime(task.openEndedRequestedAt)}`}
              </dd>
            </div>
          )}
          {task.openEndedRequestedTo && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-on-surface-variant">Se le pidió a</dt>
              <dd className="text-on-surface">{task.openEndedRequestedTo.name}</dd>
            </div>
          )}
          {task.openEndedResolvedBy && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-on-surface-variant">
                {status === 'APPROVED' ? 'Autorizado por' : 'Denegado por'}
              </dt>
              <dd className="text-on-surface">
                {task.openEndedResolvedBy.name}
                {task.openEndedResolvedAt && ` · ${formatDateTime(task.openEndedResolvedAt)}`}
              </dd>
            </div>
          )}
        </dl>

        {task.openEndedReason?.trim() && (
          <div className="mt-2 rounded-md bg-surface-container-lowest/70 px-3 py-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
              <MessageSquareQuote className="size-3.5" />
              Motivo de la solicitud
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-on-surface">
              {task.openEndedReason}
            </p>
          </div>
        )}

        {task.openEndedResolutionComment?.trim() && (
          <div className="mt-2 rounded-md bg-surface-container-lowest/70 px-3 py-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
              <MessageSquareQuote className="size-3.5" />
              Respuesta de Dirección
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-on-surface">
              {task.openEndedResolutionComment}
            </p>
          </div>
        )}

        {canResolve && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
            >
              <ThumbsDown />
              No autorizar
            </Button>
            <Button type="button" size="sm" onClick={() => setApproveOpen(true)}>
              <BadgeCheck />
              Autorizar
            </Button>
          </div>
        )}
      </section>

      {canResolve && (
        <>
          <ApproveOpenEndedDialog
            open={approveOpen}
            onOpenChange={setApproveOpen}
            task={task}
            projectId={projectId}
          />
          <RejectOpenEndedDialog
            open={rejectOpen}
            onOpenChange={setRejectOpen}
            task={task}
            projectId={projectId}
          />
        </>
      )}
    </>
  );
}

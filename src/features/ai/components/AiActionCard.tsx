import { Check, Loader2, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AiActionState, AiProposedAction } from '../types/ai-chat.types';

interface AiActionCardProps {
  action: AiProposedAction;
  /** Estado del ciclo confirmar/cancelar. `null` se trata como `pending`. */
  state: AiActionState | null;
  /** Mensaje de error del confirm/cancel, si falló. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Etiqueta del botón de confirmar según la herramienta subyacente. Un `tool` desconocido cae a
 * "Confirmar" (tolera herramientas que el backend añada después sin romper la tarjeta).
 */
const CONFIRM_LABELS: Record<string, string> = {
  create_task: 'Crear tarea',
  update_task: 'Guardar cambios',
  move_task: 'Mover tarea',
  set_task_deadline: 'Fijar fecha límite',
  assign_task_role: 'Asignar rol',
  add_comment: 'Comentar',
  add_checklist_item: 'Añadir ítem',
  toggle_checklist_item: 'Actualizar ítem',
  create_project: 'Crear proyecto',
};

/**
 * Tarjeta de **confirmación en dos fases** (QL-190, §9). Muestra la acción propuesta por el asistente
 * (verbo + titular + campos legibles) y pide **[Cancelar]/[Confirmar]**. En v1 es de **solo
 * visualización**: no se editan los campos aquí (el override en el confirm no existe aún en backend);
 * si el usuario quiere cambiar algo, lo pide de nuevo en el chat. La estructura queda lista para
 * añadir edición después (bastaría con inputs por campo y pasar overrides al confirm).
 */
export function AiActionCard({ action, state, error, onConfirm, onCancel }: AiActionCardProps) {
  const confirmLabel = CONFIRM_LABELS[action.tool] ?? 'Confirmar';
  const effectiveState = state ?? 'pending';
  const confirming = effectiveState === 'confirming';
  const canceling = effectiveState === 'canceling';
  const busy = confirming || canceling;
  const resolved = effectiveState === 'executed' || effectiveState === 'canceled';

  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-primary-container/25 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Wand2 className="size-4" />
        </span>
        <span className="capitalize">{action.kind}</span>
      </div>

      <p className="mt-2 text-sm font-medium text-on-surface">{action.title}</p>

      {action.fields.length > 0 && (
        <dl className="mt-3 grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm">
          {action.fields.map((field, i) => (
            <div key={`${field.label}-${i}`} className="flex flex-wrap gap-x-2">
              <dt className="shrink-0 font-medium text-on-surface-variant">{field.label}:</dt>
              <dd className="min-w-0 break-words text-on-surface">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {effectiveState === 'executed' ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-tertiary">
          <Check className="size-4" /> Acción realizada
        </p>
      ) : effectiveState === 'canceled' ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
          <X className="size-4" /> Descartada
        </p>
      ) : (
        <>
          {error && (
            <p className="mt-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
              {canceling && <Loader2 className="animate-spin" />}
              Cancelar
            </Button>
            <Button size="sm" onClick={onConfirm} disabled={busy}>
              {confirming ? <Loader2 className="animate-spin" /> : <Check />}
              {confirmLabel}
            </Button>
          </div>
        </>
      )}

      {!resolved && (
        <p className="mt-2 text-xs text-on-surface-variant">
          Para cambiar algo, pídemelo de nuevo en el chat.
        </p>
      )}
    </div>
  );
}

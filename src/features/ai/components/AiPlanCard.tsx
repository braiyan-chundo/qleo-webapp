import { useMemo, useState } from 'react';
import { Check, Loader2, Minus, TriangleAlert, Wand2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type {
  AiActionState,
  AiPlanStepResult,
  AiProposedPlan,
  AiProposedPlanStep,
} from '../types/ai-chat.types';

interface AiPlanCardProps {
  plan: AiProposedPlan;
  /** Estado del ciclo confirmar/cancelar del plan. `null` se trata como `pending`. */
  state: AiActionState | null;
  /** Mensaje de error del confirm/cancel del plan, si falló. */
  error: string | null;
  /** Desenlace por paso tras confirmar/cancelar; `null` mientras esté pendiente. */
  results: AiPlanStepResult[] | null;
  /** Confirma el plan ejecutando todo salvo los índices (1-based) en `exclude`. */
  onConfirm: (exclude: number[]) => void;
  onCancel: () => void;
}

/**
 * Resuelve el conjunto de pasos excluidos a partir de las exclusiones **directas** del usuario,
 * arrastrando el **cierre transitivo de dependientes**: si un paso queda excluido, todo paso que
 * dependa de él (directa o indirectamente) también, porque no puede ejecutarse sin él.
 *
 * Devuelve dos conjuntos:
 * - `excluded`: todos los pasos que NO se ejecutarán (directos + forzados). Es lo que va al backend.
 * - `forced`: solo los arrastrados por una dependencia; su checkbox se desmarca y **se deshabilita**
 *   (el usuario no puede reactivarlos sin reactivar antes su dependencia).
 *
 * Itera a punto fijo, así que es robusto aunque un `dependsOn` apunte a un índice posterior.
 */
function resolveExclusions(
  steps: AiProposedPlanStep[],
  userExcluded: readonly number[],
): { excluded: Set<number>; forced: Set<number> } {
  const excluded = new Set<number>(userExcluded);
  const forced = new Set<number>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) {
      if (excluded.has(step.index)) continue;
      if (step.dependsOn.some((dep) => excluded.has(dep))) {
        excluded.add(step.index);
        forced.add(step.index);
        changed = true;
      }
    }
  }

  return { excluded, forced };
}

/** Campos legibles de un paso, con el mismo `dl` compacto que `AiActionCard`. */
function StepFields({ fields }: { fields: AiProposedPlanStep['fields'] }) {
  if (fields.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm">
      {fields.map((field, i) => (
        <div key={`${field.label}-${i}`} className="flex flex-wrap gap-x-2">
          <dt className="shrink-0 font-medium text-on-surface-variant">{field.label}:</dt>
          <dd className="min-w-0 break-words text-on-surface">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Badge de desenlace de un paso ya resuelto (`executed` | `failed` | `skipped`). */
function StepResultBadge({ result }: { result: AiPlanStepResult }) {
  if (result.status === 'executed') {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-tertiary">
        <Check className="size-4 shrink-0" /> Hecho
      </p>
    );
  }
  if (result.status === 'failed') {
    return (
      <p className="mt-2 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
        {result.error ?? 'No se pudo completar este paso.'}
      </p>
    );
  }
  return (
    <p className="mt-2 flex items-center gap-1.5 text-sm text-on-surface-variant">
      <Minus className="size-4 shrink-0" /> Omitido
    </p>
  );
}

/**
 * Icono del margen izquierdo cuando el plan ya está resuelto: refleja el desenlace del paso. Sin
 * resultado conocido (p. ej. plan cancelado sin detalle) cae a un guion atenuado.
 */
function StepStatusIcon({ result }: { result: AiPlanStepResult | undefined }) {
  const base = 'flex size-5 shrink-0 items-center justify-center rounded-full';
  if (result?.status === 'executed') {
    return (
      <span className={cn(base, 'bg-tertiary-container text-on-tertiary-container')}>
        <Check className="size-3.5" />
      </span>
    );
  }
  if (result?.status === 'failed') {
    return (
      <span className={cn(base, 'bg-error-container text-on-error-container')}>
        <TriangleAlert className="size-3.5" />
      </span>
    );
  }
  return (
    <span className={cn(base, 'bg-surface-container-high text-on-surface-variant')}>
      <Minus className="size-3.5" />
    </span>
  );
}

/**
 * Tarjeta de **plan multi-acción** (QL-78). Cuando el asistente propone 2+ acciones, el backend emite
 * un `plan_proposed` (lista ordenada de pasos con dependencias) y el usuario lo confirma TODO de una
 * vez. Comparte el lenguaje visual de `AiActionCard` (contenedor `rounded-xl`, `border-primary/30`,
 * `bg-primary-container/25`, icono `Wand2`, `dl` de campos).
 *
 * El usuario puede **excluir** pasos con su checkbox; excluir uno arrastra (desmarca y deshabilita) a
 * sus dependientes vía `resolveExclusions`, evitando estados incoherentes. La exclusión es estado
 * local (no toca el reducer). Al confirmar se envían los índices excluidos y, cuando el plan resuelve,
 * cada paso muestra su desenlace (`executed`/`failed`/`skipped`).
 */
export function AiPlanCard({ plan, state, error, results, onConfirm, onCancel }: AiPlanCardProps) {
  const [userExcluded, setUserExcluded] = useState<number[]>([]);

  const effectiveState = state ?? 'pending';
  const confirming = effectiveState === 'confirming';
  const canceling = effectiveState === 'canceling';
  const busy = confirming || canceling;
  const resolved = effectiveState === 'executed' || effectiveState === 'canceled';

  const { excluded, forced } = useMemo(
    () => resolveExclusions(plan.steps, userExcluded),
    [plan.steps, userExcluded],
  );

  const resultByIndex = useMemo(() => {
    const map = new Map<number, AiPlanStepResult>();
    for (const r of results ?? []) map.set(r.index, r);
    return map;
  }, [results]);

  const selectedCount = plan.steps.length - excluded.size;
  const isPartial = (results ?? []).some((r) => r.status !== 'executed');

  const toggleStep = (index: number, checked: boolean) => {
    setUserExcluded((prev) => {
      if (checked) return prev.filter((i) => i !== index);
      return prev.includes(index) ? prev : [...prev, index];
    });
  };

  return (
    <div className="mt-2 rounded-xl border border-primary/30 bg-primary-container/25 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Wand2 className="size-4" />
        </span>
        <span>
          Plan · {plan.steps.length} {plan.steps.length === 1 ? 'acción' : 'acciones'}
        </span>
      </div>

      {plan.text && <p className="mt-2 text-sm text-on-surface-variant">{plan.text}</p>}

      <ol className="mt-3 space-y-2.5">
        {plan.steps.map((step) => {
          const result = resultByIndex.get(step.index);
          const isExcluded = excluded.has(step.index);
          const isForced = forced.has(step.index);
          const dimmed = !resolved && isExcluded;

          return (
            <li
              key={step.index}
              className="flex gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest/60 p-3"
            >
              <div className="mt-0.5">
                {resolved ? (
                  <StepStatusIcon result={result} />
                ) : (
                  <Checkbox
                    checked={!isExcluded}
                    disabled={isForced || busy}
                    onCheckedChange={(value) => toggleStep(step.index, value === true)}
                    aria-label={`Incluir paso ${step.index}: ${step.label}`}
                  />
                )}
              </div>

              <div className={cn('min-w-0 flex-1', dimmed && 'opacity-50')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-on-primary">
                    {step.index}
                  </span>
                  <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant capitalize">
                    {step.kind}
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-medium break-words text-on-surface">{step.label}</p>

                <StepFields fields={step.fields} />

                {resolved && result && <StepResultBadge result={result} />}
                {!resolved && isForced && (
                  <p className="mt-1.5 text-xs text-on-surface-variant">
                    Requiere el paso {step.dependsOn.join(', ')}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {resolved ? (
        effectiveState === 'executed' ? (
          <p
            className={cn(
              'mt-3 flex items-center gap-1.5 text-sm font-medium',
              isPartial ? 'text-on-surface-variant' : 'text-tertiary',
            )}
          >
            {isPartial ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
            {isPartial ? 'Plan completado en parte' : 'Plan completado'}
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-on-surface-variant">
            <X className="size-4" /> Plan descartado
          </p>
        )
      ) : (
        <>
          {error && (
            <p className="mt-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs font-medium text-on-error-container">
              {error}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-on-surface-variant">
              {selectedCount} de {plan.steps.length} seleccionada{selectedCount === 1 ? '' : 's'}
            </span>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
                {canceling && <Loader2 className="animate-spin" />}
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => onConfirm([...excluded].sort((a, b) => a - b))}
                disabled={busy || selectedCount === 0}
              >
                {confirming ? <Loader2 className="animate-spin" /> : <Check />}
                Confirmar acciones
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Para cambiar algo, pídemelo de nuevo en el chat.
          </p>
        </>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  CloudOff,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  useAddAiModel,
  useAiModels,
  useRemoveAiModel,
  useSetAiModel,
} from '../hooks/use-ai-config';
import { aiErrorMessage } from '../lib/ai-error';
import {
  addAiModelSchema,
  type AddAiModelFormValues,
} from '../schemas/ai-model.schema';
import type { AiModelOption, AiModelState } from '../services/ai-config.service';

/** Etiqueta de la opción "sin elección explícita". */
const AUTO_LABEL = 'Automático';

/**
 * Etiqueta legible de un id de modelo: el `displayName` del listado si lo conocemos, y si no el id
 * crudo (caso del modelo huérfano que el catálogo ya no publica).
 */
function labelFor(state: AiModelState, id: string | null): string {
  if (!id) return AUTO_LABEL;
  return state.available.find((option) => option.id === id)?.displayName ?? id;
}

/** Una opción del listado con la marca de "ya no es elegible" resuelta para pintar. */
interface ModelRow extends AiModelOption {
  /** El catálogo confirmó que este modelo (el configurado) ya no existe. */
  orphan: boolean;
}

/**
 * Construye las filas del selector. Si el modelo configurado ni siquiera viene en `available`,
 * lo añade igualmente: el ADMIN tiene que **ver** qué hay puesto para poder cambiarlo. Esa fila
 * sintética se marca como `catalog` para no ofrecer un "quitar" que el backend rechazaría.
 */
function buildRows(state: AiModelState): ModelRow[] {
  const rows: ModelRow[] = state.available.map((option) => ({
    ...option,
    orphan: !state.configuredAvailable && option.id === state.configured,
  }));

  if (state.configured && !rows.some((row) => row.id === state.configured)) {
    rows.push({
      id: state.configured,
      displayName: state.configured,
      description: '',
      source: 'catalog',
      isPlanDefault: false,
      orphan: true,
    });
  }

  return rows;
}

/**
 * Resumen del estado: **configurado** (lo que eligió el ADMIN) y **en uso** (lo que se usará de
 * verdad) en dos casillas separadas. Son cosas distintas y divergen cuando el configurado queda
 * huérfano — mezclarlas es justo lo que el cliente pidió evitar.
 */
function ModelStateSummary({ state }: { state: AiModelState }) {
  const configuredLabel = state.configured
    ? labelFor(state, state.configured)
    : `${AUTO_LABEL} (por defecto del plan)`;

  const effectiveLabel =
    state.effective !== null ? labelFor(state, state.effective) : 'No se pudo determinar';

  const effectiveNote =
    state.effectiveSource === 'configured'
      ? 'Elegido por un administrador.'
      : state.effectiveSource === 'planDefault'
        ? 'Por defecto del plan de ChatGPT.'
        : 'El motor de IA no respondió; se usará el por defecto del plan.';

  return (
    <dl className="grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 text-sm sm:grid-cols-2">
      <div className="grid gap-0.5">
        <dt className="text-xs font-medium text-on-surface-variant">Modelo configurado</dt>
        <dd className="font-medium text-on-surface">{configuredLabel}</dd>
        <dd className="text-xs text-on-surface-variant">
          {state.configured
            ? 'Elección explícita para toda la plataforma.'
            : 'Nadie ha forzado un modelo: manda el del plan.'}
        </dd>
      </div>
      <div className="grid gap-0.5">
        <dt className="text-xs font-medium text-on-surface-variant">Modelo en uso</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-on-surface">{effectiveLabel}</span>
          {state.effectiveSource === 'planDefault' && (
            <Badge variant="outline" className="border-outline-variant/60 text-on-surface-variant">
              {AUTO_LABEL}
            </Badge>
          )}
        </dd>
        <dd className="text-xs text-on-surface-variant">{effectiveNote}</dd>
      </div>
    </dl>
  );
}

interface ModelOptionRowProps {
  selected: boolean;
  title: string;
  description?: string;
  /** Id crudo, como apoyo bajo el nombre legible. */
  hint?: string;
  badges?: ReactNode;
  /** Este modelo tiene un cambio de activación en vuelo. */
  activating: boolean;
  /** Este modelo se está quitando del listado. */
  removing?: boolean;
  /** Hay alguna mutación en vuelo: se congela todo el bloque para no encadenar carreras. */
  busy: boolean;
  onSelect: () => void;
  /** Solo se pasa en las opciones `source: 'manual'`; las del catálogo no se pueden quitar. */
  onRemove?: () => void;
}

/** Fila seleccionable del listado (radio + metadatos + quitar opcional). */
function ModelOptionRow({
  selected,
  title,
  description,
  hint,
  badges,
  activating,
  removing,
  busy,
  onSelect,
  onRemove,
}: ModelOptionRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl border px-3 py-2.5 transition-colors',
        selected
          ? 'border-primary bg-primary-container/40'
          : 'border-outline-variant/50 bg-surface-container-low hover:bg-surface-container',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={busy}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
            selected
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline text-on-surface-variant',
          )}
        >
          {activating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : selected ? (
            <Check className="size-3" />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-on-surface">{title}</span>
            {badges}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-on-surface-variant">{description}</span>
          )}
          {hint && hint !== title && (
            <span className="mt-0.5 block font-mono text-xs text-on-surface-variant/80">
              {hint}
            </span>
          )}
        </span>
      </button>

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Quitar ${title} del listado`}
          disabled={busy}
          onClick={onRemove}
          className="shrink-0 text-on-surface-variant hover:bg-error-container hover:text-on-error-container"
        >
          {removing ? <Loader2 className="animate-spin" /> : <Trash2 />}
        </Button>
      )}
    </div>
  );
}

interface AddModelFormProps {
  busy: boolean;
  pending: boolean;
  onAdd: (model: string, done: () => void) => void;
}

/**
 * Alta manual de un id (`POST /ai/config/models`). Es un **complemento** del catálogo: sirve para
 * estrenar un modelo nuevo de OpenAI antes de que el motor instalado lo publique. Nadie comprueba
 * que el id exista (el motor no valida ids), así que el texto lo advierte — y **añadir no activa**.
 */
function AddModelForm({ busy, pending, onAdd }: AddModelFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddAiModelFormValues>({
    resolver: zodResolver(addAiModelSchema),
    defaultValues: { model: '' },
  });

  const onSubmit = handleSubmit((values) => {
    onAdd(values.model, () => reset({ model: '' }));
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5">
      <Label htmlFor="ai-model-id" className="text-on-surface">
        Añadir un modelo al listado
      </Label>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          id="ai-model-id"
          className="h-10 sm:max-w-xs"
          autoComplete="off"
          spellCheck={false}
          placeholder="gpt-6-nano"
          disabled={busy}
          {...register('model')}
        />
        <Button type="submit" className="h-10" disabled={busy}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Añadir
        </Button>
      </div>
      {errors.model && (
        <span className="text-xs font-medium text-error">{errors.model.message}</span>
      )}
      <p className="text-xs text-on-surface-variant">
        Para estrenar un modelo que el motor todavía no publica. No se comprueba que exista en
        OpenAI, y <span className="font-medium text-on-surface">añadirlo no lo activa</span>:
        después elígelo en el listado.
      </p>
    </form>
  );
}

/**
 * Selector del **modelo de IA de la plataforma** (QL-194, §3.67, solo ADMIN). Muestra qué modelo se
 * está usando y deja elegir uno del listado (catálogo del motor ∪ altas manuales del ADMIN).
 *
 * Va **fuera** del estado de conexión a propósito: `GET /ai/config/models` nunca da 503, y es justo
 * con el motor caído cuando hace falta poder ver y arreglar la configuración. El estado es de
 * servidor (lo comparten todos los ADMIN), así que vive en la caché de TanStack Query.
 */
export function AiModelSelector() {
  const { data: state, isLoading, isError, error, refetch, isFetching } = useAiModels();

  const setModel = useSetAiModel();
  const addModel = useAddAiModel();
  const removeModel = useRemoveAiModel();

  const busy = setModel.isPending || addModel.isPending || removeModel.isPending;

  /** `true` si el cambio en vuelo es justo el de este id (`null` = la fila "Automático"). */
  const isActivating = (id: string | null) => setModel.isPending && setModel.variables === id;

  const handleSelect = (id: string | null) => {
    if (busy) return;
    setModel.mutate(id, {
      onSuccess: (next) => {
        toast.success(
          id === null
            ? `Modelo automático: se usará ${labelFor(next, next.effective)}.`
            : `Modelo activo: ${labelFor(next, id)}.`,
        );
      },
      onError: (err) => toast.error(aiErrorMessage(err)),
    });
  };

  const handleAdd = (model: string, done: () => void) => {
    addModel.mutate(model, {
      onSuccess: () => {
        done();
        toast.success(`"${model}" añadido al listado. Elígelo abajo para activarlo.`);
      },
      onError: (err) => toast.error(aiErrorMessage(err)),
    });
  };

  const handleRemove = (row: ModelRow) => {
    removeModel.mutate(row.id, {
      // El 409 `AI_MODEL_IN_USE` (quitar el activo) llega aquí con su mensaje: "elige primero otro".
      onSuccess: () => toast.success(`"${row.displayName}" quitado del listado.`),
      onError: (err) => toast.error(aiErrorMessage(err)),
    });
  };

  const rows = state ? buildRows(state) : [];
  const planDefault = rows.find((row) => row.isPlanDefault);
  const orphanConfigured = state?.configured && !state.configuredAvailable ? state.configured : null;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-on-surface">Modelo de IA</h3>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          Es una configuración global: aplica a las conversaciones nuevas de toda la plataforma. Un
          hilo ya abierto conserva el modelo con el que nació.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : isError || !state ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-error/20 bg-error-container px-4 py-3">
          <TriangleAlert className="size-5 shrink-0 text-on-error-container" />
          <p className="text-sm text-on-error-container">{aiErrorMessage(error)}</p>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto border-outline-variant/60"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <ModelStateSummary state={state} />

          {orphanConfigured && (
            <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warning/30 bg-warning-container px-4 py-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-on-warning-container" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm text-on-warning-container">
                  El modelo configurado (
                  <span className="font-mono font-medium">{orphanConfigured}</span>) ya no está
                  disponible. Mientras tanto se está usando{' '}
                  <span className="font-medium">{labelFor(state, state.effective)}</span>. Elige
                  otro modelo del listado o vuelve al automático.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-outline-variant/60"
                  disabled={busy}
                  onClick={() => handleSelect(null)}
                >
                  {isActivating(null) ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  Volver al automático
                </Button>
              </div>
            </div>
          )}

          {!state.catalogAvailable && (
            <div className="flex items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3">
              <CloudOff className="mt-0.5 size-5 shrink-0 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                El motor de IA no respondió, así que el listado puede estar incompleto (solo se ven
                los modelos añadidos a mano). Puedes seguir cambiando el modelo desde aquí.
              </p>
            </div>
          )}

          <div className="space-y-2" role="radiogroup" aria-label="Modelo de IA de la plataforma">
            <ModelOptionRow
              selected={state.configured === null}
              title={AUTO_LABEL}
              description={
                planDefault
                  ? `Usa el modelo por defecto del plan de ChatGPT (${planDefault.displayName}).`
                  : 'Usa el modelo por defecto del plan de ChatGPT.'
              }
              activating={isActivating(null)}
              busy={busy}
              onSelect={() => handleSelect(null)}
            />

            {rows.map((row) => (
              <ModelOptionRow
                key={row.id}
                selected={state.configured === row.id}
                title={row.displayName}
                description={row.description || undefined}
                hint={row.id}
                badges={
                  <>
                    {row.isPlanDefault && (
                      <Badge
                        variant="outline"
                        className="border-tertiary/40 text-tertiary"
                      >
                        Por defecto del plan
                      </Badge>
                    )}
                    {row.source === 'manual' && (
                      <Badge
                        variant="outline"
                        className="border-outline-variant/60 text-on-surface-variant"
                      >
                        Añadido a mano
                      </Badge>
                    )}
                    {row.orphan && (
                      <Badge className="bg-warning-container text-on-warning-container">
                        Ya no disponible
                      </Badge>
                    )}
                  </>
                }
                activating={isActivating(row.id)}
                removing={removeModel.isPending && removeModel.variables === row.id}
                busy={busy}
                onSelect={() => handleSelect(row.id)}
                // Solo los `manual` se pueden quitar: los del catálogo los publica el motor.
                onRemove={row.source === 'manual' ? () => handleRemove(row) : undefined}
              />
            ))}
          </div>

          <AddModelForm busy={busy} pending={addModel.isPending} onAdd={handleAdd} />
        </>
      )}
    </section>
  );
}

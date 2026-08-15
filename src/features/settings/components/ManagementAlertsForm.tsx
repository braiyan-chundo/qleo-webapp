import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BellOff, BellRing, Loader2, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useManagementAlertSettings, useUpdateManagementAlertSettings } from '../hooks/use-settings';
import {
  MANAGEMENT_ALERT_RANGES,
  managementAlertsSchema,
  type ManagementAlertsFormValues,
} from '../schemas/settings.schema';

/** Campos numéricos de la pantalla, en el orden en que se leen. */
const FIELDS: readonly {
  name: keyof typeof MANAGEMENT_ALERT_RANGES;
  label: string;
  unit: string;
  help: string;
}[] = [
  {
    name: 'pendingThreshold',
    label: 'Acumulación de pendientes',
    unit: 'tareas',
    help: 'Se avisa cuando una persona llega a este número de tareas pendientes.',
  },
  {
    name: 'complianceThreshold',
    label: 'Cumplimiento mínimo aceptable',
    unit: '%',
    help: 'Se avisa cuando su porcentaje de cumplimiento cae por debajo de este valor — y solo si hay muestra suficiente.',
  },
  {
    name: 'complianceMinSample',
    label: 'Muestra mínima para fiarse del porcentaje',
    unit: 'compromisos',
    help: 'Debajo de esta cifra no se alerta y la tabla de rendimiento dice «sin datos suficientes» en vez de un porcentaje. Es el mismo listón en las dos pantallas.',
  },
  {
    name: 'breachThreshold',
    label: 'Reincidencia',
    unit: 'incumplimientos',
    help: 'Número de incumplimientos dentro de la ventana a partir del cual se avisa.',
  },
  {
    name: 'breachWindowDays',
    label: 'Ventana de reincidencia',
    unit: 'días',
    help: 'Periodo hacia atrás en el que se cuentan esos incumplimientos.',
  },
  {
    name: 'cooldownHours',
    label: 'Silencio entre avisos repetidos',
    unit: 'horas',
    help: 'Una situación que dura semanas no se avisa cada hora: se repite como mucho con esta frecuencia. Al bajar del umbral la condición se da por resuelta y el siguiente cruce vuelve a avisar en el acto.',
  },
  {
    name: 'maxOverduePerSweep',
    label: 'Tope de avisos de tarea vencida por barrido',
    unit: 'avisos',
    help: 'Acota la ráfaga del primer barrido. Lo que no entra se avisa en las horas siguientes: se reparte, no se pierde.',
  },
];

/**
 * (QL-200, §3.72 §4) Pantalla de **umbrales de las alertas de gestión** (`GET|PATCH
 * /settings/management-alerts`, **Dirección**). Vive en Configuración como un tab más.
 *
 * Dos cosas la gobiernan y las dos son de producto, no de estilo:
 *
 * 1. **El interruptor general va primero y bien visible.** `managementAlertsEnabled` nace en
 *    `true`, así que el **primer barrido tras desplegar** avisa de las tareas ya vencidas del
 *    histórico (medido en el clon de producción: 3 tareas × 4 directivos = **12 push reales**).
 *    Es un efecto del despliegue, no una decisión de nadie — y apagarlo aquí es la única palanca
 *    para estrenar la función en silencio y encenderla cuando el cliente lo decida. Un ajuste así
 *    no puede estar escondido al final de un formulario.
 * 2. **`complianceMinSample` se anuncia como lo que es: un listón compartido.** El mismo número
 *    decide si el cron alerta y si la tabla de rendimiento enseña el porcentaje o dice "sin datos
 *    suficientes". Quien lo sube tiene que saber que está tocando las dos pantallas.
 *
 * El backend valida los mismos rangos con 400; aquí se espejan (`MANAGEMENT_ALERT_RANGES`) para
 * que el error salga antes de enviar y no como un toast tras el fallo.
 */
export function ManagementAlertsForm() {
  const { data: settings, isLoading, isError, error } = useManagementAlertSettings();
  const updateSettings = useUpdateManagementAlertSettings();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ManagementAlertsFormValues>({
    resolver: zodResolver(managementAlertsSchema),
    // `values` (y no un `reset` en un efecto): el formulario se siembra con lo que llega del
    // servidor en el mismo render, sin el parpadeo de campos vacíos, y se vuelve a sembrar solo
    // con lo que devuelve el PATCH — así `isDirty` dice la verdad después de guardar.
    values: settings,
  });

  const enabled = watch('enabled');

  const onSubmit = handleSubmit((values) => {
    // El PATCH es parcial, pero se manda entero a propósito: es idempotente y así lo guardado
    // coincide exactamente con lo que el usuario está viendo en pantalla.
    updateSettings.mutate(values);
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
        <p className="text-sm font-medium text-on-error-container">
          No se pudieron cargar los umbrales de alertas
        </p>
        <p className="mt-1 text-xs text-on-error-container/80">
          {error instanceof Error ? error.message : 'Error desconocido'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-3xl space-y-4">
      {/* ── Interruptor general ── */}
      <Controller
        control={control}
        name="enabled"
        render={({ field }) => (
          <section
            className={cn(
              'rounded-xl border px-4 py-4 transition-colors',
              field.value
                ? 'border-outline-variant/50 bg-surface-container-low'
                : 'border-warning/30 bg-warning-container/40',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                  {field.value ? (
                    <BellRing className="size-4 text-on-surface-variant" />
                  ) : (
                    <BellOff className="size-4 text-on-surface-variant" />
                  )}
                  Alertas de gestión
                </p>
                <p className="mt-1 max-w-xl text-xs text-on-surface-variant">
                  {field.value
                    ? 'Activadas: Dirección recibe avisos de tareas vencidas, acumulación de pendientes, bajo cumplimiento y reincidencia. Llegan a la campana y como notificación push.'
                    : 'Desactivadas: no se emite ninguna alerta de gestión, ni a la campana ni por push. Los umbrales se conservan y todo vuelve al activarlas.'}
                </p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                <span className="text-on-surface">{field.value ? 'Activadas' : 'Apagadas'}</span>
              </label>
            </div>

            {/* El caso que motiva tener el interruptor tan a mano: estrenar en silencio. */}
            {field.value && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-container-lowest/70 px-3 py-2 text-xs text-on-surface-variant">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Puedes <strong className="font-medium text-on-surface">apagarlas</strong> en
                  cualquier momento. Es lo que conviene si quieres revisar los umbrales antes de
                  que salga el primer aviso: al encenderlas, el siguiente barrido avisa de las
                  tareas que ya están vencidas.
                </span>
              </p>
            )}
          </section>
        )}
      />

      {/* ── Umbrales ── */}
      <section
        className={cn(
          'rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 transition-opacity',
          !enabled && 'opacity-60',
        )}
      >
        <h3 className="text-sm font-semibold text-on-surface">Umbrales</h3>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          Cuándo salta cada aviso. Se pueden ajustar con las alertas apagadas: solo entran en
          juego cuando se encienden.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const range = MANAGEMENT_ALERT_RANGES[f.name];
            const fieldError = errors[f.name];
            return (
              <div key={f.name} className="grid gap-1.5">
                <Label htmlFor={f.name} className="text-on-surface">
                  {f.label}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.name}
                    type="number"
                    inputMode="numeric"
                    className={cn('h-10 w-32', fieldError && 'border-error')}
                    min={range.min}
                    max={range.max}
                    step={1}
                    // Sin `valueAsNumber` el input entrega `string` y el esquema —que espera
                    // enteros— fallaría en todos los campos a la vez.
                    {...register(f.name, { valueAsNumber: true })}
                  />
                  <span className="text-xs text-on-surface-variant">{f.unit}</span>
                </div>
                {fieldError ? (
                  <span className="text-xs font-medium text-error">{fieldError.message}</span>
                ) : (
                  <p className="text-xs text-on-surface-variant">{f.help}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={updateSettings.isPending || !isDirty}>
          {updateSettings.isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => reset(settings)}
          disabled={updateSettings.isPending || !isDirty}
        >
          Descartar cambios
        </Button>
      </div>
    </form>
  );
}

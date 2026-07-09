import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarCog, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useCalendarConfig,
  useGenerateHolidays,
  useUpdateCalendarConfig,
} from '../hooks/use-work-calendar';
import { SELECTABLE_WEEKDAYS } from '../lib/work-calendar';

/**
 * (QL-69) Panel de configuración del calendario laboral — **solo ADMIN** (la página vive bajo
 * `AdminRoute`). Ajusta los días de fin de semana (`weekendDays`), el toggle de festivos
 * colombianos automáticos (`autoColombianHolidays`) y permite precargar los festivos de un año.
 */
export function CalendarConfigPanel() {
  const { data: config, isLoading, isError, error } = useCalendarConfig();
  const updateConfig = useUpdateCalendarConfig();
  const generate = useGenerateHolidays();

  const currentYear = new Date().getFullYear();
  const [genYear, setGenYear] = useState<string>(String(currentYear));
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - 1 + i),
    [currentYear],
  );

  const setWeekendDays = (values: string[]) => {
    const weekendDays = values.map(Number).sort((a, b) => a - b);
    updateConfig.mutate(
      { weekendDays },
      {
        onSuccess: () => toast.success('Días de fin de semana actualizados'),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'No se pudo actualizar la configuración',
          ),
      },
    );
  };

  const toggleAuto = (next: boolean) => {
    updateConfig.mutate(
      { autoColombianHolidays: next },
      {
        onSuccess: () =>
          toast.success(
            next
              ? 'Festivos colombianos automáticos activados'
              : 'Festivos automáticos desactivados (se eliminaron los generados)',
          ),
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'No se pudo actualizar la configuración',
          ),
      },
    );
  };

  const runGenerate = () => {
    generate.mutate(Number(genYear), {
      onSuccess: () => toast.success(`Festivos colombianos de ${genYear} generados`),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : 'No se pudieron generar los festivos',
        ),
    });
  };

  return (
    <section className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
      <header className="mb-4 flex items-center gap-2">
        <CalendarCog className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-on-surface">
          Configuración del calendario
        </h2>
      </header>

      {isError ? (
        <div className="rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {error instanceof Error ? error.message : 'No se pudo cargar la configuración'}
        </div>
      ) : isLoading || !config ? (
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Días de fin de semana */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium text-on-surface">
              Días de fin de semana
            </Label>
            <p className="text-xs text-on-surface-variant">
              Estos días no cuentan como laborables al fijar y avisar sobre fechas límite.
            </p>
            <ToggleGroup
              type="multiple"
              value={config.weekendDays.map(String)}
              onValueChange={setWeekendDays}
              disabled={updateConfig.isPending}
              className="mt-1 flex-wrap"
              aria-label="Días de fin de semana"
            >
              {SELECTABLE_WEEKDAYS.map((d) => (
                <ToggleGroupItem
                  key={d.value}
                  value={String(d.value)}
                  aria-label={d.label}
                  className="min-w-11 border border-outline-variant/50 data-[state=on]:bg-secondary-container data-[state=on]:text-on-secondary-container"
                >
                  {d.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="h-px bg-outline-variant/40" />

          {/* Festivos colombianos automáticos */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label
                htmlFor="auto-holidays"
                className="flex items-center gap-1.5 text-sm font-medium text-on-surface"
              >
                <Sparkles className="size-4 text-on-surface-variant" />
                Festivos colombianos automáticos
              </Label>
              <p className="mt-1 text-xs text-on-surface-variant">
                Genera y considera los festivos oficiales de Colombia. Al desactivarlo se
                eliminan los generados; los festivos manuales se conservan.
              </p>
            </div>
            <Switch
              id="auto-holidays"
              checked={config.autoColombianHolidays}
              onCheckedChange={toggleAuto}
              disabled={updateConfig.isPending}
              aria-label="Festivos colombianos automáticos"
            />
          </div>

          <div className="h-px bg-outline-variant/40" />

          {/* Generar festivos de un año */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-on-surface">Precargar un año</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Los festivos automáticos se generan al consultarlos; usa esto para forzar un
                año concreto.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <Select value={genYear} onValueChange={setGenYear}>
                <SelectTrigger className="h-10 w-28">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={runGenerate}
                disabled={!config.autoColombianHolidays || generate.isPending}
                title={
                  config.autoColombianHolidays
                    ? undefined
                    : 'Activa los festivos automáticos primero'
                }
              >
                {generate.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generar
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

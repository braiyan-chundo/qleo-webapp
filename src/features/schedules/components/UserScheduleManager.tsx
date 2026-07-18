import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarOff,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import { ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label as FieldLabel } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { UserSelect, type SelectedUser } from '@/features/users/components/UserSelect';
import { useShifts } from '@/features/shifts/hooks/use-shifts';
import { formatShiftHours } from '@/features/shifts/lib/shift';

import {
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
  useUserSchedule,
  useUserScheduleVersions,
} from '../hooks/use-schedules';
import type { UserSchedule } from '../services/schedules.service';
import { overlappingShiftIds, parseYmdLocal } from '../lib/schedule';
import { dateToIsoDay, isoDayToDate } from '@/features/work-calendar/lib/holiday-date';

/** Nombre de cada día por índice (0=Dom … 6=Sáb), convención `weekdays` del backend. */
const WEEKDAY_LABELS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

const SATURDAY = 6;

/** Modo de la vista: consulta de la malla guardada, o edición (nueva / editar). */
type Mode = 'view' | 'edit';

/** Ventana mínima de un turno para pintarlo y detectar solapes. */
interface ShiftInfo {
  id: string;
  name: string;
  startMinute: number;
  endMinute: number;
  color: string | null;
}

/** `Date` local → `'YYYY-MM-DD'` de hoy. */
function todayIso(): string {
  return dateToIsoDay(new Date());
}

/** 7 arrays de ids vacíos, la malla "sin turnos". */
function emptyWeekdays(): string[][] {
  return Array.from({ length: 7 }, () => [] as string[]);
}

/**
 * Editor de **mallas horarias por usuario** (QL-163, §3.48, solo ADMIN). Es el contenido del tab
 * "Mallas" del Calendario ADMIN. Tiene **dos modos** (refactor a petición del cliente):
 *
 * - **Vista** (por defecto al elegir usuario): muestra la malla **guardada** (vigente) en solo
 *   lectura —turnos por día, sábado intermedio, vigencia— con acciones **Editar** y **Eliminar**.
 *   Si el usuario no tiene malla, un estado vacío con **Nueva malla**.
 * - **Edición**: se entra con **Nueva malla** (form vacío → botón *Guardar malla*, crea versión) o
 *   con **Editar** (form cargado con la malla → botón *Actualizar malla*, corrige la versión en
 *   sitio). Valida solapes de turnos por día y el ancla del sábado intermedio antes de guardar.
 */
export function UserScheduleManager() {
  const currentUser = useAuthStore((s) => s.user);

  const selfAsUser = useMemo<SelectedUser | null>(
    () =>
      currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl,
            avatarDownloadUrl: currentUser.avatarDownloadUrl,
          }
        : null,
    [currentUser],
  );

  const [selected, setSelected] = useState<SelectedUser | null>(selfAsUser);
  const userId = selected?.id;

  const { data: schedule, isLoading: scheduleLoading } = useUserSchedule(userId);
  const { data: versions } = useUserScheduleVersions(userId);
  const { data: catalog } = useShifts(true);

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const isSaving = createSchedule.isPending || updateSchedule.isPending;

  // --- Modo + versión mostrada en solo lectura ---
  const [mode, setMode] = useState<Mode>('view');
  /** Versión que se muestra en modo vista (por defecto la vigente; puede ser una del historial). */
  const [viewVersion, setViewVersion] = useState<UserSchedule | null>(null);

  // --- Estado editable de la malla (modo edición) ---
  const [weekdays, setWeekdays] = useState<string[][]>(emptyWeekdays);
  const [saturdayAlternate, setSaturdayAlternate] = useState(false);
  const [saturdayAnchor, setSaturdayAnchor] = useState<string | null>(null);
  const [validFrom, setValidFrom] = useState<string>(todayIso);
  /** Id de la versión cargada en el editor; `null` = malla nueva (aún sin persistir). */
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadEditorFrom = (source: UserSchedule | null) => {
    if (!source) {
      setWeekdays(emptyWeekdays());
      setSaturdayAlternate(false);
      setSaturdayAnchor(null);
      setValidFrom(todayIso());
      setEditingVersionId(null);
      return;
    }
    setWeekdays(source.weekdays.map((w) => w.shifts.map((s) => s.id)));
    setSaturdayAlternate(source.saturdayAlternate);
    setSaturdayAnchor(source.saturdayAnchor);
    setValidFrom(source.validFrom);
    setEditingVersionId(source.id);
  };

  // Al cambiar de usuario (o tras cargar por primera vez) volvemos a **modo vista** mostrando la
  // malla vigente. No se re-dispara al editar (acción manual) ni al recargar por otras causas: solo
  // cuando el usuario cambia. Las mutaciones fuerzan el re-sync poniendo el ref a `null`.
  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    if (schedule === undefined) return; // aún cargando
    if (initializedForRef.current === userId) return;
    initializedForRef.current = userId;
    setMode('view');
    setViewVersion(schedule ?? null);
  }, [userId, schedule]);

  // Mapa id → info del turno (catálogo completo, incluidos retirados para poder pintar una versión
  // antigua que aún los referencie).
  const shiftById = useMemo(() => {
    const map = new Map<string, ShiftInfo>();
    for (const s of catalog ?? []) {
      map.set(s.id, {
        id: s.id,
        name: s.name,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
        color: s.color,
      });
    }
    return map;
  }, [catalog]);

  const activeShifts = useMemo(() => (catalog ?? []).filter((s) => s.active), [catalog]);

  // Ids en solape, por día, para el aviso visual (modo edición).
  const overlapByDay = useMemo(
    () =>
      weekdays.map((ids) => {
        const windows = ids
          .map((id) => shiftById.get(id))
          .filter((s): s is ShiftInfo => !!s);
        return overlappingShiftIds(windows);
      }),
    [weekdays, shiftById],
  );
  const hasAnyOverlap = overlapByDay.some((set) => set.size > 0);

  // El sábado tiene turnos → el ancla es obligatoria y debe caer en sábado.
  const saturdayHasShifts = weekdays[SATURDAY].length > 0;
  const anchorDate = saturdayAnchor ? parseYmdLocal(saturdayAnchor) : null;
  const anchorIsSaturday = !!anchorDate && anchorDate.getDay() === SATURDAY;
  const anchorRequired = saturdayAlternate && saturdayHasShifts;
  const anchorInvalid = anchorRequired && !anchorIsSaturday;

  const addShift = (dayIndex: number, shiftId: string) => {
    setWeekdays((prev) =>
      prev.map((ids, i) =>
        i === dayIndex && !ids.includes(shiftId) ? [...ids, shiftId] : ids,
      ),
    );
  };

  const removeShift = (dayIndex: number, shiftId: string) => {
    setWeekdays((prev) =>
      prev.map((ids, i) => (i === dayIndex ? ids.filter((id) => id !== shiftId) : ids)),
    );
  };

  // --- Transiciones de modo ---
  const startNewSchedule = () => {
    loadEditorFrom(null);
    setMode('edit');
  };

  const startEdit = () => {
    loadEditorFrom(viewVersion);
    setMode('edit');
  };

  const cancelEdit = () => {
    setMode('view');
  };

  const buildDto = () => ({
    validFrom,
    weekdays: weekdays.map((ids) => ({ shiftIds: ids })),
    saturdayAlternate,
    saturdayAnchor: saturdayAlternate ? saturdayAnchor : null,
  });

  const validateBeforeSave = (): boolean => {
    if (!validFrom) {
      toast.error('Indica desde cuándo rige la malla (vigencia).');
      return false;
    }
    if (hasAnyOverlap) {
      toast.error('Hay turnos que se solapan en un mismo día. Corrígelos antes de guardar.');
      return false;
    }
    if (anchorInvalid) {
      toast.error('El sábado intermedio necesita un sábado de referencia válido.');
      return false;
    }
    return true;
  };

  const onSaveError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'SHIFT_OVERLAP') {
        toast.error('Dos turnos del mismo día se solapan.');
        return;
      }
      if (err.code === 'SCHEDULE_ANCHOR_REQUIRED') {
        toast.error('Falta un sábado de referencia válido para el sábado intermedio.');
        return;
      }
      if (err.code === 'SCHEDULE_SHIFT_NOT_FOUND') {
        toast.error('Alguno de los turnos ya no existe o fue retirado. Revísalos.');
        return;
      }
    }
    toast.error(err instanceof Error ? err.message : 'No se pudo guardar la malla.');
  };

  const handleCreate = () => {
    if (!userId || !validateBeforeSave()) return;
    createSchedule.mutate(
      { userId, ...buildDto() },
      {
        onSuccess: (created) => {
          toast.success('Malla guardada.');
          setViewVersion(created);
          setMode('view');
          // Re-sincroniza con la vigente del servidor al refrescar (por si difiere).
          initializedForRef.current = null;
        },
        onError: onSaveError,
      },
    );
  };

  const handleUpdate = () => {
    if (!editingVersionId || !validateBeforeSave()) return;
    updateSchedule.mutate(
      { id: editingVersionId, dto: buildDto() },
      {
        onSuccess: (updated) => {
          toast.success('Malla actualizada.');
          setViewVersion(updated);
          setMode('view');
          initializedForRef.current = null;
        },
        onError: onSaveError,
      },
    );
  };

  const handleSave = () => {
    if (editingVersionId) handleUpdate();
    else handleCreate();
  };

  const handleDelete = () => {
    if (!viewVersion) return;
    deleteSchedule.mutate(viewVersion.id, {
      onSuccess: () => {
        toast.success('Malla eliminada.');
        setConfirmDelete(false);
        setMode('view');
        setViewVersion(null);
        initializedForRef.current = null; // recargar a la nueva vigente (o vacío)
      },
      onError: (err) => {
        setConfirmDelete(false);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la malla.');
      },
    });
  };

  const noShifts = (catalog ?? []).length === 0;

  return (
    <div className="space-y-6">
      {/* Selector de usuario + acción principal */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-on-surface">Usuario</span>
          <UserSelect
            value={selected}
            onChange={setSelected}
            className="w-64"
            placeholder="Elegir usuario…"
          />
        </div>
        {selected && mode === 'view' && (
          <Button variant="outline" onClick={startNewSchedule} className="h-11">
            <Plus />
            Nueva malla
          </Button>
        )}
      </div>

      {!selected ? (
        <div className="rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-12 text-center text-sm text-on-surface-variant">
          Elige un usuario para consultar o configurar su malla horaria.
        </div>
      ) : scheduleLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : mode === 'view' ? (
        // ─────────────── MODO VISTA (solo lectura de la malla guardada) ───────────────
        !viewVersion ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-12 text-center">
            <CalendarOff className="size-8 text-tertiary" />
            <div className="grid gap-1">
              <span className="text-sm font-medium text-on-surface">
                Este usuario no tiene mallas asignadas
              </span>
              <span className="text-sm text-on-surface-variant">
                Usa <b>Nueva malla</b> para crear su primera malla horaria.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Historial de versiones (si hay más de una) para previsualizarlas en solo lectura */}
            {(versions ?? []).length > 1 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-on-surface">Versiones</span>
                <div className="flex flex-wrap gap-2">
                  {(versions ?? []).map((version) => {
                    const isViewing = version.id === viewVersion.id;
                    const isCurrent = version.id === schedule?.id;
                    return (
                      <Button
                        key={version.id}
                        type="button"
                        variant={isViewing ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewVersion(version)}
                      >
                        Desde {version.validFrom}
                        {isCurrent && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'ml-1 border-tertiary/40 text-tertiary',
                              isViewing && 'border-on-primary/40 text-on-primary',
                            )}
                          >
                            Vigente
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resumen semanal en solo lectura */}
            <div className="divide-y divide-outline-variant/40 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-low">
              {WEEKDAY_LABELS.map((label, dayIndex) => {
                const shifts = viewVersion.weekdays[dayIndex]?.shifts ?? [];
                return (
                  <div
                    key={label}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start"
                  >
                    <span className="w-24 shrink-0 pt-1 text-sm font-medium text-on-surface">
                      {label}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {shifts.length === 0 ? (
                        <span className="py-1 text-sm text-on-surface-variant/70">Descanso</span>
                      ) : (
                        shifts.map((shift) => (
                          <span
                            key={shift.id}
                            className="flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface py-1 pr-2.5 pl-2 text-xs text-on-surface"
                          >
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: shift.color ?? 'var(--color-primary)' }}
                              aria-hidden
                            />
                            <span className="font-medium">{shift.name}</span>
                            <span className="tabular-nums text-on-surface-variant">
                              {formatShiftHours(shift)}
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {viewVersion.saturdayAlternate && (
              <p className="text-xs text-on-surface-variant">
                <b>Sábado intermedio</b>: los turnos del sábado rigen semanas alternas
                {viewVersion.saturdayAnchor
                  ? `, ancladas al sábado ${viewVersion.saturdayAnchor}.`
                  : '.'}
              </p>
            )}

            {/* Vigencia + acciones sobre la malla */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
              <span className="text-sm text-on-surface-variant">
                Vigente desde <b className="text-on-surface">{viewVersion.validFrom}</b>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={startEdit}>
                  <Pencil />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  className="text-error hover:bg-error-container hover:text-on-error-container"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteSchedule.isPending}
                >
                  <Trash2 />
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )
      ) : (
        // ─────────────────────────── MODO EDICIÓN ───────────────────────────
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-0.5">
              <h3 className="text-lg font-semibold text-on-surface">
                {editingVersionId ? 'Editar malla' : 'Nueva malla'}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {editingVersionId
                  ? 'Modifica los turnos de la malla y actualiza.'
                  : 'Configura los turnos de cada día y guarda la nueva malla.'}
              </p>
            </div>
            <Button variant="ghost" onClick={cancelEdit} disabled={isSaving}>
              <X />
              Cancelar
            </Button>
          </div>

          {noShifts && (
            <div className="flex items-start gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3 text-sm text-on-surface-variant">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tertiary" />
              <span>
                Aún no hay turnos en el catálogo. Créalos en el tab <b>Turnos</b> para poder
                asignarlos aquí.
              </span>
            </div>
          )}

          <p className="text-xs text-on-surface-variant">
            El patrón es <b>semanal</b>: se repite cada semana automáticamente. Configura los turnos
            de cada día una sola vez.
          </p>

          {/* Editor por día de la semana */}
          <div className="divide-y divide-outline-variant/40 overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-low">
            {WEEKDAY_LABELS.map((label, dayIndex) => {
              const ids = weekdays[dayIndex];
              const overlaps = overlapByDay[dayIndex];
              const available = activeShifts.filter((s) => !ids.includes(s.id));
              return (
                <div key={label} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <span className="w-24 shrink-0 pt-1.5 text-sm font-medium text-on-surface">
                    {label}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {ids.length === 0 && (
                      <span className="py-1.5 text-sm text-on-surface-variant/70">Descanso</span>
                    )}
                    {ids.map((id) => {
                      const info = shiftById.get(id);
                      if (!info) return null;
                      const isOverlap = overlaps.has(id);
                      return (
                        <span
                          key={id}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-xs',
                            isOverlap
                              ? 'border-error/50 bg-error-container text-on-error-container'
                              : 'border-outline-variant/60 bg-surface text-on-surface',
                          )}
                        >
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: info.color ?? 'var(--color-primary)',
                            }}
                            aria-hidden
                          />
                          <span className="font-medium">{info.name}</span>
                          <span className="tabular-nums text-on-surface-variant">
                            {formatShiftHours(info)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShift(dayIndex, id)}
                            aria-label={`Quitar ${info.name} de ${label}`}
                            className="ml-0.5 flex size-5 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      );
                    })}

                    <Popover>
                      <PopoverTrigger asChild disabled={available.length === 0}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-on-surface-variant"
                        >
                          <Plus className="size-3.5" />
                          Añadir turno
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-0">
                        <Command>
                          <CommandList>
                            <CommandEmpty className="text-on-surface-variant">
                              Sin turnos disponibles
                            </CommandEmpty>
                            <CommandGroup>
                              {available.map((shift) => (
                                <CommandItem
                                  key={shift.id}
                                  value={`${shift.name} ${shift.id}`}
                                  onSelect={() => addShift(dayIndex, shift.id)}
                                  className="gap-2"
                                >
                                  <span
                                    className="size-3 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: shift.color ?? 'var(--color-primary)',
                                    }}
                                    aria-hidden
                                  />
                                  <span className="flex-1 truncate">{shift.name}</span>
                                  <span className="tabular-nums text-xs text-on-surface-variant">
                                    {formatShiftHours(shift)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {overlaps.size > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-error">
                        <AlertTriangle className="size-3.5" />
                        Turnos solapados
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sábado intermedio */}
          <div className="grid gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <FieldLabel htmlFor="saturday-alternate" className="text-on-surface">
                  Sábado intermedio
                </FieldLabel>
                <span className="text-xs text-on-surface-variant">
                  Los turnos del sábado rigen solo semanas alternas, ancladas a un sábado de
                  referencia.
                </span>
              </div>
              <Switch
                id="saturday-alternate"
                checked={saturdayAlternate}
                onCheckedChange={setSaturdayAlternate}
              />
            </div>

            {saturdayAlternate && (
              <div className="grid gap-1.5">
                <FieldLabel htmlFor="saturday-anchor" className="text-xs text-on-surface-variant">
                  Sábado de referencia {anchorRequired && <span className="text-error">*</span>}
                </FieldLabel>
                <DatePicker
                  id="saturday-anchor"
                  className={cn('w-full sm:w-64', anchorInvalid && 'border-error')}
                  value={isoDayToDate(saturdayAnchor ?? '')}
                  onChange={(date) => setSaturdayAnchor(dateToIsoDay(date) || null)}
                  disabledDays={(date) => date.getDay() !== SATURDAY}
                  placeholder="Elegir un sábado"
                />
                {anchorInvalid ? (
                  <span className="text-xs font-medium text-error">
                    Selecciona un sábado como referencia.
                  </span>
                ) : (
                  anchorIsSaturday && (
                    <span className="text-xs text-on-surface-variant">
                      Trabaja sábados alternos desde el {saturdayAnchor}.
                    </span>
                  )
                )}
              </div>
            )}
          </div>

          {/* Vigencia + guardar/actualizar */}
          <div className="grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="valid-from" className="text-xs text-on-surface-variant">
                Vigente desde <span className="text-error">*</span>
              </FieldLabel>
              <DatePicker
                id="valid-from"
                className="w-full sm:w-64"
                value={isoDayToDate(validFrom)}
                onChange={(date) => setValidFrom(dateToIsoDay(date))}
                placeholder="Elegir fecha"
              />
              <span className="text-xs text-on-surface-variant">
                {editingVersionId
                  ? 'Al actualizar se corrige esta versión sin crear una nueva.'
                  : 'La malla rige desde esta fecha; las versiones anteriores se conservan.'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={isSaving || noShifts}>
                {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                {editingVersionId ? 'Actualizar malla' : 'Guardar malla'}
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={isSaving}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta malla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la malla vigente desde {viewVersion?.validFrom ?? '—'}. Si era la
              vigente, regirá la anterior (o ninguna). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSchedule.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteSchedule.isPending}
            >
              {deleteSchedule.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

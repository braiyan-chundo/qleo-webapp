import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarOff, EyeOff, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
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
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AvatarCell,
  DataCard,
  DataCardRow,
  DataTableCard,
  TablePagination,
} from '@/shared/components/data-table';
import { useDebounce } from '@/shared/hooks/use-debounce';

import {
  useAbsenceTypes,
  useAbsencesList,
  useDeleteAbsence,
} from '../hooks/use-absences';
import type { Absence, AbsenceType } from '../services/absences.service';
import { formatAbsenceDay } from '../lib/absence';
import { AbsenceFormDialog } from './AbsenceFormDialog';

const PAGE_SIZE = 12;
const ALL = 'ALL';

/** Rango legible de una ausencia ("10 de agosto – 20 de agosto"). `to` es inclusivo. */
function rangeLabel(absence: Absence): string {
  return `${formatAbsenceDay(absence.from)} – ${formatAbsenceDay(absence.to)}`;
}

/**
 * Gestión de **ausencias** (QL-199, §3.71 §4). Contenido del tab "Ausencias" del Calendario;
 * todo el CRUD es de Dirección (`MANAGER`+) — un MEMBER recibe 403 en las cinco rutas, así que
 * ni se le ofrece la pantalla.
 *
 * ⚠️ **Es la única superficie que ve el tipo real y la nota.** El backend enmascara tres de los
 * cinco tipos como "No disponible" en los canales abiertos y no manda la nota por ninguno de
 * ellos. Aquí se pinta todo porque es la pantalla de RRHH; en cualquier otro sitio (calendario,
 * aviso del formulario de tarea) se pinta **lo que venga y solo lo que venga**.
 *
 * Sin filtros el listado devuelve **todas**, pasadas y futuras: es el histórico, no el aviso. El
 * filtro por fechas trabaja **por solape**, así que "agosto" incluye unas vacaciones que empezaron
 * el 28 de julio.
 */
export function AbsencesManager() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [type, setType] = useState<'ALL' | AbsenceType>(ALL);
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Absence | null>(null);
  const [deleting, setDeleting] = useState<Absence | null>(null);

  const { data: types } = useAbsenceTypes();
  const deleteAbsence = useDeleteAbsence();

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      type: type === ALL ? undefined : type,
    }),
    [page, debouncedSearch, type],
  );

  const { data, isLoading, isError, error, isFetching } = useAbsencesList(params);

  const absences = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** ¿Este tipo se enmascara a terceros? Sale del catálogo, no de una lista escrita a mano. */
  const sensitiveTypes = useMemo(
    () => new Set((types ?? []).filter((t) => t.sensitive).map((t) => t.key)),
    [types],
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (absence: Absence) => {
    setEditing(absence);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    deleteAbsence.mutate(target.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success('Ausencia eliminada.');
      },
      onError: (err) => {
        setDeleting(null);
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la ausencia.');
      },
    });
  };

  /** Celda de tipo: etiqueta real + marca de "reservado" cuando el equipo verá "No disponible". */
  const renderType = (absence: Absence) => (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-on-surface">{absence.typeLabel}</span>
      {sensitiveTypes.has(absence.type) && (
        <Badge
          variant="outline"
          className="gap-1 border-outline-variant/60 font-normal text-on-surface-variant"
          title='El resto del equipo solo ve "No disponible".'
        >
          <EyeOff className="size-3" aria-hidden />
          Reservado
        </Badge>
      )}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Ausencias</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-on-surface-variant">
            Vacaciones, permisos, incapacidades y salidas de oficina. Qleo <strong>avisa</strong>{' '}
            al asignar una tarea a alguien que no está, pero nunca lo impide.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10">
          <Plus />
          Nueva ausencia
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por persona…"
            className="h-10 border-outline-variant/50 bg-surface-container-low pl-9"
          />
        </div>
        <NativeSelect
          className="w-52 [&>select]:h-10"
          value={type}
          onChange={(e) => {
            setType(e.target.value as typeof type);
            setPage(1);
          }}
          aria-label="Filtrar por tipo"
        >
          <NativeSelectOption value={ALL}>Todos los tipos</NativeSelectOption>
          {(types ?? []).map((item) => (
            <NativeSelectOption key={item.key} value={item.key}>
              {item.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudieron cargar las ausencias
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : absences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <CalendarOff className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">
            {search.trim() || type !== ALL ? 'Sin resultados' : 'Aún no hay ausencias'}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            {search.trim() || type !== ALL
              ? 'Ninguna ausencia coincide con los filtros.'
              : 'Registra la primera para que el equipo vea quién no está y Qleo avise al asignar tareas.'}
          </p>
        </div>
      ) : (
        <>
          <DataTableCard
            cards={absences.map((absence) => (
              <DataCard key={absence.id}>
                <AvatarCell
                  name={absence.user.name}
                  subtitle={rangeLabel(absence)}
                  avatarDownloadUrl={absence.user.avatarDownloadUrl}
                />
                <DataCardRow label="Tipo">{renderType(absence)}</DataCardRow>
                <DataCardRow label="Días">{absence.days}</DataCardRow>
                <DataCardRow label="Vuelve">
                  {formatAbsenceDay(absence.returnsOn)}
                </DataCardRow>
                <DataCardRow label="Registró">{absence.createdBy?.name ?? '—'}</DataCardRow>
                {absence.note && (
                  <DataCardRow label="Nota">{absence.note}</DataCardRow>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(absence)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error-container hover:text-on-error-container"
                    onClick={() => setDeleting(absence)}
                  >
                    Eliminar
                  </Button>
                </div>
              </DataCard>
            ))}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fechas</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Vuelve</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Registró</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {absences.map((absence) => (
                <TableRow key={absence.id}>
                  <TableCell>
                    <AvatarCell
                      name={absence.user.name}
                      avatarDownloadUrl={absence.user.avatarDownloadUrl}
                    />
                  </TableCell>
                  <TableCell>{renderType(absence)}</TableCell>
                  <TableCell className="whitespace-nowrap text-on-surface-variant">
                    {rangeLabel(absence)}
                  </TableCell>
                  <TableCell className="tabular-nums text-on-surface-variant">
                    {absence.days}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-on-surface-variant">
                    {formatAbsenceDay(absence.returnsOn)}
                  </TableCell>
                  {/* La nota vive SOLO aquí. Ningún otro componente la recibe. */}
                  <TableCell className="max-w-48 truncate text-on-surface-variant" title={absence.note ?? ''}>
                    {absence.note || '—'}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {absence.createdBy?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-on-surface-variant"
                        onClick={() => openEdit(absence)}
                        aria-label={`Editar la ausencia de ${absence.user.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-on-surface-variant hover:text-error"
                        onClick={() => setDeleting(absence)}
                        aria-label={`Eliminar la ausencia de ${absence.user.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTableCard>

          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            itemLabel={total === 1 ? 'ausencia' : 'ausencias'}
            disabled={isFetching}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      <AbsenceFormDialog open={formOpen} absence={editing} onOpenChange={setFormOpen} />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la ausencia?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `Se eliminará la ausencia de ${deleting.user.name} (${rangeLabel(deleting)}). Dejará de aparecer en el calendario y en los avisos al asignar tareas.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAbsence.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleteAbsence.isPending}
            >
              {deleteAbsence.isPending && <Loader2 className="animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

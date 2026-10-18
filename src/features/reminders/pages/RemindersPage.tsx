import { useState, type ReactNode } from 'react';
import { AlarmClock, ChevronDown, ChevronRight, Globe, Info, Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { ReminderResponseDto } from '../types/reminder.types';
import { useReminders } from '../hooks/use-reminders';
import { bogotaToday } from '../lib/bogota-time';
import { groupReminders, REMINDER_LIMIT } from '../lib/reminder-display';
import { REMINDER_ERROR_TEXT } from '../lib/reminder-errors';
import { ReminderFormDialog } from '../components/ReminderFormDialog';
import { ReminderRow } from '../components/ReminderRow';

/** Qué muestra el formulario: un alta o la edición de un id (con su copia del momento de abrir). */
type FormTarget = { mode: 'create' } | { mode: 'edit'; id: string; snapshot: ReminderResponseDto };

/**
 * Vista **Recordatorios** (`/recordatorios`, HU-0202). Para toda cuenta autenticada, sin gate de
 * rol ni de perfil (D-15): la API solo devuelve los de quien llama. Tres grupos —Activos (por
 * `nextFireAt`, el orden del servidor), En pausa y Cumplidos (plegado, DS-9)—; un grupo vacío no
 * se pinta. Sin sondeo: la refrescan el bus (`reminder`, `task`) y las mutaciones.
 */
export function RemindersPage() {
  const { data, isLoading, isError, refetch, isRefetching } = useReminders();
  const [formOpen, setFormOpen] = useState(false);
  // El destino se conserva al cerrar: así el título no cambia durante la animación de cierre.
  const [target, setTarget] = useState<FormTarget>({ mode: 'create' });
  const [doneOpen, setDoneOpen] = useState(false);

  const reminders = data ?? [];
  const groups = groupReminders(reminders);
  const atLimit = reminders.length >= REMINDER_LIMIT;
  const empty = !isLoading && !isError && reminders.length === 0;
  const today = bogotaToday();

  // Se edita el recordatorio **de la caché**: si se relee (bus, 409), el formulario lo ve fresco;
  // si desapareció, el formulario se cierra.
  const editing =
    target.mode === 'edit' ? (reminders.find((r) => r.id === target.id) ?? null) : null;
  const dialogOpen = formOpen && (target.mode === 'create' || editing !== null);

  const openCreate = () => {
    setTarget({ mode: 'create' });
    setFormOpen(true);
  };
  const openEdit = (reminder: ReminderResponseDto) => {
    setTarget({ mode: 'edit', id: reminder.id, snapshot: reminder });
    setFormOpen(true);
  };

  const newButton = (
    <Button
      type="button"
      className="h-10 max-md:h-11 max-md:w-full"
      onClick={openCreate}
      disabled={atLimit}
    >
      <Plus />
      Nuevo recordatorio
    </Button>
  );

  let content: ReactNode;
  if (isLoading) {
    content = (
      <div aria-busy="true">
        <Skeleton className="mb-3 h-4 w-24" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="mb-2 h-[68px] w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (isError) {
    content = (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/20 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
        <span>No pudimos cargar tus recordatorios. Revisa tu conexión y vuelve a intentarlo.</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn(isRefetching && 'animate-spin')} />
          Reintentar
        </Button>
      </div>
    );
  } else if (empty) {
    content = (
      <Empty className="gap-2 rounded-xl border-0 bg-surface-container-lowest px-6 py-10 dark:bg-surface-container-low">
        <EmptyHeader className="gap-2">
          <EmptyMedia className="mb-1 size-11 rounded-xl bg-primary-container text-on-primary-container">
            <AlarmClock className="size-[22px]" />
          </EmptyMedia>
          <EmptyTitle className="text-base font-semibold text-on-surface">
            Aún no tienes recordatorios
          </EmptyTitle>
          <EmptyDescription className="max-w-[420px] text-sm text-on-surface-variant">
            Ponte un aviso a la hora exacta para algo que debes hacer: una vez, ciertos días o
            cada pocas horas. No es una tarea: solo te avisa a ti.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="mt-2">
          <Button type="button" className="h-10 max-md:h-11" onClick={openCreate}>
            <Plus />
            Crear mi primer recordatorio
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else {
    content = (
      <div className="space-y-6">
        {groups.active.length > 0 && (
          <ReminderGroupSection title="Activos" count={groups.active.length}>
            {groups.active.map((r) => (
              <ReminderRow key={r.id} reminder={r} today={today} onEdit={() => openEdit(r)} />
            ))}
          </ReminderGroupSection>
        )}
        {groups.paused.length > 0 && (
          <ReminderGroupSection title="En pausa" count={groups.paused.length}>
            {groups.paused.map((r) => (
              <ReminderRow key={r.id} reminder={r} today={today} onEdit={() => openEdit(r)} />
            ))}
          </ReminderGroupSection>
        )}
        {groups.done.length > 0 && (
          <Collapsible open={doneOpen} onOpenChange={setDoneOpen} asChild>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-on-surface-variant">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="-ml-2 h-8 gap-2 px-2 text-sm font-semibold text-on-surface-variant max-md:h-11"
                  >
                    {doneOpen ? <ChevronDown /> : <ChevronRight />}
                    Cumplidos
                    <span className="font-medium tabular-nums">{groups.done.length}</span>
                  </Button>
                </CollapsibleTrigger>
              </h2>
              <CollapsibleContent>
                <ul className="flex flex-col gap-2">
                  {groups.done.map((r) => (
                    <ReminderRow key={r.id} reminder={r} today={today} onEdit={() => openEdit(r)} />
                  ))}
                </ul>
              </CollapsibleContent>
            </section>
          </Collapsible>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
            <AlarmClock className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-on-surface md:text-3xl">Recordatorios</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-on-surface-variant">
              <span>Avisos que solo ves tú</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                <Globe className="size-3" aria-hidden />
                Hora de Bogotá
              </span>
            </p>
          </div>
        </div>
        {/* Vacía: la invitación ya lleva su botón; no se repite arriba. */}
        {!empty && <div className="max-md:w-full">{newButton}</div>}
      </header>

      {atLimit && (
        <p className="-mt-2 mb-5 flex items-start gap-2 text-[13px] text-on-surface-variant">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{REMINDER_ERROR_TEXT.limitReached}</span>
        </p>
      )}

      <div className="max-w-3xl">{content}</div>

      <ReminderFormDialog
        open={dialogOpen}
        onOpenChange={setFormOpen}
        reminder={target.mode === 'edit' ? (editing ?? target.snapshot) : null}
      />
    </div>
  );
}

function ReminderGroupSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
        {title}
        <span className="font-medium tabular-nums">{count}</span>
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

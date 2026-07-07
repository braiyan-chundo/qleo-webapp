import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

import type { Stage } from '@/features/stages/services/stages.service';

import type { UseTaskFiltersResult } from '../hooks/use-task-filters';

interface BoardFilterPanelProps {
  filters: UseTaskFiltersResult;
  stages: Stage[] | undefined;
}

/**
 * Contenido del popover "Filtrar" del tablero. Presentacional: recibe el estado de filtros
 * (persistido en la URL) desde {@link useTaskFilters} y las etapas del proyecto para poblar
 * el select. Los mismos filtros se aplican a todas las vistas del board.
 */
export function BoardFilterPanel({ filters, stages }: BoardFilterPanelProps) {
  const {
    searchValue,
    setSearchValue,
    stageId,
    setStageId,
    assigneeId,
    setAssigneeId,
    status,
    setStatus,
    assigneeOptions,
    hasActiveFilters,
    clear,
  } = filters;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-on-surface">Filtros del tablero</p>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-on-surface-variant"
            onClick={clear}
          >
            <X className="size-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar por título…"
          className="pl-8"
          aria-label="Buscar tareas por título"
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-on-surface-variant">Etapa</span>
        <NativeSelect
          value={stageId}
          onChange={(e) => setStageId(e.target.value)}
          aria-label="Filtrar por etapa"
        >
          <NativeSelectOption value="">Todas</NativeSelectOption>
          {stages?.map((stage) => (
            <NativeSelectOption key={stage.id} value={stage.id}>
              {stage.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-on-surface-variant">Responsable</span>
        <NativeSelect
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          aria-label="Filtrar por responsable"
        >
          <NativeSelectOption value="">Todos</NativeSelectOption>
          {assigneeOptions.map((option) => (
            <NativeSelectOption key={option.userId} value={option.userId}>
              {option.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-on-surface-variant">Estado</span>
        <NativeSelect
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as UseTaskFiltersResult['status'])
          }
          aria-label="Filtrar por estado de cierre"
        >
          <NativeSelectOption value="all">Todas</NativeSelectOption>
          <NativeSelectOption value="active">Activas</NativeSelectOption>
          <NativeSelectOption value="completed">Completadas</NativeSelectOption>
        </NativeSelect>
      </label>
    </div>
  );
}

import { useEffect, useRef } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

import type { Project } from '../types/project';
import { formatDate } from '../utils/dates';
import { ProjectMembersPanel } from './ProjectMembersPanel';

interface MetaFieldProps {
  label: string;
  value?: string;
}

/** Par etiqueta/valor de la ficha del proyecto (valor vacío → guion largo). */
function MetaField({ label, value }: MetaFieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-on-surface-variant">{label}</p>
      <p className="truncate text-sm font-medium text-on-surface" title={value}>
        {value || '—'}
      </p>
    </div>
  );
}

interface ProjectDetailsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gate cosmético de la gestión de miembros (`ADMIN || creador`); el backend valida igual. */
  canManage: boolean;
  /**
   * Abre el diálogo con el bloque de miembros a la vista (se entra desde el avatar-group de
   * la cabecera). Solo hace scroll dentro del diálogo; no cambia el contenido.
   */
  focusMembers?: boolean;
}

/**
 * Ficha del proyecto fuera del flujo principal (board-first, QL-36): la cabecera del detalle
 * se queda con lo imprescindible (título, código, estado, descripción) y los metadatos +
 * la membresía real (QL-51/QL-52) viven aquí, en un modal que se abre desde el menú `···`
 * o desde el avatar-group de miembros.
 */
export function ProjectDetailsDialog({
  project,
  open,
  onOpenChange,
  canManage,
  focusMembers = false,
}: ProjectDetailsDialogProps) {
  const membersRef = useRef<HTMLDivElement>(null);

  // Al entrar desde los avatares, deja los miembros a la vista (el diálogo puede scrollear).
  useEffect(() => {
    if (!open || !focusMembers) return;
    membersRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, focusMembers]);

  const dateRange =
    project.startDate || project.endDate
      ? `${formatDate(project.startDate) || '—'} → ${formatDate(project.endDate) || '—'}`
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalles del proyecto</DialogTitle>
          <DialogDescription>{project.name}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <MetaField label="Cliente / grupo" value={project.clientGroup} />
          <MetaField label="Fechas" value={dateRange} />
          <MetaField label="Creado" value={formatDate(project.createdAt)} />
        </div>

        <Separator className="bg-outline-variant/40" />

        <div ref={membersRef}>
          <ProjectMembersPanel
            projectId={project.id}
            createdBy={project.createdBy}
            managerIds={project.managerIds}
            canManage={canManage}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

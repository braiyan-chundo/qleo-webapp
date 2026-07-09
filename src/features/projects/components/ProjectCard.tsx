import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Calendar,
  Eye,
  MoreVertical,
  Pencil,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthedAvatar } from '@/shared/components/AuthedAvatar';
import { projectDot } from '@/features/tasks/lib/palette';

import type { Project, ProjectStatus } from '../types/project';
import { formatDate } from '../utils/dates';

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
  onArchive: (project: Project) => void;
}

/**
 * Etiqueta + par tonal M3 de cada estado derivado (QL-37). Nunca hex: se usan pares
 * `*-container`/`on-*-container` para contraste correcto en claro y oscuro.
 */
const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: 'Activo',
    className: 'bg-tertiary-container text-on-tertiary-container',
  },
  PLANNING: {
    label: 'Planificación',
    className: 'bg-secondary-container text-on-secondary-container',
  },
  CLOSING: {
    label: 'Cierre',
    className: 'bg-surface-container-high text-on-surface-variant',
  },
  COMPLETED: {
    label: 'Completado',
    className: 'bg-primary-container text-on-primary-container',
  },
};

export function ProjectCard({ project, onEdit, onArchive }: ProjectCardProps) {
  const navigate = useNavigate();
  const detailUrl = `/projects/${project.id}`;

  const dateRange =
    project.startDate || project.endDate
      ? `${formatDate(project.startDate) || '—'} → ${formatDate(project.endDate) || '—'}`
      : null;

  const dotClass = projectDot(project.color);
  const status = STATUS_CONFIG[project.status];

  const { total, done } = project.taskCounts;
  const extraMembers = project.memberCount - project.members.length;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-surface-container-low">
      {/* Acento de color del proyecto (QL-29): barra superior. Ausente si no tiene color. */}
      {dotClass && (
        <span
          aria-hidden
          className={cn('absolute inset-x-0 top-0 h-1', dotClass)}
        />
      )}

      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          {project.code && (
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">
              {project.code}
            </span>
          )}
          <span className="flex items-center gap-2">
            {dotClass && (
              <span
                aria-hidden
                className={cn('size-2.5 shrink-0 rounded-full', dotClass)}
              />
            )}
            <span className="line-clamp-2 text-base font-semibold text-on-surface">
              {project.name}
            </span>
          </span>
        </div>

        {/* Controles internos: por encima del overlay (z-10) para no navegar al usarlos. */}
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
              status.className,
            )}
          >
            {status.label}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-on-surface-variant"
                aria-label="Acciones del proyecto"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border border-outline-variant/30 bg-surface-container-lowest"
            >
              <DropdownMenuItem
                onClick={() => navigate(detailUrl)}
                className="cursor-pointer rounded-lg"
              >
                <Eye className="mr-2 size-4" />
                Ver
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onEdit(project)}
                className="cursor-pointer rounded-lg"
              >
                <Pencil className="mr-2 size-4" />
                Editar
              </DropdownMenuItem>
              {!project.archived && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onArchive(project)}
                  className="cursor-pointer rounded-lg"
                >
                  <Archive className="mr-2 size-4" />
                  Archivar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {project.description && (
        <p className="mb-4 line-clamp-2 text-sm text-on-surface-variant">
          {project.description}
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
        {project.clientGroup && (
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5 shrink-0 text-outline" />
            <span className="truncate">{project.clientGroup}</span>
          </span>
        )}
        {dateRange && (
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5 shrink-0 text-outline" />
            <span className="truncate">{dateRange}</span>
          </span>
        )}
      </div>

      {/* Barra de progreso (QL-37): done/total tareas + porcentaje. */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-on-surface-variant">
            Progreso ({done}/{total} tareas)
          </span>
          <span className="font-semibold tabular-nums text-on-surface">
            {project.progressPct}%
          </span>
        </div>
        <Progress value={project.progressPct} className="h-2" />
      </div>

      {/* Footer: grupo de miembros (QL-32) + estado archivado. */}
      <div className="mt-4 flex items-center justify-between gap-2">
        {project.members.length > 0 ? (
          <AvatarGroup>
            {project.members.map((m) => (
              <AuthedAvatar
                key={m.id}
                size="sm"
                avatarDownloadUrl={m.avatarDownloadUrl}
                name={m.name}
              />
            ))}
            {extraMembers > 0 && (
              <AvatarGroupCount>+{extraMembers}</AvatarGroupCount>
            )}
          </AvatarGroup>
        ) : (
          <span className="text-xs text-on-surface-variant">Sin miembros</span>
        )}

        <div className="relative z-10 flex items-center gap-2">
          {project.archived && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
              <Archive className="size-3" />
              Archivado
            </span>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={detailUrl}>
              <Eye className="size-4" />
              Ver
            </Link>
          </Button>
        </div>
      </div>

      {/* Overlay que hace toda la card clicable → detalle (QL-67). Va por encima del
          contenido estático (z-0) pero por debajo de los controles (z-10), que quedan
          libres de navegar. Soporta abrir en pestaña nueva (⌘/Ctrl+clic) al ser un `<Link>`. */}
      <Link
        to={detailUrl}
        aria-label={`Abrir proyecto ${project.name}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      />
    </div>
  );
}

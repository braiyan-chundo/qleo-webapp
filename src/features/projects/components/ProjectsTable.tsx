import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { Progress } from '@/components/ui/progress';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableCard, StatusDot } from '@/shared/components/data-table';
import { cn } from '@/lib/utils';
import { projectDot } from '@/features/tasks/lib/palette';

import type { Project } from '../types/project';
import { formatDate } from '../utils/dates';

interface ProjectsTableProps {
  projects: Project[];
}

/**
 * Vista de proyectos en tabla (QL-67). Solo desktop: el consumidor la envuelve en
 * `hidden md:block`. Cada fila navega al detalle (`/projects/:id`) y es accesible por
 * teclado (Enter/Espacio). Usa los primitivos de tabla del producto (`DataTableCard`).
 */
export function ProjectsTable({ projects }: ProjectsTableProps) {
  const navigate = useNavigate();

  const open = (id: string) => navigate(`/projects/${id}`);

  const onRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open(id);
    }
  };

  return (
    <DataTableCard>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Cliente / grupo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Progreso</TableHead>
          <TableHead className="text-right">Miembros</TableHead>
          <TableHead>Fechas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => {
          const dotClass = projectDot(project.color);
          const dateRange =
            project.startDate || project.endDate
              ? `${formatDate(project.startDate) || '—'} → ${formatDate(project.endDate) || '—'}`
              : '—';

          return (
            <TableRow
              key={project.id}
              role="link"
              tabIndex={0}
              aria-label={`Abrir proyecto ${project.name}`}
              onClick={() => open(project.id)}
              onKeyDown={(e) => onRowKeyDown(e, project.id)}
              className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <TableCell>
                <span className="flex items-center gap-2">
                  {dotClass && (
                    <span
                      aria-hidden
                      className={cn('size-2.5 shrink-0 rounded-full', dotClass)}
                    />
                  )}
                  <span className="font-medium text-on-surface">{project.name}</span>
                </span>
              </TableCell>
              <TableCell className="text-on-surface-variant">
                {project.code || '—'}
              </TableCell>
              <TableCell className="text-on-surface-variant">
                {project.clientGroup || '—'}
              </TableCell>
              <TableCell>
                <StatusDot
                  tone={project.archived ? 'muted' : 'success'}
                  label={project.archived ? 'Archivado' : 'Activo'}
                />
              </TableCell>
              <TableCell>
                <div className="flex w-40 items-center gap-2">
                  <Progress value={project.progressPct} className="h-2 flex-1" />
                  <span className="shrink-0 text-xs font-medium tabular-nums text-on-surface">
                    {project.progressPct}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-on-surface-variant">
                {project.memberCount}
              </TableCell>
              <TableCell className="whitespace-nowrap text-on-surface-variant">
                {dateRange}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </DataTableCard>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  projectsService,
  type ProjectListParams,
  type ProjectPayload,
  type UpdateProjectPayload,
} from '../services/projects.service';

/**
 * Hooks de datos del feature Proyectos. Toda la interacción con la API pasa por aquí:
 * las páginas usan estos hooks y nunca llaman al service ni manejan loading/error a mano.
 * Sigue el patrón de `features/auth/hooks/use-auth.ts`.
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (params: ProjectListParams) => [...projectKeys.lists(), params] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

/** Lista paginada de proyectos con búsqueda y filtro de archivados. */
export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsService.list(params),
  });
}

/** Detalle de un proyecto por id. Solo corre si hay id. */
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => projectsService.getById(id as string),
    enabled: !!id,
  });
}

/** Crea un proyecto e invalida los listados. */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProjectPayload) => projectsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/** Actualiza un proyecto e invalida su detalle y los listados. */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectPayload }) =>
      projectsService.update(id, data),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    },
  });
}

/** Archiva (soft delete) un proyecto e invalida su detalle y los listados. */
export function useArchiveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsService.archive(id),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    },
  });
}

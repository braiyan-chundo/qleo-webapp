import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';
import {
  projectsService,
  type ProjectListParams,
  type ProjectPayload,
  type UpdateProjectPayload,
} from '../services/projects.service';
import type { Project } from '../types/project';

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
  members: (id: string) => [...projectKeys.all, 'members', id] as const,
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

/**
 * Crea un proyecto y, a continuación, añade sus miembros iniciales (QL-52). El backend no
 * acepta `members[]` en `POST /projects`: primero crea (el creador queda como miembro solo)
 * y luego hace `POST /projects/:id/members` por cada usuario elegido. Devuelve el proyecto y
 * los miembros que **no** se pudieron añadir, para avisar de un error parcial sin bloquear.
 */
export function useCreateProjectWithMembers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      data,
      members,
    }: {
      data: ProjectPayload;
      members: UserDirectoryEntry[];
    }): Promise<{ project: Project; failed: UserDirectoryEntry[] }> => {
      const project = await projectsService.create(data);

      const failed: UserDirectoryEntry[] = [];
      for (const member of members) {
        try {
          await projectsService.addMember(project.id, member.id);
        } catch {
          failed.push(member);
        }
      }

      return { project, failed };
    },
    onSuccess: ({ project }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: projectKeys.members(project.id),
      });
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

/**
 * Membresía **real** del proyecto (§3.20, QL-51). Alimenta el picker de asignación de
 * tareas (solo miembros) y el panel de gestión. Solo corre si hay `projectId` y `enabled`.
 */
export function useProjectMembers(
  projectId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: projectKeys.members(projectId ?? ''),
    queryFn: () => projectsService.listMembers(projectId as string),
    enabled: !!projectId && enabled,
  });
}

/** Invalida la membresía, el detalle y los listados tras mutar miembros de un proyecto. */
function invalidateProjectMembership(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  queryClient.invalidateQueries({ queryKey: projectKeys.members(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
  queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
}

/** Añade un miembro al proyecto (§3.20) e invalida membresía/detalle/listados. */
export function useAddProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      projectsService.addMember(projectId, userId),
    onSuccess: () => invalidateProjectMembership(queryClient, projectId),
  });
}

/**
 * Quita un miembro del proyecto (§3.20). Si tiene tareas abiertas, pasa `reassignTo` para
 * traspasarlas antes de quitarlo. Invalida membresía/detalle/listados (y las tareas del
 * proyecto, cuya asignación pudo cambiar).
 */
export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      reassignTo,
    }: {
      userId: string;
      reassignTo?: string;
    }) => projectsService.removeMember(projectId, userId, reassignTo),
    onSuccess: () => {
      invalidateProjectMembership(queryClient, projectId);
      // El traspaso (`reassignTo`) puede reasignar tareas → refrescar toda la caché de tareas.
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserDirectoryEntry } from '@/features/users/services/users.service';
import { useAuthStore } from '@/store/auth.store';
import {
  projectsService,
  type ProjectListParams,
  type ProjectPayload,
  type UpdateProjectPayload,
} from '../services/projects.service';
import { useRecentProjectsStore } from '../store/recent-projects.store';
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

/**
 * Lista paginada de proyectos con búsqueda y filtro de archivados. `enabled` permite montar el
 * hook sin disparar la petición (p. ej. el fallback de "Proyectos recientes", que solo consulta
 * la API cuando el historial de visitas está vacío).
 */
export function useProjects(
  params: ProjectListParams,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsService.list(params),
    enabled,
  });
}

/** (P8) Intervalo de sondeo del detalle de proyecto (membresía/managers de otras sesiones en vivo). */
const PROJECT_POLL_MS = 15_000;

/** Detalle de un proyecto por id. Solo corre si hay id. Registra la visita en "recientes". */
export function useProject(id: string | undefined) {
  const query = useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => projectsService.getById(id as string),
    enabled: !!id,
    refetchInterval: PROJECT_POLL_MS,
    refetchOnWindowFocus: true,
  });

  useTrackRecentProject(query.data);

  return query;
}

/**
 * Registra el proyecto abierto en el historial de "recientes" (Zustand, estado de cliente).
 *
 * Se hace **aquí y no en `ProjectDetailPage`** a propósito: `useProject` es el único punto por el
 * que pasa *toda* vista que abre un proyecto (detalle, tarea dedicada, diálogos del tablero), así
 * que el historial se alimenta solo, sin duplicar lógica en cada página ni acoplar la UI al store.
 * Que algún consumidor secundario (p. ej. `BoardSettingsDialog`) lo dispare es inofensivo: es el
 * mismo proyecto que el usuario está viendo.
 */
function useTrackRecentProject(project: Project | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  const trackVisit = useRecentProjectsStore((s) => s.trackVisit);

  const projectId = project?.id;
  const name = project?.name;
  const code = project?.code ?? null;
  const color = project?.color ?? null;

  useEffect(() => {
    if (!userId || !projectId || !name) return;
    trackVisit(userId, { id: projectId, name, code, color });
  }, [userId, projectId, name, code, color, trackVisit]);
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
 * Otorga permiso de gestión (manager) a un miembro (§3.20, P2). Solo ADMIN o creador. Invalida
 * membresía/detalle/listados para refrescar `managerIds` (y el gate `canManageProject`).
 */
export function useAddManager(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectsService.addManager(projectId, userId),
    onSuccess: () => invalidateProjectMembership(queryClient, projectId),
  });
}

/**
 * Revoca el permiso de gestión (manager) de un miembro (§3.20, P2). Solo ADMIN o creador.
 * Invalida membresía/detalle/listados para refrescar `managerIds`.
 */
export function useRemoveManager(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => projectsService.removeManager(projectId, userId),
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

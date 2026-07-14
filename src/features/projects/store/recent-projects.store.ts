import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ProjectColor } from '../types/project';

/**
 * Historial de **proyectos visitados recientemente** por el usuario (estilo "Recent" de Jira).
 *
 * Es **estado de cliente**, no de servidor: el backend no expone un endpoint de "recientes" ni
 * ordena por visita, y el historial es propio del dispositivo. Por eso vive en Zustand con
 * `persist` (sobrevive recargas) y **no** en la caché de TanStack Query. Lo que sí es dato de
 * servidor (el listado de proyectos, usado como fallback) se sigue leyendo con `useProjects`.
 *
 * Guardamos solo un **snapshot mínimo** (`id`, `name`, `code`, `color`) para pintar la fila sin
 * pedir nada; el detalle fresco siempre viene de la API cuando se navega al proyecto.
 */

/** Snapshot mínimo de un proyecto visitado + marca de tiempo de la visita. */
export interface RecentProject {
  id: string;
  name: string;
  code: string | null;
  color: ProjectColor | null;
  /** ISO 8601 de la última visita. */
  visitedAt: string;
}

/** Datos que registra el llamador; `visitedAt` lo pone el store. */
export type RecentProjectSnapshot = Omit<RecentProject, 'visitedAt'>;

/** Tope de proyectos recordados por usuario. */
const MAX_RECENT = 6;

interface RecentProjectsState {
  /**
   * Historial **particionado por usuario** (`userId` → recientes, orden de visita desc). Evita
   * mezclar historiales cuando varias cuentas usan el mismo dispositivo/navegador.
   */
  byUser: Record<string, RecentProject[]>;
  /** Empuja una visita al frente del historial del usuario (dedupe por `id`, cap `MAX_RECENT`). */
  trackVisit: (userId: string, project: RecentProjectSnapshot) => void;
}

export const useRecentProjectsStore = create<RecentProjectsState>()(
  persist(
    (set) => ({
      byUser: {},

      trackVisit: (userId, project) =>
        set((state) => {
          const current = state.byUser[userId] ?? [];
          const head = current[0];

          // Ya está al frente y sin cambios de snapshot → no tocamos el estado. Devolver el
          // mismo objeto hace que Zustand corte por `Object.is` (sin re-render ni escritura en
          // storage), lo que evita bucles con el efecto que registra la visita.
          if (
            head &&
            head.id === project.id &&
            head.name === project.name &&
            head.code === project.code &&
            head.color === project.color
          ) {
            return state;
          }

          const next = [
            { ...project, visitedAt: new Date().toISOString() },
            ...current.filter((p) => p.id !== project.id),
          ].slice(0, MAX_RECENT);

          return { byUser: { ...state.byUser, [userId]: next } };
        }),
    }),
    {
      name: 'qleo-recent-projects',
      partialize: (state) => ({ byUser: state.byUser }),
    },
  ),
);

/** Referencia estable para usuarios sin historial (evita re-renders por array nuevo). */
const EMPTY: RecentProject[] = [];

/** Recientes del usuario en sesión (orden de visita desc). Vacío si no hay usuario/historial. */
export function useRecentProjects(userId: string | undefined): RecentProject[] {
  return useRecentProjectsStore((s) => (userId ? (s.byUser[userId] ?? EMPTY) : EMPTY));
}

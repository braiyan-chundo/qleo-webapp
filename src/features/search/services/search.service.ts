import { api } from '@/core/api/fetch-client';

/**
 * Servicio del buscador global (QL-28, §3.16). Un único endpoint (`GET /search`) devuelve
 * resultados AGRUPADOS por tipo (proyectos + tareas) para el spotlight de la topbar.
 * Solo lectura; máximo 6 por grupo. `q` < 2 caracteres ⇒ ambos grupos vacíos.
 */

/** Resultado de proyecto del buscador. */
export interface SearchProject {
  id: string;
  name: string;
  code: string | null;
}

/** Resultado de tarea del buscador (solo tareas donde el usuario participa). */
export interface SearchTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
}

/** Respuesta de `GET /search`. */
export interface SearchResult {
  projects: SearchProject[];
  tasks: SearchTask[];
}

export const searchService = {
  /** Búsqueda combinada de proyectos y tareas por texto (`q`). */
  search: (q: string) =>
    api.get<SearchResult>(`/search?q=${encodeURIComponent(q)}`),
};

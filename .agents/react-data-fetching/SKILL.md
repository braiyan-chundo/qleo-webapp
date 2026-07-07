---
name: react-data-fetching
description: >
  Cómo acceder a datos del backend en qleo-webapp con TanStack Query v5: el fetch-client
  tipado, query keys, hooks useQuery/useMutation por feature, invalidación de caché tras
  mutaciones, paginación y manejo de errores. Usa esta habilidad SIEMPRE que integres un
  endpoint del backend. Regla base: NINGÚN componente llama al service directamente.
---

# Data Fetching — TanStack Query (qleo-webapp)

## Regla base
El estado del servidor vive en la **caché de TanStack Query**, no en `useState` ni en
Zustand. Los componentes consumen **hooks** del feature; los hooks usan el service; el
service usa el `fetch-client`. Fuente de endpoints: `../INTEGRACION_FRONTEND.md`.

```
componente → hook (useQuery/useMutation) → service → fetch-client → API
```

## 1. El fetch-client (`core/api/fetch-client.ts`)
Ya existe. Hace tres cosas por ti, **no las repitas**:
- Inyecta `Authorization: Bearer <token>` leyendo `useAuthStore`.
- Desenvuelve el envoltorio del backend y **devuelve `data` directo** (tipado `T`).
- Ante 401: hace `logout()` global y redirige a `/login`.

Métodos: `api.get<T>`, `api.post<T>`, `api.patch<T>`, `api.put<T>`, `api.delete<T>`.

## 2. Service (por feature) — `features/<f>/services/<f>.service.ts`
Solo mapea endpoints a funciones tipadas. Sin lógica de React.

```ts
import { api } from '@/core/api/fetch-client';
import type { Project } from '../types/project.types';
import type { Paginated } from '@/shared/types/paginated';

export const projectsService = {
  list: (params: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]),
    ).toString();
    return api.get<Paginated<Project>>(`/projects${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (dto: CreateProjectDto) => api.post<Project>('/projects', dto),
  update: (id: string, dto: UpdateProjectDto) => api.patch<Project>(`/projects/${id}`, dto),
  archive: (id: string) => api.delete<Project>(`/projects/${id}`),
};
```

## 3. Query keys
Centraliza las keys por feature para invalidar de forma consistente:

```ts
export const projectKeys = {
  all: ['projects'] as const,
  list: (params: object) => [...projectKeys.all, 'list', params] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};
```

## 4. Hooks de lectura (`useQuery`)
```ts
export function useProjects(params: { page?: number; search?: string }) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsService.list(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsService.getById(id),
    enabled: !!id,
  });
}
```

## 5. Hooks de escritura (`useMutation` + invalidación)
Tras una mutación, invalida las queries afectadas para refrescar la UI:

```ts
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectDto) => projectsService.create(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
```

En el componente:
```tsx
const { data, isLoading, isError, error } = useProjects({ search });
const createProject = useCreateProject();
// createProject.mutate(dto)  ·  createProject.isPending  ·  createProject.error
```

Referencia real ya en el repo: `src/features/auth/hooks/use-auth.ts`.

## 6. Paginación
El backend devuelve `{ data, total, page, limit }`. Tipo compartido sugerido en
`shared/types/paginated.ts`:
```ts
export interface Paginated<T> { data: T[]; total: number; page: number; limit: number; }
```
Para paginación fluida usa `placeholderData: keepPreviousData` en el `useQuery`.

## 7. Errores
El fetch-client rechaza con `Error(message)` (mensaje ya viene del backend). En la UI usa
`mutation.error` / `query.error` (tipados como `Error`), no `try/catch` manual. El 401 ya
está manejado globalmente; no lo trates en cada hook.

## Antipatrones (lo que hacía el proyecto anterior — NO hacer)
- ❌ Llamar `authService.login()` dentro de un componente con `useState`/`try/catch`.
- ❌ Guardar listas/detalles del backend en Zustand.
- ❌ Desenvolver otra vez `res.data` (el fetch-client ya lo hizo).
- ❌ Refetch manual con `useEffect`; usa `invalidateQueries`.

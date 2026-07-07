---
name: react-feature-module
description: >
  Cómo scaffoldear un feature/dominio completo en qleo-webapp de forma feature-first:
  carpetas pages/hooks/services/schemas/types/components, y cómo cablearlo al routing.
  Usa esta habilidad al crear un dominio nuevo (proyectos, tareas, kanban, etc.) o al
  añadir una pantalla que consume el backend.
---

# Generador de Feature — qleo-webapp

Un feature es autocontenido en `src/features/<feature>/`. Crea solo las carpetas que
necesites, en este orden de dependencia. Ejemplo: `projects`.

```
src/features/projects/
├── types/project.types.ts        ← DTOs del dominio (espejo del backend)
├── schemas/project.schema.ts      ← zod (form de crear/editar) + tipos inferidos
├── services/projects.service.ts   ← endpoints tipados (usan el fetch-client)
├── hooks/use-projects.ts          ← query keys + useQuery/useMutation
├── components/ProjectCard.tsx      ← UI propia del feature
└── pages/ProjectsPage.tsx          ← página (ruta)
```

## Paso 1 — Tipos (`types/<f>.types.ts`)
Refleja el objeto de respuesta del backend (ver `../INTEGRACION_FRONTEND.md`).
```ts
export interface Project {
  id: string;
  name: string;
  description?: string;
  code?: string;
  clientGroup?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  archived: boolean;
  createdBy: string;
  createdAt: string;
}
```

## Paso 2 — Schema zod (`schemas/<f>.schema.ts`)
Para formularios. El tipo del form se infiere del schema (ver skill `react-forms`).
```ts
import { z } from 'zod';
export const projectFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  destination: z.string().optional(),
});
export type ProjectFormValues = z.infer<typeof projectFormSchema>;
```

## Paso 3 — Service (`services/<f>.service.ts`)
Ver skill `react-data-fetching` (endpoints tipados; devuelven `T` directo).

## Paso 4 — Hooks (`hooks/use-<f>.ts`)
Query keys + `useQuery`/`useMutation` con invalidación. Ver `react-data-fetching`.

## Paso 5 — Componentes (`components/`)
Pequeños y componibles. Usan `@/components/ui/*` (shadcn) y tokens Material 3.
Nada de fetch aquí: reciben datos por props o consumen un hook del feature.

## Paso 6 — Página (`pages/<F>Page.tsx`)
Orquesta: llama a los hooks del feature, muestra loading/empty/error, compone
componentes. Sin llamadas directas al service.
```tsx
export const ProjectsPage = () => {
  const { data, isLoading, isError } = useProjects({ page: 1 });
  if (isLoading) return <ProjectsSkeleton />;
  if (isError) return <ErrorState />;
  if (!data?.data.length) return <EmptyState />;
  return <ProjectGrid projects={data.data} />;
};
```

## Paso 7 — Registrar la ruta
Añade la ruta en `src/App.tsx` dentro del layout correcto (ver `react-routing-auth`):
```tsx
<Route element={<AppLayout />}>
  <Route path="/projects" element={<ProjectsPage />} />
</Route>
```
Actualiza el `AppSidebar` si el feature necesita entrada de navegación.

## Checklist
- [ ] Tipos reflejan el DTO del backend (`INTEGRACION_FRONTEND.md`)
- [ ] Datos vía hooks de TanStack Query (nada de fetch en componentes)
- [ ] Formularios con react-hook-form + zod
- [ ] UI con `components/ui` + tokens (sin hex)
- [ ] Estados loading / empty / error contemplados
- [ ] Ruta registrada y navegación actualizada
- [ ] `pnpm build` y `pnpm lint` sin errores

---
name: react-conventions
description: >
  Reglas base de arquitectura, stack y convenciones de código para el frontend de Qleo
  (qleo-webapp). Usa esta habilidad SIEMPRE que necesites entender la estructura de
  carpetas, los patrones globales, el sistema de diseño (tokens Material 3), los alias,
  o cuando vayas a implementar cualquier feature nuevo y necesites seguir los estándares.
---

# Convenciones de Arquitectura — qleo-webapp (Frontend React)

> Qleo webapp es el frontend del gestor de tareas/proyectos Qleo. Consume el backend
> `qleo-api` (NestJS). Diseño mobile-first + panel de trabajo, instalable como PWA.

## 1. Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | React 19 + TypeScript |
| Bundler / dev | Vite |
| Estilos | Tailwind CSS v4 + tokens Material 3 (CSS variables) |
| Componentes UI | shadcn (`style: base-nova`, sobre `@base-ui/react` + Radix) |
| Estado servidor | **TanStack Query v5** (caché de datos de la API) |
| Estado cliente | **Zustand v5** (`persist` para sesión) |
| Formularios | react-hook-form + zod (`@hookform/resolvers`) |
| Routing | react-router-dom v7 |
| Iconos | lucide-react |
| PWA | vite-plugin-pwa |
| Lint | oxlint |
| Package manager | pnpm |

## 2. Estructura de Carpetas

```
src/
├── main.tsx                 ← entry: QueryClientProvider + StrictMode
├── App.tsx                  ← árbol de rutas (react-router)
│
├── core/                    ← infraestructura transversal (no-UI)
│   ├── api/
│   │   └── fetch-client.ts  ← cliente HTTP tipado; desenvuelve { success, data, error }
│   └── query/
│       └── query-client.ts  ← QueryClient único + defaults
│
├── features/                ← DOMINIOS (feature-first). Cada feature es autocontenido:
│   └── <feature>/
│       ├── pages/           ← componentes de página (ruta)
│       ├── hooks/           ← hooks de datos (useQuery/useMutation) y de UI del feature
│       ├── services/        ← llamadas al API (usan el fetch-client)
│       ├── schemas/         ← esquemas zod + tipos inferidos
│       ├── components/      ← componentes propios del feature
│       └── types/           ← tipos del dominio (DTOs de respuesta, etc.)
│
├── shared/                  ← reutilizable entre features (SIN lógica de negocio)
│   ├── components/          ← componentes compartidos (AppSidebar, ProtectedRoute...)
│   ├── layouts/             ← AppLayout, AuthLayout
│   ├── hooks/               ← hooks genéricos
│   ├── lib/                 ← utilidades
│   └── types/               ← tipos compartidos
│
├── components/ui/           ← shadcn (generado; no meter lógica de negocio aquí)
├── store/                   ← stores Zustand (auth.store.ts, ...)
├── hooks/                   ← hooks globales de shadcn (use-mobile, ...)
├── lib/utils.ts             ← `cn()` y utilidades base
└── index.css                ← tokens Material 3 (variables CSS) + Tailwind
```

> Un feature **no** importa desde `pages/` de otro feature. Lo compartible sube a
> `shared/`. Los datos se comparten vía la caché de TanStack Query, no por props gigantes.

## 3. Alias y naming

- Alias `@/*` → `src/*` (configurado en tsconfig y vite). Importa `@/features/...`.
- Componentes y páginas: `PascalCase.tsx` (`ProjectsPage.tsx`, `TaskCard.tsx`).
- Hooks: `use-kebab.ts` exportando `useCamelCase` (`use-projects.ts` → `useProjects`).
- Services: `<feature>.service.ts`. Schemas: `<algo>.schema.ts`. Stores: `<x>.store.ts`.
- Tipos: nombra los DTO de respuesta igual que en el backend (`Project`, `TaskRole`...).

## 4. TypeScript (estricto)

- `noUnusedLocals` / `noUnusedParameters`: no dejes imports o vars sin usar.
- `verbatimModuleSyntax`: usa `import type { X }` para tipos (si no, falla el build).
- **Prohibido `any`.** Usa `unknown` + narrowing. Errores: `err instanceof Error`.

## 5. Sistema de diseño — tokens Material 3

Los colores viven como **variables CSS** en `src/index.css` y se exponen como clases
Tailwind vía `tailwind.config.ts`. **Usa siempre los tokens, nunca hex sueltos:**

| Uso | Clases (ejemplos) |
|-----|-------------------|
| Fondos | `bg-background`, `bg-surface`, `bg-surface-container-low/high`, `bg-surface-container-lowest` |
| Texto | `text-on-surface`, `text-on-surface-variant`, `text-primary` |
| Acento | `bg-primary text-on-primary`, `bg-primary-container text-primary` |
| Bordes | `border-outline-variant`, `border-outline` |
| Estados | `bg-error text-on-error`, `bg-error-container text-on-error-container` |
| Roles Qleo | `secondary`/`tertiary` (usados para badges de rol por tarea) |

Radio base: `rounded-lg` (= `--radius`). Tipografía: Geist Variable (+ Inter fallback).
Dark mode: clase `.dark` (los tokens tienen su variante oscura en `index.css`).

## 6. Variables de entorno

`VITE_QLEO_API_BASE_URL` (ej. `http://localhost:3000/api`). En dev hay proxy de Vite de
`/api` → `http://localhost:3000`. Accede vía `import.meta.env.VITE_QLEO_API_BASE_URL`.

## 7. Verificación

Antes de dar algo por terminado: `pnpm build` (ejecuta `tsc -b` + `vite build`) sin
errores y `pnpm lint` (oxlint) sin warnings nuevos.

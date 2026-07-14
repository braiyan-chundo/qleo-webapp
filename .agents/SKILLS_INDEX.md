# Skills del Proyecto — qleo-webapp (Frontend React)

> Skills de arquitectura frontend para Qleo. Definen cómo construir el webapp de forma
> limpia, tipada y escalable con el stack del proyecto. Son la contraparte de las skills
> de backend de `qleo-api`. Las usa principalmente el agente `qleo-frontend`.

## Skills Disponibles

| Skill | Propósito | Cuándo usarla |
|-------|-----------|---------------|
| `react-conventions` (SKILL.md) | Arquitectura base, estructura de carpetas, stack, tokens, naming | Al iniciar cualquier feature o verificar estándares |
| `react-feature-module` | Scaffolding de un feature completo (pages, hooks, services, schemas, types, components) | Al crear un dominio nuevo (proyectos, tareas...) |
| `react-data-fetching` | TanStack Query: query keys, useQuery/useMutation, invalidación, paginación, fetch-client | Al integrar cualquier endpoint del backend |
| `react-forms` | react-hook-form + zod: schema, resolver, errores, submit | Al construir cualquier formulario |
| `react-state-zustand` | Stores Zustand, `persist`, frontera estado cliente vs servidor | Al manejar sesión/estado global de UI |
| `react-ui-shadcn` | shadcn + tokens Material 3 + lucide; cómo agregar componentes | Al construir UI o estilizar |
| `react-routing-auth` | react-router v7, layouts, ProtectedRoute, guards por rol | Al agregar rutas o proteger vistas |
| `react-pwa` | Configuración de vite-plugin-pwa, offline, manifest | Al ajustar comportamiento PWA |
| `react-pwa-push-closed-app` | Push con la PWA cerrada + badge del icono: SW `injectManifest`, Badging API, suscripción VAPID y auto-re-suscripción ante desajuste de clave | Al tocar el flujo de push, el badge del icono o diagnosticar "solo llega al abrir la app" |

## Dependencias entre Skills

```
react-conventions
    └── es base de todos los features

react-feature-module
    ├── usa → react-data-fetching (capa de datos)
    ├── usa → react-forms (formularios)
    ├── usa → react-ui-shadcn (presentación)
    └── usa → react-routing-auth (registra las rutas)

react-data-fetching
    ├── consume → core/api/fetch-client (envoltorio { success, data, error })
    └── coordina con → react-state-zustand (token de auth; NO cachea datos de servidor)
```

## Principios no negociables (resumen)

1. Todo dato del servidor pasa por **TanStack Query** (hooks en `features/*/hooks/`).
2. **Zustand** solo para estado de cliente (sesión/UI), nunca para datos de la API.
3. Estructura **feature-first**; `shared/` y `components/ui/` sin lógica de negocio.
4. **Tokens Material 3** para estilos, nunca colores hardcodeados.
5. Tipado estricto, sin `any`; `import type` por `verbatimModuleSyntax`.
6. Contrato del backend: `../INTEGRACION_FRONTEND.md`.

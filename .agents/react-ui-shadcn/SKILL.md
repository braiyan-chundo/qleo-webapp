---
name: react-ui-shadcn
description: >
  Cómo construir UI en qleo-webapp con shadcn (v4, base radix) + lucide-react + el
  helper cn(). Cubre: qué componentes hay instalados, cómo agregar nuevos con el CLI,
  el sistema de tokens/tema actual, y las convenciones de estilo. Usa esta habilidad al
  construir o estilizar cualquier vista o componente.
---

# UI — shadcn (qleo-webapp)

## Setup actual (real)
- **shadcn v4** (`shadcn@^4.12.0`), `components.json`:
  - `style: "radix-nova"` (preset Nova: Lucide + Geist), **base radix** (paquete unificado
    `radix-ui`, ya NO `@base-ui/react`).
  - `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"`.
  - `tailwind.config: ""` — **Tailwind v4 sin archivo de config**; el tema vive en
    `src/index.css` bajo `@theme inline` + variables `:root` / `.dark`.
  - Aliases: `ui` → `@/components/ui`, `utils` → `@/lib/utils`, `lib` → `@/lib`,
    `hooks` → `@/hooks`, `components` → `@/components`.

> Nota histórica: el setup previo era `base-nova` sobre `@base-ui/react`, que usaba la prop
> `render={<Elemento/>}` para componer triggers. **Eso ya no aplica.** Ahora es Radix:
> para componer un trigger/botón con otro elemento usa la prop **`asChild`** y pasa el
> elemento como **hijo** (p. ej. `<DropdownMenuTrigger asChild><Button>…</Button></DropdownMenuTrigger>`).

## Componentes instalados (`src/components/ui/`)
Están **todos** los del registro shadcn v4 (60 archivos). Lista completa:

accordion, alert, alert-dialog, aspect-ratio, attachment, avatar, badge, breadcrumb,
bubble, button, button-group, calendar, card, carousel, chart, checkbox, collapsible,
combobox, command, context-menu, dialog, direction, drawer, dropdown-menu, empty, field,
hover-card, input, input-group, input-otp, item, kbd, label, marker, menubar, message,
message-scroller, native-select, navigation-menu, pagination, popover, progress,
radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider,
sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

Como el catálogo está completo, normalmente **no hace falta agregar** componentes; solo
impórtalos: `import { Button } from '@/components/ui/button'`.

**Si algún día necesitas agregar/re-generar uno** (CLI v4):
```
pnpm dlx shadcn@latest add <componente> --overwrite   # ej. button, table
pnpm dlx shadcn@latest add --all --overwrite          # todo el catálogo
```

## Tema y tokens (estado actual)
Qleo tiene **dos temas** definidos en `src/index.css`, alternables con la clase `.dark`
en `<html>` (gestionada por `next-themes`; hay un `ThemeToggle` en el topbar):

- **Claro = "Qleo Design System" (Material 3 Sapphire)** — paleta azul zafiro, superficies
  claras, sombras suaves M3/Apple.
- **Oscuro = "Neon Tokyo" (cyberpunk)** — fondo casi negro `#0a0a12`, acentos neón (rosa
  `#ff2d78`, cian `#00ffcc`, amarillo `#ffe04a`), jerarquía por tono + bordes/glow (nunca
  sombras).

### Cómo está montado `index.css`
1. **`:root`** → tokens **Material 3** del tema claro (hex exactos).
2. **`.dark`** → los mismos tokens M3 **derivados** para Neon Tokyo.
3. **`@theme inline`** → expone TODOS los tokens M3 como utilidades Tailwind
   (`bg-surface`, `text-on-surface-variant`, `bg-primary-container`, …) **y** mapea los
   tokens estándar de shadcn (`--background`, `--card`, `--primary`, `--muted`, `--border`,
   `--sidebar*`, `--chart*`…) **encima de la paleta M3**, para que los 60 componentes
   `ui/*` hereden el tema automáticamente.

> **Regla de oro:** estiliza SIEMPRE con **tokens M3** (`bg-surface`, `text-on-surface`,
> `bg-primary`, `border-outline-variant`…), **nunca hex**. Los tokens shadcn quedan por
> debajo para que `ui/*` funcione; tú usa los M3.

### Tabla de tokens M3 (utilidades disponibles) e intención
| Intención | Utilidad M3 |
|-----------|-------------|
| Fondo app / texto base | `bg-background` / `bg-surface`, `text-on-surface`, `text-on-background` |
| Texto secundario / labels | `text-on-surface-variant` |
| Superficies por elevación (tono) | `bg-surface-container-lowest` / `-low` / `` / `-high` / `-highest`, `bg-surface-bright`, `bg-surface-dim`, `bg-surface-variant` |
| Cards / popovers (shadcn heredado) | `bg-card`, `bg-popover` |
| Primario (marca / CTA) | `bg-primary text-on-primary`, realce `bg-primary-container text-on-primary-container`, `text-primary` |
| Secundario | `bg-secondary text-on-secondary`, `bg-secondary-container text-on-secondary-container` |
| Terciario | `bg-tertiary text-on-tertiary`, `bg-tertiary-container text-on-tertiary-container` |
| Error | `text-error`, `bg-error-container text-on-error-container` |
| Bordes / divisores / focus | `border-outline`, `border-outline-variant`, `ring-primary` |
| Inversos | `bg-inverse-surface`, `text-inverse-on-surface`, `text-inverse-primary` |
| Fixed accents | `bg-primary-fixed(-dim)`, `text-on-primary-fixed(-variant)`, + secondary/tertiary |

### Neón (solo en dark) — reglas de la spec
- Los colores neón son **SOLO acentos**: brand, CTA principal, item de nav activo, badge de
  rol, iconos puntuales. **Nunca** superficies grandes.
- **Máx. 2 acentos neón por vista.** El texto principal es neutro (`text-on-surface` ≈
  `#e8e8f5`, `text-on-surface-variant` ≈ `#a5a5c0`).
- Jerarquía de superficies por **tono** (más claro = más elevado), no por sombra. En dark
  no hay sombras: usa **bordes finos neón** (`border-outline-variant`) y **glow**.
- Los `*-container` neón son **translúcidos tenues** (fondos de realce), con su `on-*` claro.

### Badges de rol POR TAREA
| Rol | Claro (M3) | Dark (Neon Tokyo) |
|-----|-----------|-------------------|
| CREATOR (Creador) | `bg-primary text-on-primary` (azul) | primary rosa `#ff2d78` |
| ASSIGNEE (Responsable) | `bg-secondary text-on-secondary` (verde) | secondary cian `#00ffcc` |
| COLLABORATOR (Participante) | `bg-tertiary text-on-tertiary` (ámbar) | tertiary amarillo `#ffe04a` |
| OBSERVER (Observador) | `bg-surface-variant text-on-surface-variant` (neutro) | neutral tenue |

### Radios (mapeados a `--radius*`)
`rounded-sm` .25rem · `rounded` .5rem · `rounded-md` .75rem · `rounded-lg` 1rem ·
`rounded-xl` 1.5rem · `rounded-2xl` 2rem · `rounded-full`. Base botones/inputs 8px, cards
12–16px, badges pill/full.

### Tipografía y fuentes
Instaladas vía `@fontsource-variable/*` e importadas en `index.css`: **Inter**, **Sora**,
**Space Grotesk**.
- `font-sans` = **Inter** (body en ambos modos).
- `font-display` / `font-heading` = familia que **cambia por modo** (variable
  `--font-display-family`): en **claro** = Inter (la spec pide Inter en todo), en **dark**
  = **Sora** (headlines cyberpunk). Úsala en títulos/wordmark.
- `font-mono` = **Space Grotesk** (labels técnicos, más presente en dark).

Escala tipográfica como utilidades: `.text-display` (48/700), `.text-headline-lg`
(32/600), `.text-headline-lg-mobile` (28/600), `.text-headline-md` (24/600),
`.text-title-lg` (20/600), `.text-body-lg` (16/400), `.text-body-md` (14/400),
`.text-label-md` (12/500). También `.font-body-md` y `.font-heading` como utilidades de
familia (compat.).

### Utilidades de efecto (`@layer utilities` de `index.css`)
- **Glow (dark):** `.glow-text` (halo de texto), `.glow-primary` / `.glow-secondary` /
  `.glow-tertiary` (box-shadow neón difuso 16px), `.glow-border`. En **claro** son inertes
  (caen a una elevación sutil). Combínalas con `dark:` para que solo brillen en oscuro
  (p. ej. `text-primary dark:glow-text`).
- **Glassmorphism:** `.glass` = `backdrop-filter: blur(12px)` + fondo semitransparente
  (blanco .8 claro / oscuro .8 dark) + borde translúcido. Ya aplicado en **sidebar**
  (`AppSidebar`) y **header sticky** (`AppLayout`); úsalo en headers/paneles sticky nuevos.
- **Elevación (claro):** `.elevation-1/2/3` (sombras M3 suaves para cards/modales). En dark
  quedan neutralizadas (usa glow/bordes).

### Nav activo (patrón importante)
`SidebarMenuButton asChild` + `NavLink` **no** admite `className` como función (el `Slot`
la serializa como string y aplica ambas ramas). En `AppSidebar` el estado activo se calcula
con `useLocation()` y se pasa un `className` **string**; NO pases `isActive` al
`SidebarMenuButton` (su `data-active:text-sidebar-accent-foreground` ganaría al `text-primary`
del enlace activo). Replica este patrón en cualquier nav con `asChild`.

## Helper `cn()`
Combina clases condicionales (clsx + tailwind-merge). Vive en `@/lib/utils`.
```tsx
import { cn } from '@/lib/utils';
<div className={cn('rounded-lg p-4', isActive && 'bg-primary text-primary-foreground')} />
```

## Iconos
Siempre `lucide-react`: `import { Folder, Plus } from 'lucide-react'`. Tamaño con clases
(`className="w-5 h-5"` o `size-4`), color con tokens (`text-muted-foreground`).

## Convenciones
- Componentes pequeños y componibles; extrae subcomponentes antes de que crezcan.
- Composición con Radix: usa **`asChild`** (no `render`) para envolver un trigger sobre
  otro elemento (`Button`, `NavLink`, `Avatar`, …).
- Variantes de estilo con `class-variance-authority` (como en `button.tsx`), no ifs de clases.
- Estados de datos siempre visibles: usa `Skeleton` para loading y un estado vacío amable
  (hay `empty`/`spinner` disponibles).
- Responsive mobile-first (`md:`, `lg:`); en móvil, navegación por `Sheet`/`Drawer`.
- No metas lógica de negocio ni fetch dentro de `components/ui/`.

## Toasts (sonner)
El `<Toaster richColors position="top-right" />` **ya está montado una sola vez** en
`App.tsx` (respeta el tema vía `next-themes`). Solo dispara toasts desde los
`onSuccess/onError` de las mutaciones:
```tsx
import { toast } from 'sonner';
// en una mutación: onError: () => toast.error('No se pudo guardar')
```

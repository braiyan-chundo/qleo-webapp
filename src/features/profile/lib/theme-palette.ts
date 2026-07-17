/**
 * QL-153 — Paleta curada del color primary por usuario (claro/oscuro).
 *
 * El **front es dueño del mapeo** token → tokens Material 3: el backend solo persiste la
 * CLAVE (`token`, string corto ≤32) por usuario para cada modo (claro/oscuro). Aquí definimos,
 * para **cada modo por separado**, los 4 tokens M3 base:
 *   `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`.
 *
 * Basta con sobre-escribir esos 4 base: en `index.css` el resto de tokens derivan vía `var()`
 * (`--ring`, `--primary-foreground`, `--accent`, `--sidebar-primary`…), así que la cascada
 * hace el resto. El applier (`use-apply-user-theme`) los inyecta como propiedades inline en
 * `document.documentElement.style`, que ganan por especificidad a `:root` y a `.dark`.
 *
 * **Sets curados para garantizar contraste (WCAG AA de texto sobre fondo):**
 * - En **claro**: primary saturado + `on-primary` casi blanco (texto sobre botón), `primary-container`
 *   claro + `on-primary-container` muy oscuro.
 * - En **oscuro**: al estilo del set neón por defecto — primary vívido + `on-primary` casi-negro,
 *   `primary-container` translúcido (rgba sobre el fondo oscuro) + `on-primary-container` claro.
 *
 * La opción "Genérico" (`token: null`) representa **quitar la preferencia**: sus valores replican
 * los defaults de `index.css`, pero el applier no los inyecta (elimina las inline props para
 * volver a la cascada nativa). Se listan aquí solo para poder pintar su swatch.
 */

/** Los 4 tokens M3 base que definen el "primary" de un modo. */
export interface PrimaryTokens {
  '--primary': string;
  '--on-primary': string;
  '--primary-container': string;
  '--on-primary-container': string;
}

export interface PaletteOption {
  /** Clave persistida en el backend. `null` = genérico (sin preferencia). */
  token: string | null;
  /** Etiqueta legible para la UI. */
  label: string;
  /** Tokens M3 para el modo claro (curados para contraste AA). */
  light: PrimaryTokens;
  /** Tokens M3 para el modo oscuro (curados para contraste AA). */
  dark: PrimaryTokens;
}

/**
 * Opción genérica (sin preferencia). Sus tokens replican los defaults de `index.css` para
 * poder pintar el swatch; el applier NO los inyecta (limpia las inline props).
 */
export const GENERIC_OPTION: PaletteOption = {
  token: null,
  label: 'Genérico',
  light: {
    '--primary': '#004ccd',
    '--on-primary': '#ffffff',
    '--primary-container': '#0f62fe',
    '--on-primary-container': '#f3f3ff',
  },
  dark: {
    '--primary': '#ff2d78',
    '--on-primary': '#0a0a12',
    '--primary-container': 'rgba(255, 45, 120, 0.16)',
    '--on-primary-container': '#ffb3d1',
  },
};

/**
 * Colores curados (además del genérico). Orden = orden de aparición en los selectores.
 * Cada set está pensado para su modo: en claro el primary es saturado y el container claro;
 * en oscuro el primary es vívido/neón, el container translúcido y el on-primary casi-negro.
 */
export const CURATED_OPTIONS: PaletteOption[] = [
  {
    token: 'violet',
    label: 'Violeta',
    light: {
      '--primary': '#6d28d9',
      '--on-primary': '#ffffff',
      '--primary-container': '#8b5cf6',
      '--on-primary-container': '#f5f3ff',
    },
    dark: {
      '--primary': '#c4a3ff',
      '--on-primary': '#1a0a2e',
      '--primary-container': 'rgba(167, 118, 255, 0.18)',
      '--on-primary-container': '#e2d5ff',
    },
  },
  {
    token: 'rose',
    label: 'Rosa',
    light: {
      '--primary': '#be123c',
      '--on-primary': '#ffffff',
      '--primary-container': '#e11d48',
      '--on-primary-container': '#fff1f2',
    },
    dark: {
      '--primary': '#ff6b8f',
      '--on-primary': '#2b0710',
      '--primary-container': 'rgba(255, 107, 143, 0.18)',
      '--on-primary-container': '#ffd6df',
    },
  },
  {
    token: 'teal',
    label: 'Verde azulado',
    light: {
      '--primary': '#0f766e',
      '--on-primary': '#ffffff',
      '--primary-container': '#14b8a6',
      '--on-primary-container': '#042f2c',
    },
    dark: {
      '--primary': '#5eead4',
      '--on-primary': '#04211e',
      '--primary-container': 'rgba(94, 234, 212, 0.16)',
      '--on-primary-container': '#c7fff2',
    },
  },
  {
    token: 'emerald',
    label: 'Verde',
    light: {
      '--primary': '#047857',
      '--on-primary': '#ffffff',
      '--primary-container': '#10b981',
      '--on-primary-container': '#022c22',
    },
    dark: {
      '--primary': '#6ee7a8',
      '--on-primary': '#052015',
      '--primary-container': 'rgba(110, 231, 168, 0.16)',
      '--on-primary-container': '#c6ffe0',
    },
  },
  {
    token: 'amber',
    label: 'Ámbar',
    light: {
      '--primary': '#b45309',
      '--on-primary': '#ffffff',
      '--primary-container': '#f59e0b',
      '--on-primary-container': '#3a2606',
    },
    dark: {
      '--primary': '#fbbf24',
      '--on-primary': '#2a1a02',
      '--primary-container': 'rgba(251, 191, 36, 0.16)',
      '--on-primary-container': '#ffe7ac',
    },
  },
  {
    token: 'red',
    label: 'Rojo',
    light: {
      '--primary': '#b91c1c',
      '--on-primary': '#ffffff',
      '--primary-container': '#ef4444',
      '--on-primary-container': '#fef2f2',
    },
    dark: {
      '--primary': '#ff7b72',
      '--on-primary': '#2b0605',
      '--primary-container': 'rgba(255, 123, 114, 0.18)',
      '--on-primary-container': '#ffd9d5',
    },
  },
  {
    token: 'cyan',
    label: 'Cian',
    light: {
      '--primary': '#0e7490',
      '--on-primary': '#ffffff',
      '--primary-container': '#06b6d4',
      '--on-primary-container': '#042f3a',
    },
    dark: {
      '--primary': '#67e8f9',
      '--on-primary': '#042027',
      '--primary-container': 'rgba(103, 232, 249, 0.16)',
      '--on-primary-container': '#c4f7ff',
    },
  },
];

/** Genérico + curados, en el orden de la UI (genérico primero). */
export const PALETTE_OPTIONS: PaletteOption[] = [GENERIC_OPTION, ...CURATED_OPTIONS];

/** Índice por token para resolución O(1) (solo tokens no nulos). */
const OPTIONS_BY_TOKEN = new Map<string, PaletteOption>(
  CURATED_OPTIONS.map((option) => [option.token as string, option]),
);

/**
 * Resuelve un token persistido a su opción de paleta. Devuelve `undefined` si el token es
 * `null`/`undefined` (genérico) o **desconocido** (no está en la paleta curada): en ambos
 * casos el applier cae al primary genérico de `index.css`.
 */
export function getPaletteOption(
  token: string | null | undefined,
): PaletteOption | undefined {
  if (!token) return undefined;
  return OPTIONS_BY_TOKEN.get(token);
}

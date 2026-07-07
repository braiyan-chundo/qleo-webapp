import type { ColumnColor } from '@/features/columns/services/columns.service';

/**
 * Paleta de etiquetas del tablero. Cada entrada mapea a tokens (M3 claro / Neon Tokyo
 * oscuro) definidos en `index.css` — **nunca hex en componentes**:
 * - `dot`: fondo sólido del punto de color de la columna.
 * - `pill`: fondo + texto del pill de categoría (`label`) de la tarjeta.
 */
export const PALETTE_KEYS = [
  'blue',
  'orange',
  'green',
  'purple',
  'red',
  'pink',
  'gray',
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];

interface PaletteClasses {
  /** Clase de fondo para el punto de color. */
  dot: string;
  /** Clases de fondo + texto para el pill de categoría. */
  pill: string;
  /** Clase de color de texto/borde para acentos (usar con `border-current`/`text-*`). */
  accent: string;
}

const PALETTE: Record<PaletteKey, PaletteClasses> = {
  blue: {
    dot: 'bg-palette-blue-dot',
    pill: 'bg-palette-blue-surface text-palette-blue-on-surface',
    accent: 'text-palette-blue-dot',
  },
  orange: {
    dot: 'bg-palette-orange-dot',
    pill: 'bg-palette-orange-surface text-palette-orange-on-surface',
    accent: 'text-palette-orange-dot',
  },
  green: {
    dot: 'bg-palette-green-dot',
    pill: 'bg-palette-green-surface text-palette-green-on-surface',
    accent: 'text-palette-green-dot',
  },
  purple: {
    dot: 'bg-palette-purple-dot',
    pill: 'bg-palette-purple-surface text-palette-purple-on-surface',
    accent: 'text-palette-purple-dot',
  },
  red: {
    dot: 'bg-palette-red-dot',
    pill: 'bg-palette-red-surface text-palette-red-on-surface',
    accent: 'text-palette-red-dot',
  },
  pink: {
    dot: 'bg-palette-pink-dot',
    pill: 'bg-palette-pink-surface text-palette-pink-on-surface',
    accent: 'text-palette-pink-dot',
  },
  gray: {
    dot: 'bg-palette-gray-dot',
    pill: 'bg-palette-gray-surface text-palette-gray-on-surface',
    accent: 'text-palette-gray-dot',
  },
};

/**
 * Resuelve la clave de paleta de una columna: usa `color` si viene, o la deriva de forma
 * **determinista** por `index` (posición de la columna) para que columnas sin color tengan
 * un punto estable y distinto entre sí.
 */
export function resolvePaletteKey(
  color: ColumnColor | null | undefined,
  index: number,
): PaletteKey {
  if (color) return color;
  return PALETTE_KEYS[((index % PALETTE_KEYS.length) + PALETTE_KEYS.length) % PALETTE_KEYS.length];
}

/** Clase(s) de token para el **punto de color** de una columna. */
export function columnColor(
  color: ColumnColor | null | undefined,
  index: number,
): string {
  return PALETTE[resolvePaletteKey(color, index)].dot;
}

/** Clases de token para el **pill de categoría** (`label`) de una tarjeta. */
export function labelPill(
  color: ColumnColor | null | undefined,
  index: number,
): string {
  return PALETTE[resolvePaletteKey(color, index)].pill;
}

/** Clase de fondo del **swatch** (punto de color) para una clave concreta de la paleta. */
export function paletteDot(key: PaletteKey): string {
  return PALETTE[key].dot;
}

/**
 * Clase de acento (color de texto/borde vía `currentColor`) para un **color de proyecto**
 * (QL-29). A diferencia de las columnas, un proyecto sin color **no** deriva por índice:
 * devuelve `null` para que el consumidor no pinte acento (neutro).
 */
export function projectAccent(color: PaletteKey | null | undefined): string | null {
  return color ? PALETTE[color].accent : null;
}

/** Clase de fondo del punto de color de un **proyecto**, o `null` si no tiene color. */
export function projectDot(color: PaletteKey | null | undefined): string | null {
  return color ? PALETTE[color].dot : null;
}

/**
 * Pill de categoría determinista por texto (para la etiqueta de la tarjeta, que no tiene un
 * color propio): un hash simple del `label` elige una entrada estable de la paleta.
 */
export function labelPillByText(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const idx = ((hash % PALETTE_KEYS.length) + PALETTE_KEYS.length) % PALETTE_KEYS.length;
  return PALETTE[PALETTE_KEYS[idx]].pill;
}

import type { WallSharedType } from '../types/wall-shared.types';

/** Definición de las tres pestañas de la galería (QL-96, §3.28). Compartida panel/modal. */
export interface WallSharedTab {
  value: WallSharedType;
  label: string;
}

/** Orden y etiquetas de las pestañas Media / Docs / Links. */
export const SHARED_TABS: readonly WallSharedTab[] = [
  { value: 'media', label: 'Media' },
  { value: 'docs', label: 'Docs' },
  { value: 'links', label: 'Links' },
];

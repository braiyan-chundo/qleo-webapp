import type { AuditSummary } from '../services/dashboard.service';

/**
 * Composición de la frase legible de "Actividad reciente" del panel ADMIN (QL-112).
 *
 * El backend (§3.14, QL-111) entrega la auditoría enriquecida con `action`, `entityType`
 * (MAYÚSCULA singular) y `entityName`. Aquí se traduce a una frase natural en español:
 *   «{actor} {verbo} {artículo+tipo} «{entityName}»»
 * p. ej. *"María completó la tarea «Reservar vuelos»"*. Si no hay `entityName`, se omite
 * el entrecomillado y queda solo el tipo (*"Braiyan creó un mensaje del muro"*).
 */

/** Verbo en pasado por acción de auditoría (fallback genérico para acciones desconocidas). */
const ACTION_VERB: Record<string, string> = {
  CREATE: 'creó',
  UPDATE: 'actualizó',
  DELETE: 'eliminó',
  ASSIGN: 'asignó',
  COMPLETE: 'completó',
  REOPEN: 'reabrió',
};

/**
 * Traducción de `entityType` (MAYÚSCULA singular del contrato) a artículo + tipo legible.
 * `named: false` marca los tipos sin nombre propio legible (muro, push) → nunca llevan
 * comillas aunque llegue un `entityName`.
 */
const ENTITY_LABEL: Record<string, { text: string; named: boolean }> = {
  TASK: { text: 'la tarea', named: true },
  PROJECT: { text: 'el proyecto', named: true },
  USER: { text: 'el usuario', named: true },
  COLUMN: { text: 'la columna', named: true },
  STAGE: { text: 'la etapa', named: true },
  ATTACHMENT: { text: 'el adjunto', named: true },
  WALL: { text: 'un mensaje del muro', named: false },
  PUSH: { text: 'una notificación', named: false },
};

/** Frase de actividad ya compuesta y lista para pintar. */
export interface ActivityPhrase {
  /** Nombre del actor (o "Sistema" si no se resolvió). */
  actor: string;
  /** Verbo + tipo, p. ej. "completó la tarea". */
  action: string;
  /** Nombre entrecomillado de la entidad, o `null` si no aplica. */
  entityName: string | null;
}

/**
 * Compone la frase legible de una entrada de auditoría. Devuelve las partes por separado
 * para que la UI destaque el actor en negrita y muestre el nombre entre comillas.
 */
export function buildActivityPhrase(entry: AuditSummary): ActivityPhrase {
  const actor = entry.actor ?? 'Sistema';
  const verb = ACTION_VERB[entry.action] ?? 'modificó';
  const entity = ENTITY_LABEL[entry.entityType] ?? { text: 'un elemento', named: false };

  return {
    actor,
    action: `${verb} ${entity.text}`,
    entityName: entity.named && entry.entityName ? entry.entityName : null,
  };
}

/** Etiqueta corta accesible (para `aria-label`) sin depender del marcado visual. */
export function activityPhraseLabel(phrase: ActivityPhrase): string {
  return phrase.entityName
    ? `${phrase.actor} ${phrase.action} «${phrase.entityName}»`
    : `${phrase.actor} ${phrase.action}`;
}

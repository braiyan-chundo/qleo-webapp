/**
 * Tipos del chat de IA (QL-190, contrato §3.63/§3.64). Cubren los **eventos SSE** de `POST /ai/chat`
 * y la forma del **estado local** del chat (que, por excepción explícita del contrato §8.2, NO vive
 * en TanStack Query sino en un `useReducer` del feature).
 */

/** Herramienta que el modelo usó durante un turno (chip "🔍 {label}"). */
export interface AiToolUse {
  name: string;
  label: string;
}

/** Acción de escritura propuesta por el asistente (§9, evento `action_proposed`). */
export interface AiProposedAction {
  /** Id para confirmar/cancelar. Caduca a los 10 min (TTL). */
  actionId: string;
  /** Herramienta subyacente: `create_task` | `update_task` | `move_task` | … */
  tool: string;
  /** Verbo legible: "crear tarea", "mover tarea", "asignar rol"… */
  kind: string;
  /** Titular (la tarea/proyecto afectado). */
  title: string;
  /** Campos ya resueltos a **nombres legibles** (no ids) para pintar la tarjeta. */
  fields: { label: string; value: string }[];
}

/** Ciclo de vida de una tarjeta de acción en el flujo confirmar/cancelar. */
export type AiActionState =
  | 'pending' // esperando decisión del usuario
  | 'confirming' // POST /confirm en vuelo
  | 'canceling' // POST /cancel en vuelo
  | 'executed' // confirmada y ejecutada
  | 'canceled' // descartada
  | 'error'; // el confirm/cancel falló

/** Un paso de un **plan multi-acción** propuesto por el asistente (§QL-78, evento `plan_proposed`). */
export interface AiProposedPlanStep {
  /** Posición 1-based dentro del plan (se usa para excluir e informar dependencias). */
  index: number;
  /** Herramienta subyacente: `create_project` | `create_task` | … (el set crece; no lo hardcodees). */
  tool: string;
  /** Verbo legible: "crear proyecto", "crear tarea"… */
  kind: string;
  /** Titular del paso (qué hará). */
  label: string;
  /** Campos ya resueltos a nombres legibles para pintar el paso. */
  fields: { label: string; value: string }[];
  /** Índices (1-based) de pasos previos de los que este depende; excluir uno arrastra a sus dependientes. */
  dependsOn: number[];
}

/** Plan ordenado de varias acciones de escritura (§QL-78, evento `plan_proposed`). */
export interface AiProposedPlan {
  /** Id para confirmar/cancelar el plan completo. */
  planId: string;
  /** Intro legible ("Voy a realizar estas acciones:"). */
  text: string;
  /** Pasos en orden de ejecución. */
  steps: AiProposedPlanStep[];
}

/** Resultado de un paso tras confirmar/cancelar el plan (`AiPlanResult.steps[]`). */
export interface AiPlanStepResult {
  index: number;
  /** `executed` ejecutado · `failed` falló · `skipped` omitido (excluido o dependía de uno que falló). */
  status: 'executed' | 'failed' | 'skipped';
  kind: string;
  label: string;
  /** Id de la entidad creada/editada, si el paso se ejecutó. */
  entityId?: string;
  /** Mensaje semántico del fallo, si el paso falló. */
  error?: string;
}

export type AiChatRole = 'user' | 'assistant';

/**
 * Mensaje del chat en el estado local del feature. Un mensaje del asistente acumula el texto, las
 * herramientas usadas, la telemetría de uso y, si la hubo, la propuesta de acción con su estado.
 */
export interface AiChatMessage {
  /** id local mientras streamea; se reemplaza por el `messageId` del backend al cerrar el turno. */
  id: string;
  role: AiChatRole;
  content: string;
  tools: AiToolUse[];
  /** Propuesta de acción adjunta (§9), o `null`. */
  action: AiProposedAction | null;
  /** Estado de la tarjeta de acción; `null` si el mensaje no propone ninguna. */
  actionState: AiActionState | null;
  /** Mensaje de error del confirm/cancel de la acción, si falló. */
  actionError: string | null;
  /** Plan multi-acción adjunto (§QL-78), o `null`. Convive con `action` pero es un flujo aparte. */
  plan: AiProposedPlan | null;
  /** Estado del ciclo confirmar/cancelar del plan (reutiliza `AiActionState`); `null` si no hay plan. */
  planState: AiActionState | null;
  /** Mensaje de error del confirm/cancel del plan, si falló. */
  planError: string | null;
  /** Resultado por paso tras confirmar/cancelar el plan; `null` mientras esté pendiente. */
  planResults: AiPlanStepResult[] | null;
  /** Telemetría del turno (pie discreto), o `null`. */
  usage: { iterations: number; tools: string[] } | null;
  /** Error de turno (evento `error`), o `null`. */
  error: string | null;
  /** `true` mientras el turno del asistente sigue en streaming. */
  streaming: boolean;
  createdAt: string;
}

// --- Datos de cada evento SSE (`event: <tipo>\n data: <json>`) ---

export interface AiSseStatusData {
  phase: string;
}
export interface AiSseToolData {
  name: string;
  label: string;
}
export interface AiSseTextData {
  delta: string;
}
export interface AiSseUsageData {
  iterations: number;
  tools: string[];
}
export interface AiSseErrorData {
  code: string;
  message: string;
}
export interface AiSseDoneData {
  conversationId: string;
  messageId: string;
}
export type AiSseActionProposedData = AiProposedAction;
export type AiSsePlanProposedData = AiProposedPlan;

/** Un evento SSE ya parseado (tipo + payload JSON crudo). El reducer lo interpreta. */
export interface AiSseEvent {
  event: string;
  data: unknown;
}

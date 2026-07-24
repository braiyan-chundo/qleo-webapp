import { api } from '@/core/api/fetch-client';
import type { AiPlanStepResult } from '../types/ai-chat.types';

/**
 * Servicio de las **acciones de escritura** propuestas por el asistente (QL-190, §3.64 · QL-78). El
 * asistente NUNCA ejecuta solo: propone (evento `action_proposed` para una acción, `plan_proposed`
 * para varias) y solo se ejecuta al **confirmar**. Todos son POST normales (no SSE). Confirmar es
 * **idempotente** (dos veces = una ejecución).
 */

/** Respuesta de confirmar/cancelar una acción (`AiActionResponseDto`). */
export interface AiActionResult {
  id: string;
  status: 'executed' | 'canceled';
  kind: string;
  /** El DTO de dominio creado/editado al ejecutar; `null` al cancelar. */
  result: unknown;
}

/** Respuesta de confirmar/cancelar un **plan multi-acción** (QL-78). */
export interface AiPlanResult {
  planId: string;
  /** `done` todas ejecutadas · `partial` unas sí y otras no · `canceled` descartado sin ejecutar. */
  status: 'done' | 'partial' | 'canceled';
  /** Desenlace por paso, en orden. */
  steps: AiPlanStepResult[];
}

export const aiActionsService = {
  /** Ejecuta la acción con la identidad del usuario. Idempotente. */
  confirm: (actionId: string) =>
    api.post<AiActionResult>(`/ai/actions/${actionId}/confirm`),

  /** Descarta la propuesta. */
  cancel: (actionId: string) =>
    api.post<AiActionResult>(`/ai/actions/${actionId}/cancel`),

  /**
   * Ejecuta el plan completo. `exclude` son índices 1-based a NO ejecutar (opcional/omitible). Los
   * pasos que dependan de uno excluido quedan `skipped` (el backend lo garantiza).
   */
  confirmPlan: (planId: string, exclude: number[] = []) =>
    api.post<AiPlanResult>(`/ai/plans/${planId}/confirm`, { exclude }),

  /** Descarta el plan completo sin ejecutar ningún paso. */
  cancelPlan: (planId: string) =>
    api.post<AiPlanResult>(`/ai/plans/${planId}/cancel`),
};

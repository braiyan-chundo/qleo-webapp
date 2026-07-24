import { useQuery } from '@tanstack/react-query';

import { aiChatService } from '../services/ai-chat.service';

/** Clave del estado de disponibilidad de la IA para el usuario actual. */
export const aiStatusKey = ['ai', 'status'] as const;

/**
 * `GET /ai/status` — ¿puede el usuario actual usar el panel? Gatea la página `/ia`.
 *
 * Puede rechazar con 403 `AI_ACCESS_DENIED` (el ADMIN revocó `canUseAi`) o 503 (motor caído). La
 * página distingue esos casos por `error` (ApiError) para mostrar el mensaje adecuado, por eso
 * `retry: false` (no reintentar en bucle un 403/503 que es una respuesta legítima del gate).
 */
export function useAiStatus() {
  return useQuery({
    queryKey: aiStatusKey,
    queryFn: () => aiChatService.getStatus(),
    retry: false,
  });
}

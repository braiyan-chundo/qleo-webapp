import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiConfigService } from '../services/ai-config.service';

/**
 * Hooks de datos de la **conexión IA** (QL-185). Todo pasa por TanStack Query: el estado vivo de la
 * conexión es estado de servidor (lo comparten todos los ADMIN), así que vive en la caché, no en
 * Zustand. Contrato: `docs/integracion/05-ia.md`.
 */

/** Claves de query del feature IA. Una sola: el estado de la conexión de plataforma. */
export const aiKeys = {
  config: ['ai', 'config'] as const,
};

interface UseAiConfigOptions {
  /**
   * Mientras hay un device login en curso, sondea `GET /ai/config` cada ~3 s hasta `connected: true`.
   * El backend persiste el estado en cuanto el login completa fuera de banda.
   */
  poll?: boolean;
}

/**
 * Estado de la conexión IA (`GET /ai/config`). Puede rechazar con 503
 * (`AI_ENGINE_UNAVAILABLE` / `AI_NOT_AUTHENTICATED`): el consumidor lo trata como "no conectada"
 * y ofrece Conectar/Reintentar, por eso `retry: false` (no reintentar en bucle un 503 esperado).
 */
export function useAiConfig({ poll = false }: UseAiConfigOptions = {}) {
  return useQuery({
    queryKey: aiKeys.config,
    queryFn: () => aiConfigService.getConfig(),
    retry: false,
    // Sondeo del device login: se detiene solo en cuanto la conexión queda establecida.
    refetchInterval: poll ? (query) => (query.state.data?.connected ? false : 3000) : false,
  });
}

/** Inicia el device login (`POST /ai/config/connect`). Devuelve `loginId`/`userCode`/`verificationUrl`. */
export function useConnectAi() {
  return useMutation({
    mutationFn: () => aiConfigService.connect(),
  });
}

/** Cancela un device login en curso (`POST /ai/config/connect/cancel`). */
export function useCancelConnect() {
  return useMutation({
    mutationFn: (loginId: string) => aiConfigService.cancelConnect(loginId),
  });
}

/** Desconecta la cuenta (`DELETE /ai/config`) y refresca el estado con la respuesta. */
export function useDisconnectAi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => aiConfigService.disconnect(),
    onSuccess: (config) => {
      // La respuesta ya trae `connected: false`; siémbrala y revalida por si acaso.
      queryClient.setQueryData(aiKeys.config, config);
      queryClient.invalidateQueries({ queryKey: aiKeys.config });
    },
  });
}

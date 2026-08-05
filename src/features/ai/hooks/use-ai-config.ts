import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiConfigService } from '../services/ai-config.service';
import type { AiModelState } from '../services/ai-config.service';

/**
 * Hooks de datos de la **conexión IA** (QL-185). Todo pasa por TanStack Query: el estado vivo de la
 * conexión es estado de servidor (lo comparten todos los ADMIN), así que vive en la caché, no en
 * Zustand. Contrato: `docs/integracion/05-ia.md`.
 */

/**
 * Claves de query del feature IA. `models` cuelga de `config` a propósito: `GET /ai/config` embebe
 * el mismo `AiModelState`, así que invalidar `config` por prefijo arrastra también al selector.
 */
export const aiKeys = {
  config: ['ai', 'config'] as const,
  models: ['ai', 'config', 'models'] as const,
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

/* ── QL-194 · modelo de IA (§3.67) ─────────────────────────────────────────────────────────── */

/**
 * Siembra la respuesta de una mutación de modelo (que ya es el `AiModelState` actualizado) y
 * revalida `GET /ai/config`, que embebe el mismo objeto en `model`.
 *
 * La invalidación va con `exact: true` para no arrastrar por prefijo a `aiKeys.models`: acabamos
 * de sembrarla con la verdad recién llegada y un refetch inmediato solo añadiría una petición.
 */
function useSeedModelState() {
  const queryClient = useQueryClient();

  return (state: AiModelState) => {
    queryClient.setQueryData(aiKeys.models, state);
    queryClient.invalidateQueries({ queryKey: aiKeys.config, exact: true });
  };
}

/**
 * Estado del modelo (`GET /ai/config/models`). A diferencia de `useAiConfig`, **no depende de que
 * la conexión esté OK**: el endpoint nunca da 503, así que el selector se puede pintar (y arreglar)
 * con el motor de IA caído.
 */
export function useAiModels() {
  return useQuery({
    queryKey: aiKeys.models,
    queryFn: () => aiConfigService.getModels(),
  });
}

/** Elige el modelo activo (`PATCH /ai/config/model`). `null` = automático (el del plan). */
export function useSetAiModel() {
  const seed = useSeedModelState();

  return useMutation({
    mutationFn: (model: string | null) => aiConfigService.setModel(model),
    onSuccess: seed,
  });
}

/** Añade un id al listado manual (`POST /ai/config/models`). **No lo activa**: eso es un PATCH aparte. */
export function useAddAiModel() {
  const seed = useSeedModelState();

  return useMutation({
    mutationFn: (model: string) => aiConfigService.addModel(model),
    onSuccess: seed,
  });
}

/** Quita un modelo del listado manual (`DELETE /ai/config/models/:id`). */
export function useRemoveAiModel() {
  const seed = useSeedModelState();

  return useMutation({
    mutationFn: (id: string) => aiConfigService.removeModel(id),
    onSuccess: seed,
  });
}

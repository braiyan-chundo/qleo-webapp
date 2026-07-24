import { API_BASE_URL, ApiError, api } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';
import type { AiSseEvent } from '../types/ai-chat.types';

/**
 * Servicio del **chat de IA** (QL-190, §3.63). Dos superficies muy distintas:
 *
 * - `getStatus`: GET normal (envuelto), va por el `api` compartido y TanStack Query.
 * - `streamChat`: **NO** usa el envoltorio ni `api`. Es `text/event-stream` y va con `Authorization`
 *   + cuerpo POST, así que `EventSource` no sirve: usamos `fetch` + `response.body.getReader()` y
 *   parseamos las líneas SSE a mano. El stream vive en estado local del feature (§8.2), no en caché.
 */

/** `GET /ai/status` — ¿la IA está disponible para MÍ? */
export interface AiStatus {
  canUseAi: boolean;
  connected: boolean;
}

/** Cuerpo de `POST /ai/chat`. `conversationId` continúa una conversación; omitirlo crea una nueva. */
export interface AiChatRequest {
  message: string;
  conversationId?: string;
}

interface StreamChatOptions {
  signal: AbortSignal;
  /** Se invoca por cada evento SSE parseado, en orden de llegada. */
  onEvent: (event: AiSseEvent) => void;
}

/** Parsea un bloque SSE (`event:`/`data:`) a `{ event, data }`. Devuelve `null` si es keep-alive. */
function parseSseBlock(block: string): AiSseEvent | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  let event = 'message';
  const dataLines: string[] = [];
  for (const line of trimmed.split('\n')) {
    if (line.startsWith(':')) continue; // comentario / keep-alive
    if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
  }
  if (dataLines.length === 0) return null;

  const raw = dataLines.join('\n');
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    // Deja el texto crudo si no era JSON (no debería pasar con este backend).
  }
  return { event, data };
}

/**
 * Abre el stream SSE de `POST /ai/chat` y emite cada evento por `onEvent`. Rechaza con `ApiError`
 * en los fallos previos al stream (404 conversationId, 403, 429 throttle). Un `error` **dentro** del
 * stream llega como un evento `error`, no como rechazo. Cancelar el `AbortSignal` corta la lectura.
 */
export async function streamChat(
  body: AiChatRequest,
  { signal, onEvent }: StreamChatOptions,
): Promise<void> {
  const token = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    // Espejo del 401 global del fetch-client: sesión caduca → logout + login.
    if (response.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    const payload = await response.json().catch(() => null);
    const message =
      (payload as { error?: { message?: string } } | null)?.error?.message ||
      response.statusText ||
      'No se pudo iniciar el chat de IA.';
    const code = (payload as { error?: { code?: string } } | null)?.error?.code ?? null;
    throw new ApiError(message, code, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    // Normaliza CRLF y trocea por eventos completos (`\n\n`).
    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');

    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const evt = parseSseBlock(block);
      if (evt) onEvent(evt);
      sep = buffer.indexOf('\n\n');
    }
  }

  // Cierre sin `\n\n` final: intenta el último bloque pendiente.
  const tail = parseSseBlock(buffer);
  if (tail) onEvent(tail);
}

export const aiChatService = {
  /** Estado de disponibilidad para el usuario actual (gate del panel). */
  getStatus: () => api.get<AiStatus>('/ai/status'),
};

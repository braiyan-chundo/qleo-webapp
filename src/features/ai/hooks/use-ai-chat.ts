import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { streamChat } from '../services/ai-chat.service';
import type { AiConversationDetail } from '../services/ai-conversations.service';
import { aiConversationKeys } from './use-ai-conversations';
import { aiCodeMessage, aiErrorMessage } from '../lib/ai-error';
import type {
  AiActionState,
  AiChatMessage,
  AiPlanStepResult,
  AiSseActionProposedData,
  AiSseDoneData,
  AiSseErrorData,
  AiSseEvent,
  AiSsePlanProposedData,
  AiSseTextData,
  AiSseToolData,
  AiSseUsageData,
} from '../types/ai-chat.types';

/**
 * Controlador del **chat de IA** (QL-190, §3.63/§8.2). Excepción explícita a "todo dato del servidor
 * por TanStack Query": el **stream SSE vive en estado local** (`useReducer`). El historial y la lista
 * de conversaciones SÍ van por TanStack Query (otros hooks). Al cerrar el turno (`done`) invalida la
 * lista de conversaciones.
 */

type ChatPhase = 'idle' | 'thinking' | 'streaming';

interface AiChatState {
  conversationId: string | null;
  messages: AiChatMessage[];
  phase: ChatPhase;
  /** `true` mientras hay un turno del asistente en vuelo (bloquea el envío). */
  busy: boolean;
}

const initialState: AiChatState = {
  conversationId: null,
  messages: [],
  phase: 'idle',
  busy: false,
};

type ChatAction =
  | { type: 'reset' }
  | { type: 'load'; conversationId: string; messages: AiChatMessage[] }
  | { type: 'send'; userMessage: AiChatMessage; assistantMessage: AiChatMessage }
  | { type: 'sse'; event: AiSseEvent }
  | { type: 'turn_error'; message: string }
  | { type: 'turn_end' }
  | { type: 'set_action_state'; actionId: string; state: AiActionState; error: string | null }
  | {
      type: 'set_plan_state';
      planId: string;
      state: AiActionState;
      error: string | null;
      results: AiPlanStepResult[] | null;
    };

/** Aplica un evento SSE al mensaje del asistente en curso (siempre el último de la lista). */
function applySse(state: AiChatState, evt: AiSseEvent): AiChatState {
  const i = state.messages.length - 1;
  if (i < 0) return state;
  const last = state.messages[i];
  const replaceLast = (next: AiChatMessage): AiChatMessage[] => {
    const messages = state.messages.slice();
    messages[i] = next;
    return messages;
  };

  switch (evt.event) {
    case 'status':
      return { ...state, phase: 'thinking' };
    case 'tool': {
      const d = evt.data as AiSseToolData;
      return {
        ...state,
        phase: 'thinking',
        messages: replaceLast({ ...last, tools: [...last.tools, { name: d.name, label: d.label }] }),
      };
    }
    case 'text': {
      const d = evt.data as AiSseTextData;
      return {
        ...state,
        phase: 'streaming',
        messages: replaceLast({ ...last, content: last.content + (d.delta ?? '') }),
      };
    }
    case 'action_proposed': {
      const d = evt.data as AiSseActionProposedData;
      return {
        ...state,
        messages: replaceLast({ ...last, action: d, actionState: 'pending', actionError: null }),
      };
    }
    case 'plan_proposed': {
      const d = evt.data as AiSsePlanProposedData;
      return {
        ...state,
        messages: replaceLast({
          ...last,
          plan: d,
          planState: 'pending',
          planError: null,
          planResults: null,
        }),
      };
    }
    case 'usage': {
      const d = evt.data as AiSseUsageData;
      return {
        ...state,
        messages: replaceLast({ ...last, usage: { iterations: d.iterations, tools: d.tools ?? [] } }),
      };
    }
    case 'error': {
      const d = evt.data as AiSseErrorData;
      return {
        ...state,
        phase: 'idle',
        busy: false,
        messages: replaceLast({ ...last, error: aiCodeMessage(d.code, d.message), streaming: false }),
      };
    }
    case 'done': {
      const d = evt.data as AiSseDoneData;
      return {
        ...state,
        conversationId: d.conversationId ?? state.conversationId,
        phase: 'idle',
        busy: false,
        messages: replaceLast({ ...last, id: d.messageId ?? last.id, streaming: false }),
      };
    }
    default:
      return state;
  }
}

function reducer(state: AiChatState, action: ChatAction): AiChatState {
  switch (action.type) {
    case 'reset':
      return initialState;
    case 'load':
      return { conversationId: action.conversationId, messages: action.messages, phase: 'idle', busy: false };
    case 'send':
      return {
        ...state,
        messages: [...state.messages, action.userMessage, action.assistantMessage],
        phase: 'thinking',
        busy: true,
      };
    case 'sse':
      return applySse(state, action.event);
    case 'turn_error': {
      const messages = state.messages.slice();
      const i = messages.length - 1;
      if (i >= 0) messages[i] = { ...messages[i], error: action.message, streaming: false };
      return { ...state, messages, phase: 'idle', busy: false };
    }
    case 'turn_end': {
      const messages = state.messages.slice();
      const i = messages.length - 1;
      if (i >= 0 && messages[i].streaming) messages[i] = { ...messages[i], streaming: false };
      return { ...state, messages, phase: 'idle', busy: false };
    }
    case 'set_action_state':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.action?.actionId === action.actionId
            ? { ...m, actionState: action.state, actionError: action.error }
            : m,
        ),
      };
    case 'set_plan_state':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.plan?.planId === action.planId
            ? {
                ...m,
                planState: action.state,
                planError: action.error,
                planResults: action.results ?? m.planResults,
              }
            : m,
        ),
      };
    default:
      return state;
  }
}

/** Construye un mensaje local vacío con los campos por defecto. */
function makeMessage(role: 'user' | 'assistant', content: string, streaming: boolean): AiChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    tools: [],
    action: null,
    actionState: null,
    actionError: null,
    plan: null,
    planState: null,
    planError: null,
    planResults: null,
    usage: null,
    error: null,
    streaming,
    createdAt: new Date().toISOString(),
  };
}

export function useAiChat() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  // Espejo del estado para leer `busy`/`conversationId` frescos dentro de callbacks estables.
  const stateRef = useRef(state);
  stateRef.current = state;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    dispatch({ type: 'reset' });
  }, [stop]);

  const loadConversation = useCallback(
    (detail: AiConversationDetail) => {
      stop();
      const messages: AiChatMessage[] = detail.messages.map((m, idx) => ({
        id: `${detail.id}:${idx}`,
        role: m.role,
        content: m.content,
        tools: m.toolsUsed.map((name) => ({ name, label: name })),
        action: null,
        actionState: null,
        actionError: null,
        plan: null,
        planState: null,
        planError: null,
        planResults: null,
        usage: null,
        error: null,
        streaming: false,
        createdAt: m.createdAt,
      }));
      dispatch({ type: 'load', conversationId: detail.id, messages });
    },
    [stop],
  );

  const setActionState = useCallback(
    (actionId: string, actionState: AiActionState, error: string | null = null) => {
      dispatch({ type: 'set_action_state', actionId, state: actionState, error });
    },
    [],
  );

  const setPlanState = useCallback(
    (
      planId: string,
      planState: AiActionState,
      error: string | null = null,
      results: AiPlanStepResult[] | null = null,
    ) => {
      dispatch({ type: 'set_plan_state', planId, state: planState, error, results });
    },
    [],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || stateRef.current.busy) return;

      dispatch({
        type: 'send',
        userMessage: makeMessage('user', trimmed, false),
        assistantMessage: makeMessage('assistant', '', true),
      });

      const controller = new AbortController();
      abortRef.current = controller;

      streamChat(
        { message: trimmed, conversationId: stateRef.current.conversationId ?? undefined },
        {
          signal: controller.signal,
          onEvent: (evt) => {
            dispatch({ type: 'sse', event: evt });
            if (evt.event === 'done') {
              queryClient.invalidateQueries({ queryKey: aiConversationKeys.lists() });
            }
          },
        },
      )
        .then(() => dispatch({ type: 'turn_end' }))
        .catch((err: unknown) => {
          // Un abort (cambio de conversación / desmontaje) no es un error a mostrar.
          if (controller.signal.aborted) {
            dispatch({ type: 'turn_end' });
            return;
          }
          dispatch({ type: 'turn_error', message: aiErrorMessage(err) });
        })
        .finally(() => {
          if (abortRef.current === controller) abortRef.current = null;
        });
    },
    [queryClient],
  );

  // Corta cualquier stream en vuelo al desmontar el panel.
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    conversationId: state.conversationId,
    messages: state.messages,
    phase: state.phase,
    busy: state.busy,
    sendMessage,
    loadConversation,
    reset,
    setActionState,
    setPlanState,
    stop,
  };
}

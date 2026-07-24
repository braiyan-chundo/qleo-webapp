import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import {
  useCancelAiAction,
  useCancelAiPlan,
  useConfirmAiAction,
  useConfirmAiPlan,
} from '../hooks/use-ai-actions';
import { aiErrorMessage } from '../lib/ai-error';
import type { AiActionState, AiChatMessage, AiPlanStepResult } from '../types/ai-chat.types';
import { AiMessageBubble } from './AiMessageBubble';
import { AiComposer } from './AiComposer';

interface AiChatPanelProps {
  messages: AiChatMessage[];
  busy: boolean;
  onSend: (text: string) => void;
  setActionState: (actionId: string, state: AiActionState, error?: string | null) => void;
  setPlanState: (
    planId: string,
    state: AiActionState,
    error?: string | null,
    results?: AiPlanStepResult[] | null,
  ) => void;
}

/** Sugerencias de arranque para la conversación vacía. */
const SUGGESTIONS = [
  '¿Qué tareas tengo pendientes para hoy?',
  'Resume el estado de mis proyectos',
  '¿Cómo asigno un responsable a una tarea?',
];

/**
 * Panel de conversación del chat de IA (QL-190): lista de mensajes con autoscroll, estado vacío con
 * sugerencias y la caja de entrada. Es tonto respecto al stream (lo posee `useAiChat` en la página);
 * aquí solo se resuelven las tarjetas de acción vía las mutaciones confirm/cancel (§9).
 */
export function AiChatPanel({
  messages,
  busy,
  onSend,
  setActionState,
  setPlanState,
}: AiChatPanelProps) {
  const confirmAction = useConfirmAiAction();
  const cancelAction = useCancelAiAction();
  const confirmPlan = useConfirmAiPlan();
  const cancelPlan = useCancelAiPlan();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Autoscroll al fondo en cada evento del stream (los mensajes son inmutables por dispatch).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleConfirm = (message: AiChatMessage) => {
    const action = message.action;
    if (!action) return;
    setActionState(action.actionId, 'confirming');
    confirmAction.mutate(action.actionId, {
      onSuccess: () => {
        setActionState(action.actionId, 'executed');
        toast.success('Acción realizada.');
      },
      onError: (err) => {
        const msg = aiErrorMessage(err);
        setActionState(action.actionId, 'error', msg);
        toast.error(msg);
      },
    });
  };

  const handleCancel = (message: AiChatMessage) => {
    const action = message.action;
    if (!action) return;
    setActionState(action.actionId, 'canceling');
    cancelAction.mutate(action.actionId, {
      onSuccess: () => setActionState(action.actionId, 'canceled'),
      onError: (err) => {
        const msg = aiErrorMessage(err);
        setActionState(action.actionId, 'error', msg);
        toast.error(msg);
      },
    });
  };

  const handleConfirmPlan = (message: AiChatMessage, exclude: number[]) => {
    const plan = message.plan;
    if (!plan) return;
    setPlanState(plan.planId, 'confirming');
    confirmPlan.mutate(
      { planId: plan.planId, exclude },
      {
        onSuccess: (res) => {
          setPlanState(plan.planId, 'executed', null, res.steps);
          const failed = res.steps.filter((s) => s.status === 'failed').length;
          if (res.status === 'done') toast.success('Plan completado.');
          else if (failed > 0) toast.error(`El plan se completó en parte (${failed} con error).`);
          else toast.success('Plan completado en parte.');
        },
        onError: (err) => {
          const msg = aiErrorMessage(err);
          setPlanState(plan.planId, 'error', msg);
          toast.error(msg);
        },
      },
    );
  };

  const handleCancelPlan = (message: AiChatMessage) => {
    const plan = message.plan;
    if (!plan) return;
    setPlanState(plan.planId, 'canceling');
    cancelPlan.mutate(plan.planId, {
      onSuccess: (res) => setPlanState(plan.planId, 'canceled', null, res.steps),
      onError: (err) => {
        const msg = aiErrorMessage(err);
        setPlanState(plan.planId, 'error', msg);
        toast.error(msg);
      },
    });
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {isEmpty ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
              <Sparkles className="size-7" />
            </div>
            <h2 className="text-lg font-semibold text-on-surface">Asistente de Qleo</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Pregúntame por tus tareas, proyectos o cómo hacer algo en Qleo. También puedo crear o
              actualizar cosas por ti, siempre con tu confirmación.
            </p>
            <div className="mt-6 grid w-full gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => onSend(suggestion)}
                  className="rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container hover:text-on-surface"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((message) => (
              <AiMessageBubble
                key={message.id}
                message={message}
                onConfirmAction={handleConfirm}
                onCancelAction={handleCancel}
                onConfirmPlan={handleConfirmPlan}
                onCancelPlan={handleCancelPlan}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-outline-variant/40 bg-surface p-3 md:px-6 md:py-4">
        <div className="mx-auto max-w-3xl">
          <AiComposer onSend={onSend} busy={busy} />
          <p className="mt-2 text-center text-xs text-on-surface-variant">
            La IA puede equivocarse. Revisa las acciones antes de confirmarlas.
          </p>
        </div>
      </div>
    </div>
  );
}

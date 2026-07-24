import { Search, Sparkles, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { AiChatMessage } from '../types/ai-chat.types';
import { AiActionCard } from './AiActionCard';
import { AiPlanCard } from './AiPlanCard';

interface AiMessageBubbleProps {
  message: AiChatMessage;
  onConfirmAction: (message: AiChatMessage) => void;
  onCancelAction: (message: AiChatMessage) => void;
  onConfirmPlan: (message: AiChatMessage, exclude: number[]) => void;
  onCancelPlan: (message: AiChatMessage) => void;
}

/** Tres puntos animados: "el asistente está pensando". */
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1 py-1" aria-label="Pensando">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-on-surface-variant"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Una burbuja del chat de IA (QL-190). El usuario va a la derecha (`bg-primary`); el asistente a la
 * izquierda con su icono, sus chips de herramientas ("🔍 …"), el texto de la respuesta, la telemetría
 * discreta y —si propuso una escritura— la tarjeta de confirmación (§9).
 */
export function AiMessageBubble({
  message,
  onConfirmAction,
  onCancelAction,
  onConfirmPlan,
  onCancelPlan,
}: AiMessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-on-primary">
          {message.content}
        </div>
      </div>
    );
  }

  const showThinking =
    message.streaming &&
    !message.content &&
    message.tools.length === 0 &&
    !message.action &&
    !message.plan;

  return (
    <div className="flex gap-3">
      <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
        {message.streaming && (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-primary/50"
            aria-hidden="true"
          />
        )}
        <Sparkles className="relative size-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        {message.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.tools.map((tool, i) => (
              <span
                key={`${tool.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant"
              >
                <Search className="size-3" />
                {tool.label}
              </span>
            ))}
          </div>
        )}

        {showThinking && <ThinkingDots />}

        {message.content && (
          <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-surface-container px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-on-surface">
            {message.content}
            {message.streaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-on-surface-variant align-middle" />
            )}
          </div>
        )}

        {message.error && (
          <div className="flex items-start gap-2 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-sm text-on-error-container">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{message.error}</span>
          </div>
        )}

        {message.action && (
          <AiActionCard
            action={message.action}
            state={message.actionState}
            error={message.actionError}
            onConfirm={() => onConfirmAction(message)}
            onCancel={() => onCancelAction(message)}
          />
        )}

        {message.plan && (
          <AiPlanCard
            plan={message.plan}
            state={message.planState}
            error={message.planError}
            results={message.planResults}
            onConfirm={(exclude) => onConfirmPlan(message, exclude)}
            onCancel={() => onCancelPlan(message)}
          />
        )}

        {message.usage && !message.streaming && (
          <p className={cn('text-xs text-on-surface-variant')}>
            {message.usage.iterations} paso{message.usage.iterations === 1 ? '' : 's'}
            {message.usage.tools.length > 0 &&
              ` · ${message.usage.tools.length} consulta${message.usage.tools.length === 1 ? '' : 's'}`}
          </p>
        )}
      </div>
    </div>
  );
}

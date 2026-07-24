import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquareText, PlugZap, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { useAiStatus } from '../hooks/use-ai-status';
import { useAiChat } from '../hooks/use-ai-chat';
import { useAiConversation } from '../hooks/use-ai-conversations';
import { AiChatPanel } from '../components/AiChatPanel';
import { AiConversationsPanel } from '../components/AiConversationsPanel';

interface GateMessageProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Estado centrado del gate (cargando / sin acceso / no conectada / error). */
function GateMessage({ icon, title, description, action }: GateMessageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-on-surface">{title}</h1>
      <p className="mt-1 max-w-md text-sm text-on-surface-variant">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * Página del **panel de IA** (`/ia`, QL-190). Gatea con `GET /ai/status`: si no hay acceso o la
 * plataforma no está conectada, muestra un estado amable. Con acceso, monta el chat (stream local en
 * `useAiChat`) junto al historial de conversaciones (TanStack Query). En móvil el historial vive tras
 * un Sheet; en desktop es una columna fija.
 */
export function AiPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { data: status, isLoading, isError, error } = useAiStatus();

  const chat = useAiChat();
  const { loadConversation, reset } = chat;

  // Conversación seleccionada para cargar su detalle; un ref evita recargarla en cada refetch.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: detail } = useAiConversation(selectedId);
  const loadedIdRef = useRef<string | null>(null);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);

  useEffect(() => {
    if (detail && detail.id !== loadedIdRef.current) {
      loadedIdRef.current = detail.id;
      loadConversation(detail);
    }
  }, [detail, loadConversation]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileConvOpen(false);
  };

  const handleNew = () => {
    setSelectedId(null);
    loadedIdRef.current = null;
    reset();
    setMobileConvOpen(false);
  };

  // --- Gate ---
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-on-surface-variant" />
      </div>
    );
  }

  const accessDenied =
    (isError && error instanceof ApiError && error.status === 403) || status?.canUseAi === false;

  if (accessDenied) {
    return (
      <GateMessage
        icon={<Sparkles className="size-7" />}
        title="No tienes acceso al panel de IA"
        description="Un administrador puede habilitártelo desde la administración de usuarios."
      />
    );
  }

  const notConnected = isError || status?.connected === false;

  if (notConnected) {
    return (
      <GateMessage
        icon={<PlugZap className="size-7" />}
        title="El panel de IA aún no está conectado"
        description="Pídele a un administrador que conecte la cuenta de ChatGPT en Configuración → Conexión IA para empezar a usar el asistente."
        action={
          isAdmin ? (
            <Button asChild>
              <Link to="/admin/configuracion?tab=conexion-ia">Ir a Conexión IA</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  // --- Panel conectado ---
  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-outline-variant/40 bg-surface-container-low md:flex">
        <AiConversationsPanel
          activeId={chat.conversationId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo-móvil: abre el historial y arranca una conversación nueva. */}
        <div className="flex items-center justify-between gap-2 border-b border-outline-variant/40 px-4 py-2 md:hidden">
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => setMobileConvOpen(true)}>
            <MessageSquareText className="size-4" />
            Conversaciones
          </Button>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
            <Sparkles className="size-4 text-primary" />
            Asistente
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <AiChatPanel
            messages={chat.messages}
            busy={chat.busy}
            onSend={chat.sendMessage}
            setActionState={chat.setActionState}
            setPlanState={chat.setPlanState}
          />
        </div>
      </div>

      <Sheet open={mobileConvOpen} onOpenChange={setMobileConvOpen}>
        <SheetContent side="left" className="w-80 bg-surface-container-low p-0">
          <SheetHeader className="p-3 pb-0">
            <SheetTitle>Conversaciones</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-3rem)]">
            <AiConversationsPanel
              activeId={chat.conversationId}
              onSelect={handleSelect}
              onNew={handleNew}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Loader2, Plug, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiError } from '@/core/api/fetch-client';

import {
  useAiConfig,
  useCancelConnect,
  useConnectAi,
  useDisconnectAi,
} from '../hooks/use-ai-config';
import type { AiConfigResponse, AiConnectResponse } from '../services/ai-config.service';
import { AiConnectDialog } from './AiConnectDialog';

/** Traduce un fallo de la API a un mensaje legible, reaccionando al `code` semántico (§ códigos). */
function messageForError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'AI_ENGINE_UNAVAILABLE') {
      return 'El motor de IA no está disponible ahora. Inténtalo de nuevo en un momento.';
    }
    if (err.code === 'AI_NOT_AUTHENTICATED') {
      return 'La sesión con ChatGPT caducó. Vuelve a conectar la cuenta.';
    }
    return err.message;
  }
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

/** Formatea un ISO a fecha/hora local corta; `—` si no es válido. */
function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formatea un epoch en **segundos** (`resetsAt` del rate limit) a fecha/hora local corta; `—` si no es válido. */
function formatEpochSeconds(epoch: number | null | undefined): string {
  if (epoch == null) return '—';
  const date = new Date(epoch * 1000);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ConnectedViewProps {
  config: AiConfigResponse;
  onDisconnect: () => void;
}

/** Estado conectado: cuenta, quién/cuándo la enlazó, uso y botón de desconexión. */
function ConnectedView({ config, onDisconnect }: ConnectedViewProps) {
  const usedPercent = config.rateLimits?.primary?.usedPercent;
  const resetsAt = config.rateLimits?.primary?.resetsAt ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-tertiary/30 bg-surface-container-low px-4 py-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary text-on-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-on-surface">
              {config.account?.email ?? 'Cuenta de ChatGPT'}
            </span>
            {config.account?.plan && (
              <Badge variant="outline" className="border-tertiary/40 text-tertiary capitalize">
                {config.account.plan}
              </Badge>
            )}
          </div>
          <p className="text-xs text-on-surface-variant">Conexión establecida</p>
        </div>
        {typeof usedPercent === 'number' && (
          <Badge
            variant="outline"
            className="ml-auto border-outline-variant/60 text-on-surface-variant"
          >
            Uso: {usedPercent}%
          </Badge>
        )}
      </div>

      <dl className="grid gap-4 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3 text-sm sm:grid-cols-3">
        <div className="grid gap-0.5">
          <dt className="text-xs font-medium text-on-surface-variant">Conectada por</dt>
          <dd className="text-on-surface">{config.connectedBy?.name ?? '—'}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs font-medium text-on-surface-variant">Fecha de conexión</dt>
          <dd className="text-on-surface">{formatDateTime(config.connectedAt)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs font-medium text-on-surface-variant">Restablecimiento de tokens</dt>
          <dd className="text-on-surface">{formatEpochSeconds(resetsAt)}</dd>
        </div>
      </dl>

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="text-error hover:bg-error-container hover:text-on-error-container"
          onClick={onDisconnect}
        >
          Desconectar
        </Button>
      </div>
    </div>
  );
}

interface DisconnectedViewProps {
  /** Aviso a mostrar cuando el estado viene de un 503 tolerado (motor caído / sesión caducada). */
  warning: string | null;
  /** Etiqueta del botón principal (`Conectar ChatGPT` o `Reconectar`). */
  connectLabel: string;
  connecting: boolean;
  onConnect: () => void;
  onRetry: () => void;
  retrying: boolean;
}

/** Estado no conectada (incl. el 503 tolerado): aviso opcional + botón de conectar. */
function DisconnectedView({
  warning,
  connectLabel,
  connecting,
  onConnect,
  onRetry,
  retrying,
}: DisconnectedViewProps) {
  return (
    <div className="space-y-4">
      {warning && (
        <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error-container px-4 py-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-on-error-container" />
          <div className="space-y-2">
            <p className="text-sm text-on-error-container">{warning}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="border-outline-variant/60"
            >
              {retrying ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Reintentar
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary">
          <Plug className="size-7" />
        </div>
        <h3 className="text-lg font-semibold text-on-surface">IA no conectada</h3>
        <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
          Enlaza una cuenta de ChatGPT para habilitar el panel de IA de toda la plataforma.
        </p>
        <Button className="mt-6 h-11" onClick={onConnect} disabled={connecting}>
          {connecting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {connectLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Contenido del tab **"Conexión IA"** de Configuración (QL-185, §3.62, solo ADMIN). Enlaza una sola
 * cuenta ChatGPT para toda la plataforma vía **device login** (código + enlace) y sondea el estado
 * hasta completar. El estado es de servidor (compartido entre admins): vive en la caché de
 * TanStack Query. Contrato: `docs/integracion/05-ia.md`.
 */
export function AiConnectionManager() {
  const [connectData, setConnectData] = useState<AiConnectResponse | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const connecting = !!connectData;
  const { data: config, isLoading, isError, error, refetch, isFetching } = useAiConfig({
    poll: connecting,
  });

  const connectMutation = useConnectAi();
  const cancelMutation = useCancelConnect();
  const disconnectMutation = useDisconnectAi();

  // El device login completa fuera de banda; el sondeo lo detecta. Al conectar, cierra el diálogo.
  useEffect(() => {
    if (connecting && config?.connected) {
      setConnectData(null);
      toast.success('Conexión establecida con ChatGPT.');
    }
  }, [connecting, config?.connected]);

  const handleConnect = () => {
    connectMutation.mutate(undefined, {
      onSuccess: (res) => setConnectData(res),
      onError: (err) => toast.error(messageForError(err)),
    });
  };

  const handleCancelConnect = () => {
    const loginId = connectData?.loginId;
    setConnectData(null); // cierra el diálogo de inmediato
    if (loginId) {
      // Best-effort: el backend descarta el intento. Un fallo aquí no bloquea al usuario.
      cancelMutation.mutate(loginId);
    }
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('Conexión IA desconectada.');
        setConfirmDisconnect(false);
      },
      onError: (err) => toast.error(messageForError(err)),
    });
  };

  // El 503 (`AI_ENGINE_UNAVAILABLE`/`AI_NOT_AUTHENTICATED`) se tolera: se trata como "no conectada".
  const apiError = isError && error instanceof ApiError ? error : null;
  const notAuthenticated = apiError?.code === 'AI_NOT_AUTHENTICATED';
  const warning = apiError ? messageForError(apiError) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-on-surface">Conexión IA</h2>
        <p className="mt-0.5 text-sm text-on-surface-variant">
          Enlaza una cuenta de ChatGPT para toda la plataforma. La usa el panel de IA de Qleo; la
          credencial nunca se comparte con el navegador.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : config?.connected ? (
        <ConnectedView config={config} onDisconnect={() => setConfirmDisconnect(true)} />
      ) : (
        <DisconnectedView
          warning={warning}
          connectLabel={notAuthenticated ? 'Reconectar ChatGPT' : 'Conectar ChatGPT'}
          connecting={connectMutation.isPending}
          onConnect={handleConnect}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      )}

      <AiConnectDialog
        connect={connectData}
        onCancel={handleCancelConnect}
        canceling={cancelMutation.isPending}
      />

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar la IA</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará la sesión con ChatGPT y el panel de IA dejará de funcionar para{' '}
              <span className="font-medium text-on-surface">toda la plataforma</span> hasta que
              vuelvas a conectar una cuenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnectMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDisconnect();
              }}
              disabled={disconnectMutation.isPending}
              className="bg-error text-on-error hover:bg-error/90"
            >
              {disconnectMutation.isPending && <Loader2 className="animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

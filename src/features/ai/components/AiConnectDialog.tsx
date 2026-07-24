import { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AiConnectResponse } from '../services/ai-config.service';

interface AiConnectDialogProps {
  /** Datos del device login en curso; `null` mantiene el diálogo cerrado. */
  connect: AiConnectResponse | null;
  /** Cancela el intento (cierra el diálogo y llama a `POST /ai/config/connect/cancel`). */
  onCancel: () => void;
  /** `true` mientras la cancelación está en vuelo. */
  canceling?: boolean;
}

/**
 * Diálogo del **device login** de ChatGPT (QL-185, §3.62). Muestra de forma prominente el `userCode`
 * y el enlace a `verificationUrl` para autorizar **fuera de banda**. Mientras está abierto, el
 * `AiConnectionManager` sondea `GET /ai/config` hasta `connected: true` y entonces lo cierra.
 */
export function AiConnectDialog({ connect, onCancel, canceling }: AiConnectDialogProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!connect) return;
    try {
      await navigator.clipboard.writeText(connect.userCode);
      setCopied(true);
      toast.success('Código copiado.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar el código.');
    }
  };

  return (
    <Dialog
      open={!!connect}
      onOpenChange={(open) => {
        // Cerrar el diálogo (overlay, Escape o botón) equivale a cancelar el intento.
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar ChatGPT</DialogTitle>
          <DialogDescription>
            Abre el enlace e ingresa este código para autorizar la conexión con la cuenta de ChatGPT
            que elijas.
          </DialogDescription>
        </DialogHeader>

        {connect && (
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-4 text-center">
              <span className="text-xs font-medium tracking-wide text-on-surface-variant uppercase">
                Tu código
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-3xl font-bold tracking-[0.2em] text-on-surface">
                  {connect.userCode}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={copyCode}
                  aria-label="Copiar código"
                >
                  {copied ? <Check className="text-tertiary" /> : <Copy />}
                </Button>
              </div>
            </div>

            <Button asChild className="h-11">
              <a href={connect.verificationUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                Abrir enlace de autorización
              </a>
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-on-surface-variant">
              <Loader2 className="size-4 animate-spin" />
              Esperando autorización…
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={canceling}>
            {canceling && <Loader2 className="animate-spin" />}
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

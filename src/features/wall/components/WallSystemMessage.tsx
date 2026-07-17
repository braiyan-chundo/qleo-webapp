import { useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { applyAppUpdate } from '@/features/app-version/lib/app-update';

import {
  isSystemMessageVisible,
  wallMessageAnchorId,
  type WallFeedItem,
} from '../lib/wall-feed';

interface WallSystemMessageProps {
  /** El mensaje de sistema (`type:'system'`) a pintar. Para `version_release`, `meta.version` es la clave. */
  message: WallFeedItem;
  /**
   * (QL-119) `true` mientras es el destino de un salto del buscador: flash temporal, igual que en
   * la burbuja de usuario, para localizarlo en el feed.
   */
  highlighted?: boolean;
}

/**
 * Tarjeta **compacta** de mensaje de sistema del muro (QL-148, rediseño QL-150, §3.43): el aviso
 * "Hay una nueva versión de Qleo vX.Y.Z". Una sola fila —icono + sello "Mensaje de sistema" + texto
 * + botón "Actualizar"— alineada con el lenguaje visual del muro (tokens M3). No es una burbuja de
 * usuario: sin avatar, autor ni acciones (el backend la deja inmutable).
 *
 * **Solo se muestra al cliente desactualizado** (`isSystemMessageVisible`). Si ya está en la última
 * versión, el componente **no renderiza nada** (`null`) — antes se mostraba atenuado con un check,
 * ahora se oculta. El botón "Actualizar" es lógica pura de cliente: purga la caché, fuerza el
 * service worker nuevo y recarga **sin cerrar sesión**.
 */
export function WallSystemMessage({ message, highlighted = false }: WallSystemMessageProps) {
  const [updating, setUpdating] = useState(false);
  const targetVersion = message.meta?.version ?? null;

  // (QL-150) Cliente al día → nada que mostrar. `WallView` ya omite el separador de este item, así
  // que el `null` no deja hueco. El `useState` de arriba mantiene el orden de hooks estable.
  if (!isSystemMessageVisible(message)) return null;

  const handleUpdate = () => {
    if (!targetVersion) return;
    setUpdating(true);
    // Purga caché + SW nuevo + recarga (sin cerrar sesión). No hay continuación: la página recarga.
    void applyAppUpdate(targetVersion);
  };

  return (
    <div
      id={wallMessageAnchorId(message.id)}
      className={cn(
        'flex scroll-mt-4 justify-center px-1 transition-colors duration-700',
        highlighted && 'rounded-2xl bg-primary/15',
      )}
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-primary/20 bg-primary-container/30 px-3 py-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Sparkles className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            Mensaje de sistema
          </span>
          <p className="text-xs font-medium text-on-surface [overflow-wrap:anywhere]">
            {message.body}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleUpdate}
          disabled={updating}
          className="shrink-0"
        >
          {updating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Actualizar
        </Button>
      </div>
    </div>
  );
}

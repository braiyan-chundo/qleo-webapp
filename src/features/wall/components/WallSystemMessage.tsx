import { useState } from 'react';
import { Cake, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { applyAppUpdate } from '@/features/app-version/lib/app-update';
import { useAuthStore } from '@/store/auth.store';

import {
  isSystemMessageVisible,
  wallMessageAnchorId,
  type WallFeedItem,
} from '../lib/wall-feed';
import { WALL_SYSTEM_KIND } from '../types/wall.types';

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
 * Tarjeta **compacta** de mensaje de sistema del muro (QL-148, rediseño QL-150, §3.43). Despacha
 * por `systemKind`; ninguna variante es una burbuja de usuario (sin avatar, autor ni acciones: el
 * backend las deja inmutables).
 *
 *  - `version_release` — "Hay una nueva versión de Qleo vX.Y.Z", con botón "Actualizar" (tokens
 *    `primary`). **Solo se muestra al cliente desactualizado** (`isSystemMessageVisible`): si ya
 *    está al día, no renderiza nada. El botón es lógica pura de cliente: purga la caché, fuerza el
 *    service worker nuevo y recarga **sin cerrar sesión**.
 *  - `birthday` (QL-193) — felicitación del día, siempre visible y sin acción (tokens `tertiary`,
 *    para que no se confunda con el aviso de versión). Si el lector es el homenajeado
 *    (`meta.userId`), sube el contraste y cambia el sello a "¡Es tu cumpleaños!".
 *
 * Un `systemKind` desconocido se pinta como aviso **neutro** (la variante de versión sin el botón,
 * que solo aparece si hay `meta.version`): se ve el texto que mandó el backend, pero nunca se le
 * ofrece al usuario una acción que no aplica.
 */
export function WallSystemMessage({ message, highlighted = false }: WallSystemMessageProps) {
  const [updating, setUpdating] = useState(false);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const targetVersion = message.meta?.version ?? null;

  // (QL-150) Cliente al día → nada que mostrar. `WallView` ya omite el separador de este item, así
  // que el `null` no deja hueco. Los hooks de arriba se llaman SIEMPRE (antes de cualquier return)
  // para mantener su orden estable entre renders.
  if (!isSystemMessageVisible(message)) return null;

  // (QL-193) Felicitación de cumpleaños: tarjeta propia, festiva y sin acción. Se distingue del
  // aviso de versión por tokens `tertiary` (aquel usa `primary`), porque son cosas distintas y
  // deben leerse distinto de un vistazo. El `body` lo compone el backend a partir de 6 plantillas
  // y ya trae emojis y el nombre: **no se parsea ni se reescribe aquí**.
  if (message.systemKind === WALL_SYSTEM_KIND.BIRTHDAY) {
    const isHonoree = currentUserId != null && message.meta?.userId === currentUserId;

    return (
      <div
        id={wallMessageAnchorId(message.id)}
        className={cn(
          'flex scroll-mt-4 justify-center px-1 transition-colors duration-700',
          highlighted && 'rounded-2xl bg-primary/15',
        )}
      >
        <div
          className={cn(
            'flex w-full max-w-md items-center gap-3 rounded-xl border px-3 py-2.5',
            // Al homenajeado se le sube el contraste: es SU mensaje y debe saltar en el feed.
            isHonoree
              ? 'border-tertiary/50 bg-tertiary-container'
              : 'border-tertiary/20 bg-tertiary-container/30',
          )}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tertiary/15 text-tertiary"
            aria-hidden
          >
            <Cake className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">
              {isHonoree ? '¡Es tu cumpleaños!' : 'Cumpleaños'}
            </span>
            <p
              className={cn(
                'text-xs font-medium [overflow-wrap:anywhere]',
                isHonoree ? 'text-on-tertiary-container' : 'text-on-surface',
              )}
            >
              {message.body}
            </p>
          </div>
        </div>
      </div>
    );
  }

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

        {/* El botón solo tiene sentido si hay versión que instalar. Un `systemKind` que este
            bundle no conozca cae aquí y se pinta como aviso neutro, sin una acción muerta. */}
        {targetVersion !== null && (
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
        )}
      </div>
    </div>
  );
}

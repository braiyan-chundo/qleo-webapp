import { useState } from 'react';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isOutdated } from '@/features/app-version/lib/semver';
import { applyAppUpdate } from '@/features/app-version/lib/app-update';

import { wallMessageAnchorId, type WallFeedItem } from '../lib/wall-feed';

/** Versión del bundle, inyectada por Vite (`define`, QL-116). Base de la comparación SemVer. */
const APP_VERSION = __APP_VERSION__;

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
 * Tarjeta de **mensaje de sistema** del muro (QL-148, §3.43): el aviso "Hay una nueva versión de
 * Qleo vX.Y.Z". Se distingue visualmente (centrada, marcada "Mensaje de sistema", con estilo
 * propio) de la burbuja de usuario: sin avatar, autor ni acciones (editar/borrar/responder/
 * reaccionar) — el backend ya las bloquea (mensaje inmutable), y aquí tampoco se muestran.
 *
 * El botón "Actualizar" es **lógica pura de cliente**: habilitado solo si este cliente está
 * desactualizado (`__APP_VERSION__ < meta.version`, comparación SemVer numérica). Si ya está al
 * día, se muestra atenuado con un check ("Ya estás en la última versión"). Al pulsarlo se purga la
 * caché del cliente, se fuerza el service worker nuevo y se recarga **sin cerrar sesión**.
 */
export function WallSystemMessage({ message, highlighted = false }: WallSystemMessageProps) {
  const targetVersion = message.meta?.version ?? null;
  // Habilitado solo si hay versión objetivo y este build es anterior a ella.
  const outdated = targetVersion != null && isOutdated(APP_VERSION, targetVersion);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = () => {
    if (!targetVersion || !outdated) return;
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
      <div className="flex w-full max-w-md flex-col items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary-container/40 px-4 py-3.5 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="size-3.5" />
          Mensaje de sistema
        </span>

        <p className="text-sm font-medium text-on-surface [overflow-wrap:anywhere]">
          {message.body}
        </p>

        {outdated ? (
          <Button type="button" size="sm" onClick={handleUpdate} disabled={updating}>
            {updating ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Actualizar
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant">
            <Check className="size-4 text-primary" />
            Ya estás en la última versión
          </span>
        )}
      </div>
    </div>
  );
}

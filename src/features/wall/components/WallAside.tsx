import { ArrowLeft, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { WallPinnedPanel } from './WallPinnedPanel';
import { WallSharedPanel } from './WallSharedPanel';

interface WallAsideProps {
  /**
   * Presentación del panel (QL-97):
   * - `'desktop'` → **columna lateral** fija a la derecha del chat (se muestra/oculta con el
   *   trigger del header del muro).
   * - `'mobile'` → **vista completa** que SUSTITUYE al chat (estilo "info del grupo" de
   *   WhatsApp), con una cabecera propia y botón de volver.
   */
  variant?: 'desktop' | 'mobile';
  /** Cierra el panel (vuelve al chat). En `'mobile'` alimenta el botón de volver de la cabecera. */
  onClose?: () => void;
}

/**
 * Columna lateral / vista de información del Muro Corporativo (QL-97, §3.26/§3.27). Contiene, de
 * arriba a abajo: descripción del canal (estático), "Mensajes fijados" (`WallPinnedPanel`) y
 * "Archivos compartidos" (`WallSharedPanel`).
 *
 * **Responsive (QL-95+):** ya no se auto-oculta con `hidden lg:flex`; su visibilidad y forma la
 * decide `WallPage`. En desktop es una columna (`variant='desktop'`); en móvil ocupa toda la
 * vista sustituyendo al chat (`variant='mobile'`) con cabecera + botón de volver.
 */
export function WallAside({ variant = 'desktop', onClose }: WallAsideProps) {
  const isMobile = variant === 'mobile';

  return (
    <aside
      className={cn(
        'flex flex-col overflow-y-auto bg-surface',
        isMobile
          ? 'w-full flex-1'
          : 'w-72 shrink-0 border-l border-outline-variant/40 xl:w-80',
      )}
    >
      {/* Cabecera solo en móvil: título + botón de volver al chat (estilo "perfil del grupo"). */}
      {isMobile && (
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-outline-variant/40 bg-surface px-2 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Volver al chat"
            className="shrink-0 text-on-surface-variant"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="truncate text-base font-semibold text-on-surface">
            Información del canal
          </h1>
        </header>
      )}

      <div className="flex flex-col gap-5 px-4 py-5">
        {/* 1) Descripción del canal (estático). */}
        <section aria-label="Acerca del canal" className="flex flex-col gap-2">
          <header className="flex items-center gap-2 px-1">
            <Info className="size-3.5 text-on-surface-variant" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Acerca del canal
            </h2>
          </header>
          <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
            Canal oficial de anuncios y discusión general del equipo. Todos los usuarios pueden
            leer y participar; los administradores fijan los mensajes importantes.
          </p>
        </section>

        {/* 2) Mensajes fijados (QL-93). */}
        <WallPinnedPanel />

        {/* 3) Archivos compartidos (QL-96, §3.28): Media / Docs / Links + "Ver todos". */}
        <WallSharedPanel />
      </div>
    </aside>
  );
}

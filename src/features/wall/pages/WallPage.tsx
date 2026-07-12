import { useState } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';

import { WallAside } from '../components/WallAside';
import { WallView } from '../components/WallView';

/**
 * Ruta propia del Muro Corporativo (QL-95, `/muro`). Vive tras `SessionGate` como el resto del
 * área privada; el ítem "Muro" del nav (y su badge de no leídos) apunta aquí. Al montarse,
 * `WallView` activa el polling y marca el muro como leído.
 *
 * **Layout adaptativo (QL-97):**
 * - **Desktop:** dos columnas — chat (`flex-1`) + `WallAside` como columna lateral que se
 *   **oculta/muestra** con el trigger del header del muro. Por defecto visible.
 * - **Móvil:** una sola vista a la vez — el chat, o (al abrir la info) el `WallAside` a
 *   **pantalla completa** que SUSTITUYE al chat (estilo "perfil del grupo" de WhatsApp), con
 *   botón de volver. Por defecto se ve el chat.
 *
 * El estado del panel es de **cliente puro** (UI), por eso `useState` local. `userToggled`
 * guarda la última acción del usuario; el valor efectivo (`showInfo`) cae a un **default por
 * breakpoint** mientras el usuario no toque nada (desktop abierto / móvil cerrado). Esa última
 * acción se **persiste en localStorage** (QL-98) para que el panel conserve abierto/cerrado al
 * recargar; en móvil el default sigue siendo cerrado (pantalla completa al abrir).
 */
const WALL_INFO_STORAGE_KEY = 'qleo:wall:info-open';

function readWallInfoPref(): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(WALL_INFO_STORAGE_KEY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function WallPage() {
  const isMobile = useIsMobile();
  const [userToggled, setUserToggled] = useState<boolean | null>(readWallInfoPref);

  // Persiste la última acción del usuario y actualiza el estado local.
  const persistToggle = (value: boolean) => {
    setUserToggled(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WALL_INFO_STORAGE_KEY, String(value));
    }
  };

  // Default por breakpoint hasta que el usuario interactúe: desktop abierto, móvil cerrado.
  const showInfo = userToggled ?? !isMobile;
  const toggleInfo = () => persistToggle(!showInfo);
  const closeInfo = () => persistToggle(false);

  // En móvil, cuando la info está abierta, SUSTITUYE al chat por completo.
  if (isMobile) {
    return (
      <div className="flex h-full w-full overflow-hidden">
        {showInfo ? (
          <WallAside variant="mobile" onClose={closeInfo} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <WallView infoOpen={false} onToggleInfo={toggleInfo} />
          </div>
        )}
      </div>
    );
  }

  // Desktop: chat + columna lateral opcional (se muestra/oculta con el trigger del header).
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <WallView infoOpen={showInfo} onToggleInfo={toggleInfo} />
      </div>
      {showInfo && <WallAside variant="desktop" />}
    </div>
  );
}

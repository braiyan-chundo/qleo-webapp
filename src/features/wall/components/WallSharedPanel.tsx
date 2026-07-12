import { useState } from 'react';
import { FolderOpen } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { SHARED_PANEL_LIMIT, useWallShared } from '../hooks/use-wall-shared';
import type { WallSharedType } from '../types/wall-shared.types';
import { WallSharedContent } from './WallSharedContent';
import { WallSharedDialog } from './WallSharedDialog';
import { SHARED_TABS } from './wall-shared-tabs';

/**
 * Bloque "Archivos compartidos" del `<aside>` derecho del Muro (QL-96, §3.28). Va en el slot
 * que reservó QL-97 (`WallAside`), debajo del panel de fijados. Tres pestañas —**Media / Docs /
 * Links**— que muestran la **primera página** de la galería (`useWallShared`, TanStack Query,
 * clave por `type`+página). "Ver todos" abre `WallSharedDialog` con la galería completa paginada.
 *
 * Solo se consulta la pestaña activa (el hook usa una sola `type` a la vez); cambiar de pestaña
 * dispara su propia query cacheada.
 */
export function WallSharedPanel() {
  const [tab, setTab] = useState<WallSharedType>('media');
  const [dialogOpen, setDialogOpen] = useState(false);

  const query = useWallShared(tab, 1, SHARED_PANEL_LIMIT);
  const total = query.data?.total ?? 0;
  const shown = query.data?.data.length ?? 0;
  const hasMore = total > shown;

  return (
    <section aria-label="Archivos compartidos" className="flex flex-col gap-2">
      <header className="flex items-center gap-2 px-1">
        <FolderOpen className="size-3.5 text-on-surface-variant" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Archivos compartidos
        </h2>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as WallSharedType)}>
        <TabsList className="w-full">
          {SHARED_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <WallSharedContent type={tab} query={query} skeletonCount={6} />

      {hasMore && (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="self-start rounded-md px-1 py-0.5 text-xs font-medium text-primary transition-colors hover:underline"
        >
          Ver todos ({total})
        </button>
      )}

      {/* `key={tab}` remonta el modal al cambiar de pestaña → arranca en la pestaña activa. */}
      <WallSharedDialog
        key={tab}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialType={tab}
      />
    </section>
  );
}

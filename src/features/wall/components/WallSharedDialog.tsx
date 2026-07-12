import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { SHARED_DIALOG_LIMIT, useWallShared } from '../hooks/use-wall-shared';
import type { WallSharedType } from '../types/wall-shared.types';
import { WallSharedContent } from './WallSharedContent';
import { SHARED_TABS } from './wall-shared-tabs';

interface WallSharedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pestaña con la que abre el modal (la activa del panel). */
  initialType: WallSharedType;
}

/**
 * Modal "Ver todos" de la galería "Archivos compartidos" (QL-96, §3.28). Muestra la galería
 * completa **paginada por página** (§3.28 no usa scroll infinito) con las tres pestañas y
 * controles anterior/siguiente. Reutiliza `WallSharedContent` (mismo render que el panel) y el
 * hook `useWallShared` con `limit` mayor; solo se consulta la pestaña visible (`enabled`).
 */
export function WallSharedDialog({ open, onOpenChange, initialType }: WallSharedDialogProps) {
  const [type, setType] = useState<WallSharedType>(initialType);
  const [page, setPage] = useState(1);

  const query = useWallShared(type, page, SHARED_DIALOG_LIMIT, open);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / SHARED_DIALOG_LIMIT));

  const changeType = (next: WallSharedType) => {
    setType(next);
    setPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Archivos compartidos</DialogTitle>
          <DialogDescription>
            Media, documentos y enlaces publicados en el muro.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={type}
          onValueChange={(value) => changeType(value as WallSharedType)}
        >
          <TabsList className="w-full">
            {SHARED_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="max-h-[55vh] min-h-40 overflow-y-auto pr-1">
          <WallSharedContent type={type} query={query} skeletonCount={SHARED_DIALOG_LIMIT} />
        </div>

        {total > SHARED_DIALOG_LIMIT && (
          <div className="flex items-center justify-between gap-2 border-t border-outline-variant/40 pt-3">
            <span className="text-xs tabular-nums text-on-surface-variant">
              Página {page} de {totalPages} · {total} en total
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || query.isFetching}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || query.isFetching}
              >
                Siguiente
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

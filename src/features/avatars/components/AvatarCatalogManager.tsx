import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Trash2, UsersRound } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AVATAR_ACCEPT_ATTR,
  avatarErrorMessage,
  validateAvatarType,
} from '@/shared/lib/avatar-file';

import { useCreateCatalogAvatar } from '../hooks/use-avatars';
import type { CatalogAvatar } from '../services/avatars.service';
import { useAvatarCatalog } from '../hooks/use-avatars';
import {
  runWithConcurrency,
  UPLOAD_CONCURRENCY,
  type BatchItem,
} from '../lib/upload-batch';
import { CatalogAvatarTile } from './CatalogAvatarTile';
import { RenameAvatarDialog } from './RenameAvatarDialog';
import { DeleteAvatarDialog } from './DeleteAvatarDialog';

/**
 * (QL-181, §3.59, **solo ADMIN**) Gestión del **catálogo global de avatares**: rejilla con la
 * galería y acciones para **subir, renombrar y borrar**. Es el contenido del tab "Avatares" de
 * la vista de Configuración.
 *
 * La subida acepta **selección múltiple** (el ADMIN suelta el lote inicial de golpe): como el
 * backend admite un archivo por request, se sube en **bucle con concurrencia limitada**
 * (`runWithConcurrency`) mostrando el progreso por archivo. Un archivo rechazado no tumba el
 * resto: al final se resume cuántos entraron y cuáles fallaron y por qué.
 */
export function AvatarCatalogManager() {
  const { data, isLoading, isError, error } = useAvatarCatalog();
  const createAvatar = useCreateCatalogAvatar();

  const inputRef = useRef<HTMLInputElement>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState<CatalogAvatar | null>(null);
  const [deleting, setDeleting] = useState<CatalogAvatar | null>(null);

  const avatars = data ?? [];

  const handleFilesPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Permite volver a elegir los mismos archivos después.
    event.target.value = '';
    if (files.length === 0) return;

    // Estado inicial del lote (clave estable con el índice, el nombre puede repetirse).
    const items: BatchItem[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      fileName: file.name,
      status: 'pending',
    }));
    setBatch(items);
    setUploading(true);

    const patch = (index: number, next: Partial<BatchItem>) => {
      setBatch((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...next } : item)),
      );
    };

    let ok = 0;
    let failed = 0;

    await runWithConcurrency(files, UPLOAD_CONCURRENCY, async (file, index) => {
      // Filtro de tipo local: el catálogo no comprime GIF ni valida tamaño aquí (lo hace el
      // hook), pero rechazar de entrada un no-imagen ahorra un request condenado al 415.
      const typeError = validateAvatarType(file);
      if (typeError) {
        failed += 1;
        patch(index, { status: 'error', error: typeError });
        return;
      }

      patch(index, { status: 'uploading' });
      try {
        await createAvatar.mutateAsync({ file });
        ok += 1;
        patch(index, { status: 'done' });
      } catch (err) {
        failed += 1;
        patch(index, {
          status: 'error',
          error: avatarErrorMessage(err, 'No se pudo subir.'),
        });
      }
    });

    setUploading(false);
    if (failed === 0) {
      toast.success(
        ok === 1 ? 'Avatar añadido al catálogo.' : `${ok} avatares añadidos al catálogo.`,
      );
    } else if (ok === 0) {
      toast.error('No se pudo subir ningún avatar.');
    } else {
      toast.warning(`${ok} subidos, ${failed} con error. Revisa el detalle.`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Catálogo de avatares</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Galería de fotos que cualquier usuario puede elegir como su avatar. Puedes soltar
            varias imágenes a la vez.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={handleFilesPicked}
          disabled={uploading}
        />
        <Button
          className="h-10"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          Subir avatares
        </Button>
      </div>

      {/* Progreso del lote en curso (o su resumen al terminar). */}
      {batch.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 text-sm">
          {batch.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-on-surface-variant">
                {item.fileName}
              </span>
              {item.status === 'uploading' && (
                <span className="flex shrink-0 items-center gap-1 text-on-surface-variant">
                  <Loader2 className="size-3.5 animate-spin" />
                  Subiendo…
                </span>
              )}
              {item.status === 'pending' && (
                <span className="shrink-0 text-on-surface-variant">En cola</span>
              )}
              {item.status === 'done' && (
                <span className="shrink-0 font-medium text-tertiary">Añadido</span>
              )}
              {item.status === 'error' && (
                <span className="shrink-0 text-right font-medium text-error">
                  {item.error}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudo cargar el catálogo de avatares
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : avatars.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <UsersRound className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">Aún no hay avatares</h3>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            Sube las primeras imágenes para que los usuarios puedan elegir su foto de la galería.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {avatars.map((avatar) => (
            <li
              key={avatar.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3"
            >
              <CatalogAvatarTile avatar={avatar} />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenaming(avatar)}
                  aria-label={`Renombrar ${avatar.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error-container hover:text-on-error-container"
                  onClick={() => setDeleting(avatar)}
                  aria-label={`Eliminar ${avatar.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RenameAvatarDialog
        avatar={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      />
      <DeleteAvatarDialog
        avatar={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

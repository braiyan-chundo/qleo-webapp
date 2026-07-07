import { File as FileIcon, FileText, ImageIcon } from 'lucide-react';

import { iconKindFor } from '../lib/files';

/** Icono lucide según la categoría derivada del `mimeType` (imagen / PDF / archivo genérico). */
export function AttachmentIcon({ mimeType }: { mimeType: string }) {
  const kind = iconKindFor(mimeType);
  if (kind === 'image') return <ImageIcon className="size-4 text-on-surface-variant" />;
  if (kind === 'pdf') return <FileText className="size-4 text-on-surface-variant" />;
  return <FileIcon className="size-4 text-on-surface-variant" />;
}

import { File as FileIcon, FileText, FileVideo, ImageIcon } from 'lucide-react';

import { iconKindFor } from '../lib/files';

/**
 * Icono lucide según la categoría derivada del `mimeType` (imagen / vídeo / PDF / genérico).
 * (QL-175) El vídeo tiene icono propio desde que se admite como adjunto.
 */
export function AttachmentIcon({ mimeType }: { mimeType: string }) {
  const kind = iconKindFor(mimeType);
  if (kind === 'image') return <ImageIcon className="size-4 text-on-surface-variant" />;
  if (kind === 'video') return <FileVideo className="size-4 text-on-surface-variant" />;
  if (kind === 'pdf') return <FileText className="size-4 text-on-surface-variant" />;
  return <FileIcon className="size-4 text-on-surface-variant" />;
}

import { MentionText } from '@/features/comments/components/MentionText';

import { useWallDirectory } from '../hooks/use-wall-directory';

interface WallMentionTextProps {
  body: string;
  /** userIds mencionados (§3.25). Se resuelven a `@Nombre` cruzando con el directorio. */
  mentions: string[];
}

/**
 * Cuerpo de un mensaje del muro con las **menciones resaltadas** (QL-90). El muro guarda solo
 * los userIds, así que se resuelven a `{ id, name }` vía el directorio (`useWallDirectory`) y
 * se delega el resaltado en `MentionText` (el mismo de comentarios: cruza `@Nombre` con los
 * nombres, NO parsea HTML → sin XSS). Si un id no está en el directorio, no se resalta.
 */
export function WallMentionText({ body, mentions }: WallMentionTextProps) {
  const { resolve } = useWallDirectory(mentions.length > 0);
  const resolved = resolve(mentions);
  return <MentionText body={body} mentions={resolved} />;
}

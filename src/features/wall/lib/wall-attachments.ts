import type { Attachment } from '@/features/attachments/services/attachments.service';

/**
 * Reglas de UI del borrado de adjuntos del Muro (QL-136, §3.35). El backend borra **siempre**
 * el fichero (registro + binario en Nextcloud) y no ofrece "conservar"; por eso lo único que
 * puede hacer el front es **avisar antes** con precisión de cuántos ficheros se pierden.
 */

/** "el archivo adjunto" / "los N archivos adjuntos". Sin nº cuando es uno solo (lee mejor). */
function describeAttachmentCount(count: number): string {
  return count === 1 ? 'su archivo adjunto' : `sus ${count} archivos adjuntos`;
}

/**
 * Texto de confirmación de `DELETE /wall/messages/:id` (QL-136). Con adjuntos avisa de cuántos
 * ficheros se borran **definitivamente** (decisión del cliente: se borran siempre, pero se
 * avisa). Sin adjuntos mantiene el aviso de toda la vida: no metemos fricción donde no hay
 * ningún fichero que perder.
 */
export function describeWallMessageDeletion(attachmentCount: number): string {
  if (attachmentCount === 0) {
    return '¿Seguro que quieres eliminar este mensaje del muro? Esta acción no se puede deshacer.';
  }
  const plural = attachmentCount > 1;
  return `Se eliminará el mensaje y ${describeAttachmentCount(attachmentCount)}, que se ${
    plural ? 'borrarán' : 'borrará'
  } definitivamente del almacenamiento. Esta acción no se puede deshacer.`;
}

/**
 * ¿Puede el usuario actual borrar este adjunto del muro desde "Archivos compartidos"?
 * (QL-136, §3.35). El permiso real lo impone el backend (`scope:'wall'` → **ADMIN o el autor
 * del mensaje vinculado**); aquí solo decidimos si mostramos la acción.
 *
 * Se gatea por `uploadedBy` porque en el muro **el autor del adjunto es el autor del mensaje**:
 * `POST /wall/messages` rechaza vincular un adjunto ajeno (`WALL_ATTACHMENT_INVALID`, §3.25.2),
 * así que no puede haber un adjunto subido por A dentro de un mensaje de B. Si el gate se
 * quedara corto, el backend responde 403 y el toast lo traduce (no se pierde integridad).
 */
export function canDeleteWallAttachment(
  attachment: Attachment,
  currentUserId: string | undefined,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  return !!currentUserId && attachment.uploadedBy?.id === currentUserId;
}

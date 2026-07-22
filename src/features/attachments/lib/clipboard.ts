/**
 * (QL-175) Pegado de ficheros desde el **portapapeles**. Compartido por los dos composers que
 * aceptan adjuntos —el del Muro (`WallComposer`) y el de comentarios de tarea
 * (`CommentComposer`)— para que "Ctrl+V" se comporte igual en ambos.
 *
 * Dos detalles del portapapeles que se resuelven aquí:
 * 1. El navegador entrega la captura de pantalla con un nombre genérico (`image.png`) o incluso
 *    vacío ⇒ se renombra a algo legible con fecha/hora (`pegado-2026-07-22-14-30-05.png`).
 * 2. `clipboardData.files` no está poblado en todos los navegadores; `items` sí. Se leen ambos y
 *    se deduplica por `name+size+type`.
 */

/** Nombres que ponen los navegadores a lo pegado y que no dicen nada al usuario. */
const GENERIC_NAMES = new Set(['image.png', 'image.jpeg', 'image.jpg', 'image', 'blob', '']);

/** Extensión sugerida para un MIME conocido; `bin` si no se reconoce. */
function extensionFor(mimeType: string): string {
  const [, subtype = ''] = mimeType.toLowerCase().split('/');
  switch (subtype) {
    case 'jpeg':
      return 'jpg';
    case 'quicktime':
      return 'mov';
    case 'plain':
      return 'txt';
    case 'svg+xml':
      return 'svg';
    default:
      return subtype.replace(/[^a-z0-9]+/g, '') || 'bin';
  }
}

/** Marca de tiempo local compacta para el nombre: `2026-07-22-14-30-05`. */
function timestampSlug(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('-');
}

/**
 * Nombre legible para un fichero pegado. Conserva el nombre real cuando el navegador lo aporta
 * (p. ej. al copiar un archivo del explorador) y solo inventa uno cuando es genérico.
 */
export function pastedFileName(file: File, now: Date = new Date()): string {
  const name = file.name?.trim() ?? '';
  if (!GENERIC_NAMES.has(name.toLowerCase())) return name;
  return `pegado-${timestampSlug(now)}.${extensionFor(file.type || 'application/octet-stream')}`;
}

/**
 * Extrae los ficheros de un evento `paste`. Devuelve `[]` cuando no hay nada que adjuntar (⇒ el
 * llamador NO debe hacer `preventDefault`: el pegado de **texto** normal debe seguir vivo). Los
 * ficheros vuelven ya **renombrados** con {@link pastedFileName}.
 *
 * **El texto manda.** Si el portapapeles trae `text/plain` no vacío se ignoran los ficheros: hay
 * fuentes (celdas de Excel, tablas de una web) que copian a la vez el texto y una imagen del
 * mismo contenido, y ahí lo que el usuario quiere pegar es el texto. Una captura de pantalla o
 * una imagen copiada no llevan `text/plain`, así que sí se adjuntan.
 */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  if (data.getData('text/plain').trim().length > 0) return [];

  const collected: File[] = [];
  const seen = new Set<string>();
  const push = (file: File | null) => {
    if (!file || file.size === 0) return;
    const signature = `${file.name}|${file.size}|${file.type}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    collected.push(
      new File([file], pastedFileName(file), {
        type: file.type,
        lastModified: file.lastModified,
      }),
    );
  };

  for (const file of Array.from(data.files ?? [])) push(file);
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind === 'file') push(item.getAsFile());
  }

  return collected;
}

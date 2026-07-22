/**
 * (QL-181) Compresión de imágenes **en cliente** antes de subirlas.
 *
 * Un avatar se pinta como mucho a unas decenas de píxeles, así que subir el JPEG de 4 MB que
 * salió del móvil es tirar ancho de banda y almacenamiento. Aquí se recorta al **centro** en
 * cuadrado, se reescala a 256×256 y se recodifica a **WebP** (calidad 0.85): el resultado ronda
 * las decenas de KB.
 *
 * **Degrada con gracia**: cualquier fallo (navegador sin soporte de WebP en `canvas`, imagen que
 * no decodifica, `toBlob` que devuelve `null`…) resuelve con el **archivo original**. El backend
 * sigue siendo la autoridad y acepta png/jpeg/webp/gif hasta 2 MB.
 */

/** Lado del cuadrado final en píxeles. Suficiente para cualquier avatar de la app en 2x. */
const TARGET_SIZE = 256;

/** Calidad de la codificación WebP. 0.85 es el punto donde el artefacto deja de notarse. */
const WEBP_QUALITY = 0.85;

const WEBP_MIME = 'image/webp';

/** Decodifica el archivo a algo pintable en un `canvas`, con fallback a `<img>` + object URL. */
async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.src = url;
    });
  } finally {
    // El `<img>` ya tiene los píxeles decodificados; el object URL puede revocarse.
    URL.revokeObjectURL(url);
  }
}

/** `canvas.toBlob` en forma de promesa (resuelve `null` si el códec no está disponible). */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/** Cambia la extensión del nombre original por `.webp` (sin tocar el resto del nombre). */
function toWebpName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'avatar';
  return `${base}.webp`;
}

/**
 * Devuelve una versión 256×256 WebP del archivo, o **el archivo original** si no se puede
 * comprimir.
 *
 * Se deja pasar tal cual:
 * - lo que no sea una imagen (el llamador ya valida el tipo, esto es solo defensa);
 * - los **GIF**, porque el `canvas` se queda con el primer fotograma y perdería la animación.
 *   Para ellos manda el límite de 2 MB del backend.
 */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  try {
    const source = await decodeImage(file);
    const { width, height } = source;
    if (!width || !height) return file;

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Recorte centrado: se toma el cuadrado mayor que cabe en la imagen y se escala al destino.
    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;
    ctx.drawImage(source, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

    const blob = await canvasToBlob(canvas, WEBP_MIME, WEBP_QUALITY);
    // Sin soporte de WebP, `toBlob` devuelve `null` o cae a PNG: en ambos casos, original.
    if (!blob || blob.type !== WEBP_MIME) return file;

    return new File([blob], toWebpName(file.name), {
      type: WEBP_MIME,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

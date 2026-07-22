/**
 * (QL-181, §3.59) Subida **por lotes** al catálogo de avatares.
 *
 * El backend acepta **un archivo por request** a propósito, para que un archivo rechazado no
 * tumbe el resto del lote. El ADMIN, en cambio, va a soltar 24 imágenes de golpe: aquí vive la
 * mecánica que reconcilia ambas cosas — un bucle con **concurrencia limitada** y un resultado
 * por archivo, sin `Promise.all` (que abortaría al primer rechazo y saturaría la red).
 */

/** Estado de un archivo dentro del lote (solo UI: no es dato de servidor). */
export type BatchItemStatus = 'pending' | 'uploading' | 'done' | 'error';

/** Una entrada del lote, tal y como la pinta el panel. */
export interface BatchItem {
  /** Clave estable de render (el nombre puede repetirse entre archivos). */
  key: string;
  fileName: string;
  status: BatchItemStatus;
  /** Motivo del fallo, ya traducido, si `status === 'error'`. */
  error?: string;
}

/** Nº de subidas simultáneas. Bajo a propósito: son requests con binario. */
export const UPLOAD_CONCURRENCY = 3;

/**
 * Ejecuta `worker` sobre cada elemento con como mucho `limit` en vuelo. Nunca rechaza: es
 * responsabilidad del `worker` capturar sus propios errores y registrarlos.
 *
 * Implementación por "carriles": `limit` consumidores comparten un cursor sobre el array, así
 * que en cuanto uno termina toma el siguiente pendiente (sin esperar a que acabe la tanda).
 */
export async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  const lane = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => lane()),
  );
}

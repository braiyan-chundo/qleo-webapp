import { useCallback, useEffect, useMemo, useRef } from 'react';

/** Trabajo encolado. Debe resolver sus propios errores: un rechazo se traga para no romper la cola. */
export type SerialJob = () => Promise<void>;

export interface SerialQueue {
  /**
   * Encola `job` detrás de lo que ya esté en curso. Si otra tanda sigue corriendo, se **encadena**
   * a ella (nunca arranca una segunda cola en paralelo). El job se salta sin ejecutarse si, al
   * llegarle el turno, el componente ya se desmontó o su `key` se canceló.
   */
  enqueue: (key: string, job: SerialJob) => void;
  /** Marca `key` como cancelada: si aún espera turno no se ejecuta; si ya corre, lo consulta con `isCancelled`. */
  cancel: (key: string) => void;
  /** ¿Se canceló `key`? Para que un job en curso decida qué hacer con su resultado. */
  isCancelled: (key: string) => boolean;
  /** ¿Sigue montado el dueño de la cola? Tras un `await`, no tocar estado si devuelve `false`. */
  isMounted: () => boolean;
}

/**
 * Cola **secuencial** de trabajos asíncronos ligada al ciclo de vida del componente.
 *
 * Nace para las subidas de adjuntos múltiples: dispararlas en paralelo hace que el backend
 * escriba a la vez en la misma carpeta de Nextcloud y su locking responda `423 Locked`. Con esta
 * cola sale **una petición cada vez**; el siguiente fichero no arranca hasta que el anterior
 * termina (bien o mal).
 *
 * La cola es una única promesa (`tail`) guardada en un ref: cada `enqueue` se cuelga de su final,
 * así que soltar más ficheros mientras otra tanda sube simplemente alarga la misma cola.
 */
export function useSerialQueue(): SerialQueue {
  const tail = useRef<Promise<void>>(Promise.resolve());
  const cancelled = useRef<Set<string>>(new Set());
  const mounted = useRef(true);

  useEffect(() => {
    // Se re-marca en el montaje por StrictMode (monta → desmonta → monta en desarrollo).
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const enqueue = useCallback((key: string, job: SerialJob) => {
    tail.current = tail.current
      .then(async () => {
        if (!mounted.current || cancelled.current.has(key)) return;
        await job();
      })
      // Un job que rechace no debe cortar la cola: el siguiente sigue subiendo.
      .catch(() => undefined)
      .finally(() => {
        cancelled.current.delete(key);
      });
  }, []);

  const cancel = useCallback((key: string) => {
    cancelled.current.add(key);
  }, []);

  const isCancelled = useCallback((key: string) => cancelled.current.has(key), []);
  const isMounted = useCallback(() => mounted.current, []);

  // Identidad estable: el objeto puede ir en dependencias de `useCallback`/`useEffect`.
  return useMemo(
    () => ({ enqueue, cancel, isCancelled, isMounted }),
    [enqueue, cancel, isCancelled, isMounted],
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDebounce } from './use-debounce';

/**
 * Estado de UI sincronizado con un query param de la URL. Pensado para **filtros**
 * (búsqueda, rol, estado, página…) de modo que al recargar o compartir la URL el filtro
 * se mantenga. Es la base de la persistencia de filtros del proyecto.
 *
 * Reglas de diseño:
 * - El valor inicial sale del search param; si no está, se usa `defaultValue`.
 * - Al setear se usa `replace: true` para NO llenar el history del navegador.
 * - Cuando el valor es igual al default, el param se **omite** de la URL (URL limpia).
 * - Convive con varios params en la misma página: siempre hace *merge* sobre los params
 *   actuales, sin pisar los demás.
 *
 * Estado de cliente puro (no dato de servidor): la fuente de verdad es la URL, no un
 * store. Encaja con la arquitectura (Zustand solo para sesión/UI global).
 */
export function useQueryParamState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(key);
  const value = (raw ?? defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      setSearchParams(
        (prev) => {
          // Merge sobre los params actuales para no pisar otros filtros de la página.
          const params = new URLSearchParams(prev);
          if (next === defaultValue) {
            params.delete(key);
          } else {
            params.set(key, next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [key, defaultValue, setSearchParams],
  );

  return [value, setValue];
}

/** Actualización directa o funcional (como `useState`) para el setter numérico. */
type NumberUpdater = number | ((prev: number) => number);

/**
 * Variante numérica de {@link useQueryParamState} para paginación (`page`, etc.). Serializa
 * a string en la URL y parsea de vuelta a número (fallback al default si es inválido).
 * El setter admite updater funcional (`setPage((p) => p + 1)`) como `useState`.
 */
export function useQueryParamNumber(
  key: string,
  defaultValue: number,
): [number, (value: NumberUpdater) => void] {
  const [raw, setRaw] = useQueryParamState<string>(key, String(defaultValue));

  const parsed = Number.parseInt(raw, 10);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;

  const setValue = useCallback(
    (next: NumberUpdater) => {
      const resolved =
        typeof next === 'function'
          ? next(Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue)
          : next;
      setRaw(String(resolved));
    },
    [setRaw, parsed, defaultValue],
  );

  return [value, setValue];
}

/**
 * Búsqueda persistida en la URL con debounce. Devuelve:
 * - `value`: el texto **en vivo** (cada tecla) para bindear al input; NO toca la URL.
 * - `setValue`: setter del texto en vivo.
 * - `committed`: el valor **post-debounce**, ya recortado. Es el que efectivamente vive en
 *   la URL y con el que se filtra.
 *
 * El param de la URL guarda solo el valor *committed* (no cada tecla), evitando reescribir
 * la URL en cada pulsación. Al montar (o si la URL cambia externamente, p. ej. navegación),
 * el texto en vivo se rehidrata desde el param.
 */
export function useQueryParamSearch(
  key: string,
  delay = 300,
): { value: string; setValue: (value: string) => void; committed: string } {
  const [urlValue, setUrlValue] = useQueryParamState<string>(key, '');

  // Texto en vivo del input (estado de cliente puro).
  const [liveValue, setLiveValue] = useState<string>(urlValue);

  // Rehidrata el input si la URL cambia por fuera (back/forward, enlace compartido) y no
  // coincide con lo que el usuario está tecleando; evita pisar la escritura en curso.
  const lastUrlValue = useRef(urlValue);
  useEffect(() => {
    if (urlValue !== lastUrlValue.current) {
      lastUrlValue.current = urlValue;
      setLiveValue(urlValue);
    }
  }, [urlValue]);

  // Solo el valor debounced se "committea" a la URL.
  const debounced = useDebounce(liveValue, delay);
  const committed = debounced.trim();

  useEffect(() => {
    if (committed !== urlValue) {
      lastUrlValue.current = committed;
      setUrlValue(committed);
    }
    // Intencionalmente solo reacciona al cambio del valor debounced (`committed`).
  }, [committed]);

  return { value: liveValue, setValue: setLiveValue, committed };
}

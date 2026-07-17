import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDebounce } from './use-debounce';

/**
 * Parche de query params para {@link useQueryParams}: `key → valor`, donde **`null` significa
 * "quita el param" de la URL**. Quitarlo es la forma en que este módulo expresa "vale su valor
 * por defecto" (mantiene la URL limpia).
 */
export type QueryParamPatch = Record<string, string | null>;

/**
 * Setter **por lotes** de query params: aplica todos los cambios del parche en un **único**
 * `setSearchParams` (es decir, una sola navegación).
 *
 * ⚠️ POR QUÉ EXISTE — QL-139. No lo "simplifiques" llamando a varios setters seguidos:
 * `setSearchParams` de react-router **NO es una cola tipo `useState`**. En react-router 7.18.1
 * (`react-router/dist/development/chunk-KS7C4IRE.mjs`, `useSearchParams`) el setter hace:
 *
 *     let searchParams = useMemo(() => getSearchParamsForLocation(location.search, …),
 *                                [location.search]);
 *     let setSearchParams = useCallback((nextInit, navigateOptions) => {
 *       const newSearchParams = createSearchParams(
 *         typeof nextInit === 'function' ? nextInit(new URLSearchParams(searchParams)) : nextInit
 *       );
 *       navigate('?' + newSearchParams, navigateOptions);
 *     }, [navigate, searchParams]);
 *
 * El `searchParams` que recibe el updater está memoizado sobre `[location.search]`: es la URL
 * **del render actual capturada en el closure**, NO el resultado de la llamada anterior. Y
 * `navigate('?' + …)` **reemplaza** el search entero. Consecuencia: dos setters en el mismo
 * handler leen ambos la URL vieja y el segundo pisa al primero.
 *
 * Bug real que esto causó: en Notificaciones, `setFilter('unread')` seguido de `setPage(1)`
 * descartaba el `estado=unread` recién puesto (porque `setPage(1)` recomputaba desde unos
 * params que todavía no lo tenían), y la pestaña "No leídas" no se activaba nunca.
 *
 * Regla: **una acción del usuario = un solo `setParams`**.
 */
export function useQueryParams(): (patch: QueryParamPatch) => void {
  const [, setSearchParams] = useSearchParams();

  return useCallback(
    (patch: QueryParamPatch) => {
      setSearchParams(
        (prev) => {
          // Merge sobre los params actuales para no pisar otros filtros de la página.
          const params = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null) {
              params.delete(key);
            } else {
              params.set(key, value);
            }
          }
          return params;
        },
        // `replace: true`: los filtros no deben llenar el history del navegador.
        { replace: true },
      );
    },
    [setSearchParams],
  );
}

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
 * ⚠️ Un `setValue` = una navegación. Para cambiar **varios** params a la vez (p. ej. cambiar
 * de filtro y resetear la paginación) NO encadenes setters: se pisan entre sí. Usa
 * {@link useQueryParams} y hazlo en un solo `setParams` (ver el porqué allí, QL-139).
 *
 * Estado de cliente puro (no dato de servidor): la fuente de verdad es la URL, no un
 * store. Encaja con la arquitectura (Zustand solo para sesión/UI global).
 */
export function useQueryParamState<T extends string>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [searchParams] = useSearchParams();
  // Se apoya en el mismo mecanismo que el setter por lotes: un único camino de escritura.
  const setParams = useQueryParams();

  const raw = searchParams.get(key);
  const value = (raw ?? defaultValue) as T;

  const setValue = useCallback(
    (next: T) => {
      // `null` = quitar el param (el valor es el default) → URL limpia.
      setParams({ [key]: next === defaultValue ? null : next });
    },
    [key, defaultValue, setParams],
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

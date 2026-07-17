/**
 * Comparación SemVer **numérica por segmentos** (QL-148, §3.43). Nunca comparar versiones como
 * strings: `'1.10.0' < '1.9.0'` es `true` en orden lexicográfico, pero `1.10.0 > 1.9.0` como
 * versión. Solo se usan los tres segmentos `major.minor.patch` del contrato (`x.y.z`); un segmento
 * ausente o no numérico se trata como `0`.
 */

/** Extrae `[major, minor, patch]` como enteros; segmentos ausentes/no numéricos → `0`. */
function parseSegments(version: string): [number, number, number] {
  const parts = version.split('.');
  const at = (index: number): number => {
    const parsed = Number.parseInt(parts[index] ?? '', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [at(0), at(1), at(2)];
}

/** `-1` si `a < b`, `1` si `a > b`, `0` si son iguales (comparación numérica por segmentos). */
export function compareSemver(a: string, b: string): number {
  const pa = parseSegments(a);
  const pb = parseSegments(b);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** `true` si `current` es **anterior** a `target` (este cliente está desactualizado). */
export function isOutdated(current: string, target: string): boolean {
  return compareSemver(current, target) < 0;
}

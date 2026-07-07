/**
 * Iniciales para el fallback del avatar (máx. 2 letras). Utilidad compartida: la usan
 * `AuthedAvatar` y las celdas de tabla, para no duplicar la derivación del nombre.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

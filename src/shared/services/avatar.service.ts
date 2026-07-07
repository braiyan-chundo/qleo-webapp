import { ApiError } from '@/core/api/fetch-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Servicio del avatar autenticado (QL-32, §3.15). El proxy privado
 * `GET /users/:id/avatar` **requiere `Authorization: Bearer`**, así que una `<img src>`
 * desnuda no funciona: hay que hacer `fetch` con el token y crear un `blob:` URL.
 *
 * Replica la resolución de `BASE_URL` y el `authHeader` del `attachments.service` (el
 * `fetch-client` estándar solo devuelve JSON envuelto y no expone su `baseUrl`).
 */

const BASE_URL = import.meta.env.VITE_QLEO_API_BASE_URL || '/api';

/** Lee el token de la sesión (Zustand). Fuera de React, por eso `getState()`. */
function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Maneja el 401 global igual que el `fetch-client` (cierra sesión y manda al login). */
function handleUnauthorized(status: number) {
  if (status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }
}

/**
 * Sube (o reemplaza) el avatar del propio perfil (`POST /users/me/avatar`, multipart,
 * campo `file`). Usa `fetch` manual porque el `api` fuerza `Content-Type: application/json`;
 * en multipart el navegador debe poner el `boundary`, así que **no** seteamos `Content-Type`.
 * Devuelve el `UserResponseDto` actualizado (con `avatarDownloadUrl` != null).
 */
export async function uploadAvatarRequest<T>(file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/users/me/avatar`, {
    method: 'POST',
    headers: authHeader(),
    body: formData,
  });

  if (!response.ok) {
    handleUnauthorized(response.status);
    const result = await response.json().catch(() => null);
    const message = result?.error?.message || response.statusText || 'Error desconocido';
    const code = result?.error?.code ?? null;
    throw new ApiError(message, code, response.status);
  }

  const result = await response.json().catch(() => null);
  return (result?.data ?? result) as T;
}

/**
 * Descarga el binario del avatar de un usuario (`GET /users/:id/avatar`) con el token y lo
 * convierte en un `blob:` URL para usar en `<img src>`. Devuelve `null` en **404** (el
 * usuario no tiene avatar subido) para que `AuthedAvatar` degrade al siguiente fallback.
 * Lanza `ApiError` en el resto de fallos.
 */
export async function fetchAvatarObjectUrl(downloadUrl: string): Promise<string | null> {
  const response = await fetch(`${BASE_URL}${downloadUrl}`, {
    method: 'GET',
    headers: authHeader(),
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    handleUnauthorized(response.status);
    throw new ApiError(response.statusText || 'Error al cargar el avatar', null, response.status);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Descarga el avatar (proxy autenticado) y lo devuelve como **data URL** (QL-44). A
 * diferencia de un `blob:` URL —vivo solo durante la sesión de la página—, un data URL se
 * puede persistir en `localStorage` y sobrevive a recargas y al cierre de sesión, así que
 * sirve para cachear la foto de la "última cuenta" y mostrarla en el login sin token.
 *
 * Best-effort: devuelve `null` (sin lanzar) si no hay avatar, falla la red o el token ya no
 * es válido, para no romper el flujo de login que lo invoca.
 */
export async function fetchAvatarDataUrl(downloadUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}${downloadUrl}`, {
      method: 'GET',
      headers: authHeader(),
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

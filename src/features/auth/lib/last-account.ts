import { fetchAvatarDataUrl } from '@/shared/services/avatar.service';
import type { User } from '@/store/auth.store';

/**
 * Persistencia de la "última cuenta" para el login (QL-44). Vive en su **propia** clave de
 * `localStorage`, SEPARADA de `auth-storage`, para que sobreviva al `logout()` y podamos
 * ofrecer "¿Esta es tu cuenta?" tras cerrar sesión.
 *
 * Nunca guardamos la contraseña. `avatar` es un data URL cacheado (o una URL externa, o
 * `null` → iniciales) para pintar la foto sin token en la pantalla de login.
 */
export interface LastAccount {
  name: string;
  email: string;
  /** Data URL del avatar cacheado, URL externa, o `null` → iniciales. */
  avatar: string | null;
}

const STORAGE_KEY = 'qleo:last-account';

/** Lee la última cuenta recordada, o `null` si no hay/el JSON está corrupto. */
export function getLastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>).email !== 'string' ||
      typeof (parsed as Record<string, unknown>).name !== 'string'
    ) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    return {
      name: record.name as string,
      email: record.email as string,
      avatar: typeof record.avatar === 'string' ? record.avatar : null,
    };
  } catch {
    return null;
  }
}

/** Guarda (o reemplaza) la última cuenta. Best-effort: ignora fallos de cuota/storage. */
export function setLastAccount(account: LastAccount): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Storage lleno o no disponible: no es crítico, seguimos sin recordar.
  }
}

/** Olvida la última cuenta ("Usar otra cuenta"). Best-effort. */
export function clearLastAccount(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ídem: fallo no crítico.
  }
}

/**
 * Cachea la cuenta recién autenticada como "última cuenta" (QL-44). Se llama en el
 * `onSuccess` del login, con el token ya puesto en el store. Resuelve el avatar en cascada:
 * data URL del avatar SUBIDO (fetch autenticado) → URL externa → `null`. Todo best-effort,
 * nunca bloquea ni rompe el login: siempre persiste al menos `{ name, email }`.
 */
export async function rememberAccount(user: User): Promise<void> {
  let avatar: string | null = user.avatarUrl ?? null;

  if (user.avatarDownloadUrl) {
    const dataUrl = await fetchAvatarDataUrl(user.avatarDownloadUrl);
    if (dataUrl) avatar = dataUrl;
  }

  setLastAccount({ name: user.name, email: user.email, avatar });
}

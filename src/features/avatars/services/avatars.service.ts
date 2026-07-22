import { api } from '@/core/api/fetch-client';
import { postMultipart } from '@/shared/services/avatar.service';
import type { User } from '@/store/auth.store';

/**
 * Servicio del **catálogo global de avatares** (QL-181, §3.59). El ADMIN cura el catálogo y
 * cualquier usuario autenticado puede leerlo y elegir uno como su foto de perfil.
 *
 * Ojo con la semántica de "elegir": el backend **copia** el binario al almacén del usuario, no
 * lo referencia. La foto se sigue pintando con el `avatarDownloadUrl` de siempre, y si el ADMIN
 * borra ese avatar del catálogo, quien ya lo eligió **conserva** su foto.
 */

/** Un avatar del catálogo global (`GET /avatars`). */
export interface CatalogAvatar {
  id: string;
  name: string;
  /** Proxy autenticado del binario (`/avatars/:id/image`); requiere token → `AuthedAvatar`. */
  downloadUrl: string;
  createdAt: string;
}

/** Body de `POST /users/me/avatar/from-catalog`. */
export interface ChooseAvatarPayload {
  avatarId: string;
}

/** Body de `PATCH /avatars/:id` (solo ADMIN): renombrar. */
export interface RenameAvatarPayload {
  name: string;
}

export const avatarsService = {
  /**
   * Catálogo completo (array plano ordenado por `createdAt` asc). **No pagina**: es un set
   * pequeño y curado, pensado para pintarse entero en una rejilla estable.
   */
  list: () => api.get<CatalogAvatar[]>('/avatars'),

  /**
   * Sube **un** avatar al catálogo (multipart, campo `file` + `name` opcional). Solo ADMIN.
   * Un archivo por request a propósito: el lote se sube en bucle para que un archivo rechazado
   * no tumbe el resto. Si `name` falta, el backend lo deriva del nombre original sin extensión.
   */
  create: (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);
    return postMultipart<CatalogAvatar>('/avatars', formData);
  },

  /** Renombra un avatar del catálogo. Solo ADMIN. */
  rename: (id: string, data: RenameAvatarPayload) =>
    api.patch<CatalogAvatar>(`/avatars/${id}`, data),

  /**
   * Borra el avatar del catálogo y su binario (devuelve el borrado, echo). Solo ADMIN.
   * Quien ya lo hubiera elegido **conserva su foto** (el backend copió el binario).
   */
  remove: (id: string) => api.delete<CatalogAvatar>(`/avatars/${id}`),

  /**
   * Elige un avatar del catálogo como foto propia (`POST /users/me/avatar/from-catalog`).
   * Cualquier autenticado. Devuelve el perfil actualizado. **404 `AVATAR_NOT_FOUND`** si el
   * ADMIN lo borró mientras tanto: es un caso normal, no un error de ruta.
   */
  chooseFromCatalog: (avatarId: string) =>
    api.post<User>('/users/me/avatar/from-catalog', {
      avatarId,
    } satisfies ChooseAvatarPayload),
};

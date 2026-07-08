import { api } from '@/core/api/fetch-client';
import type { AuthResponse } from '@/features/auth/services/auth.service';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

/**
 * Servicio WebAuthn / passkeys (QL-45, §3.19). Las 6 llamadas del contrato: opciones y
 * verificación de **enrolado** (autenticado) y de **login** (público), más el listado y
 * borrado de passkeys. Todo pasa por el `fetch-client` (envelope `{ success, data, error }`
 * ya desenvuelto): los métodos devuelven `T` directo, es decir el objeto de `data`.
 *
 * IMPORTANTE: `registerOptions`/`loginOptions` devuelven las **opciones** (`data`), que se
 * pasan a `startRegistration({ optionsJSON })` / `startAuthentication({ optionsJSON })`.
 */

/**
 * Passkey registrada (proyección segura del backend: sin claves ni counter). Misma forma en
 * el 201 de `register/verify` y en cada elemento de `GET /auth/webauthn/credentials`.
 */
export interface WebauthnCredential {
  id: string;
  deviceName: string | null;
  transports: string[];
  createdAt: string;
}

/** Body de `POST /auth/webauthn/register/verify`. */
export interface RegisterVerifyPayload {
  response: RegistrationResponseJSON;
  deviceName?: string;
}

export const webauthnService = {
  /** A) Enrolar — opciones de creación (autenticado). Body vacío. */
  registerOptions: () =>
    api.post<PublicKeyCredentialCreationOptionsJSON>('/auth/webauthn/register/options', {}),

  /** A) Enrolar — verifica la attestation y crea la passkey (autenticado). */
  registerVerify: (payload: RegisterVerifyPayload) =>
    api.post<WebauthnCredential>('/auth/webauthn/register/verify', payload),

  /** B) Entrar — opciones de aserción para un email (público). */
  loginOptions: (email: string) =>
    api.post<PublicKeyCredentialRequestOptionsJSON>('/auth/webauthn/login/options', { email }),

  /** B) Entrar — verifica la aserción y emite sesión (público). Misma forma que `/auth/login`. */
  loginVerify: (response: AuthenticationResponseJSON) =>
    api.post<AuthResponse>('/auth/webauthn/login/verify', { response }),

  /** C) Gestión — lista las passkeys del usuario (autenticado), ordenadas por fecha desc. */
  listCredentials: () => api.get<WebauthnCredential[]>('/auth/webauthn/credentials'),

  /** C) Gestión — borra una passkey por id (autenticado). 204 sin cuerpo. */
  deleteCredential: (id: string) =>
    api.delete<void>(`/auth/webauthn/credentials/${encodeURIComponent(id)}`),
};

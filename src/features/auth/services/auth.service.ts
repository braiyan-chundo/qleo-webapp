import { api } from '@/core/api/fetch-client';
import type { User } from '@/store/auth.store';

export interface LoginDto {
  email: string;
  password?: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password?: string;
  jobTitle?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** §3.30 — recuperación de contraseña por OTP (usuario sin sesión). */
export interface PasswordResetRequestDto {
  email: string;
}

export interface PasswordResetVerifyDto {
  email: string;
  code: string;
}

export interface PasswordResetConfirmDto {
  email: string;
  code: string;
  newPassword: string;
}

/** Respuesta genérica anti-enumeración de `request`. */
export interface PasswordResetRequestResponse {
  message: string;
}

/** Respuesta de `verify` cuando el OTP es válido y vigente. */
export interface PasswordResetVerifyResponse {
  valid: boolean;
}

export const authService = {
  login: (data: LoginDto) => {
    return api.post<AuthResponse>('/auth/login', data);
  },

  register: (data: RegisterDto) => {
    return api.post<AuthResponse>('/auth/register', data);
  },

  getProfile: () => {
    return api.get<User>('/auth/me');
  },

  /** §3.30 — pide el envío del código OTP al correo (siempre 200, anti-enumeración). */
  requestPasswordReset: (data: PasswordResetRequestDto) => {
    return api.post<PasswordResetRequestResponse>('/auth/password-reset/request', data);
  },

  /** §3.30 — valida el OTP sin consumirlo (paso previo de UX). */
  verifyPasswordResetOtp: (data: PasswordResetVerifyDto) => {
    return api.post<PasswordResetVerifyResponse>('/auth/password-reset/verify', data);
  },

  /** §3.30 — aplica la nueva contraseña, consume el OTP y devuelve la sesión (auto-login). */
  confirmPasswordReset: (data: PasswordResetConfirmDto) => {
    return api.post<AuthResponse>('/auth/password-reset/confirm', data);
  },
};

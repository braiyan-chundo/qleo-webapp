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

export const authService = {
  login: (data: LoginDto) => {
    return api.post<AuthResponse>('/auth/login', data);
  },
  
  register: (data: RegisterDto) => {
    return api.post<AuthResponse>('/auth/register', data);
  },
  
  getProfile: () => {
    return api.get<User>('/auth/me');
  }
};

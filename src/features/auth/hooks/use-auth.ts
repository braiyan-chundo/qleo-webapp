import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService, type LoginDto, type RegisterDto } from '../services/auth.service';
import { useAuthStore } from '@/store/auth.store';

/**
 * Hooks de datos del feature Auth. Encapsulan TanStack Query para que las páginas
 * NO llamen al service directamente ni manejen loading/error a mano. Este archivo es
 * el patrón de referencia para el resto de features (ver skill `react-data-fetching`).
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const authKeys = {
  profile: ['auth', 'me'] as const,
};

/** Inicia sesión y guarda las credenciales; navega al inicio al terminar. */
export function useLogin() {
  const navigate = useNavigate();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: (dto: LoginDto) => authService.login(dto),
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      navigate('/');
    },
  });
}

/** Registra un usuario (rol MEMBER), guarda credenciales y navega al inicio. */
export function useRegister() {
  const navigate = useNavigate();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: (dto: RegisterDto) => authService.register(dto),
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      navigate('/');
    },
  });
}

/**
 * Perfil del usuario autenticado. Útil para rehidratar/validar la sesión al cargar la
 * app con un token guardado. Solo corre si hay token.
 */
export function useProfile() {
  const token = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: authKeys.profile,
    queryFn: async () => {
      const user = await authService.getProfile();
      setUser(user);
      return user;
    },
    enabled: !!token,
  });
}

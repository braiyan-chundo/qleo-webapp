import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService, type LoginDto, type RegisterDto } from '../services/auth.service';
import { rememberAccount } from '../lib/last-account';
import { useAuthStore } from '@/store/auth.store';
import { getFromPath } from '@/shared/lib/router-state';

/**
 * Hooks de datos del feature Auth. Encapsulan TanStack Query para que las páginas
 * NO llamen al service directamente ni manejen loading/error a mano. Este archivo es
 * el patrón de referencia para el resto de features (ver skill `react-data-fetching`).
 */

/** Claves de query del feature. Centralizadas para invalidación consistente. */
export const authKeys = {
  profile: ['auth', 'me'] as const,
};

/**
 * Inicia sesión, guarda credenciales y navega a la ruta previa (`state.from`, colocada por
 * `SessionGate`) o al inicio (QL-49). Además cachea la "última cuenta" para el login (QL-44),
 * best-effort: no bloquea ni condiciona la navegación.
 */
export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: (dto: LoginDto) => authService.login(dto),
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      // QL-44: recuerda la cuenta (incl. avatar) sin bloquear el redirect.
      void rememberAccount(res.user);
      navigate(getFromPath(location.state) ?? '/', { replace: true });
    },
  });
}

/**
 * Registra un usuario (rol MEMBER), guarda credenciales y navega a la ruta previa o al inicio.
 * También cachea la última cuenta (QL-44) de forma best-effort.
 */
export function useRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const setCredentials = useAuthStore((s) => s.setCredentials);

  return useMutation({
    mutationFn: (dto: RegisterDto) => authService.register(dto),
    onSuccess: (res) => {
      setCredentials(res.accessToken, res.user);
      void rememberAccount(res.user);
      navigate(getFromPath(location.state) ?? '/', { replace: true });
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

import { useAuthStore } from '@/store/auth.store';

/**
 * Error tipado que emite el cliente HTTP cuando el backend responde con fallo.
 * Extiende `Error` (retrocompatible: `err instanceof Error` y `err.message` siguen
 * funcionando) y expone además el `code` semántico del contrato (§1.6) y el `status`
 * HTTP, para reaccionar al código y no al texto (p.ej. `COLUMN_HAS_TASKS`,
 * `SINGLE_ASSIGNEE_REQUIRED`, `DEADLINE_LOCKED`…).
 */
export class ApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    // Mantiene la cadena de prototipos correcta al transpilar a ES5/target antiguo.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

interface FetchClientOptions extends RequestInit {
  data?: unknown;
}

class FetchClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: FetchClientOptions = {}): Promise<T> {
    const { data, headers, ...customConfig } = options;
    const token = useAuthStore.getState().accessToken;

    const config: RequestInit = {
      ...customConfig,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const result = await response.json().catch(() => null);

      if (!response.ok || (result && result.success === false)) {
        // Handle 401 Unauthorized globally
        if (response.status === 401) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }

        const errorMessage = result?.error?.message || response.statusText || 'Error desconocido';
        const errorCode = result?.error?.code ?? null;
        return Promise.reject(new ApiError(errorMessage, errorCode, response.status));
      }

      // El backend envuelve todo en `{ success, data, error }`. Devolvemos `data` tal cual —incluido
      // `null`, que es un valor legítimo (p. ej. "sin malla vigente", "sin recurso actual")—; solo
      // caemos a `result` crudo si la respuesta NO vino envuelta. El viejo `result?.data ?? result`
      // trataba `data: null` como "no hay data" y devolvía el sobre entero, reventando a los
      // consumidores tipados como `T | null` (p. ej. el calendario del MEMBER sin malla).
      const isEnvelope =
        result != null &&
        typeof result === 'object' &&
        'success' in result &&
        'data' in result;
      return (isEnvelope ? result.data : result) as T;
    } catch (error) {
      return Promise.reject(error);
    }
  }

  get<T>(endpoint: string, options?: Omit<FetchClientOptions, 'method' | 'data'>) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, data?: unknown, options?: Omit<FetchClientOptions, 'method' | 'data'>) {
    return this.request<T>(endpoint, { ...options, data, method: 'POST' });
  }

  put<T>(endpoint: string, data?: unknown, options?: Omit<FetchClientOptions, 'method' | 'data'>) {
    return this.request<T>(endpoint, { ...options, data, method: 'PUT' });
  }

  patch<T>(endpoint: string, data?: unknown, options?: Omit<FetchClientOptions, 'method' | 'data'>) {
    return this.request<T>(endpoint, { ...options, data, method: 'PATCH' });
  }

  delete<T>(endpoint: string, options?: Omit<FetchClientOptions, 'method' | 'data'>) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new FetchClient(import.meta.env.VITE_QLEO_API_BASE_URL || '/api');

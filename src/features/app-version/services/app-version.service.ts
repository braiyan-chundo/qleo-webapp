import { api } from '@/core/api/fetch-client';

import type { AppVersionCheckResult, CheckAppVersionDto } from '../types/app-version.types';

/**
 * Acceso a datos del feature App Version (QL-148, §3.43). Se consume desde TanStack Query
 * (`hooks/use-app-version.ts`); devuelve `T` directo (el fetch-client desenvuelve `{ success, data }`
 * y maneja el 401 global).
 */
export const appVersionService = {
  /**
   * Reporta la versión del bundle al backend (`POST /app-version/check`). Idempotente por versión:
   * el backend publica el aviso de release **una sola vez**. El front no necesita reaccionar a la
   * respuesta (el aviso llega por el feed del muro); `latestVersion` se expone solo para depuración.
   */
  check: (version: string) =>
    api.post<AppVersionCheckResult>('/app-version/check', {
      version,
    } satisfies CheckAppVersionDto),
};

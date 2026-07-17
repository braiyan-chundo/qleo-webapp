/**
 * Tipos del feature App Version (QL-148, §3.43). Al arrancar (con sesión válida) el front reporta
 * su `__APP_VERSION__` al backend; este responde la última versión conocida. El aviso REAL de una
 * nueva versión NO llega por esta respuesta, sino por el feed del muro como mensaje de sistema
 * (`type:'system'`, `systemKind:'version_release'`), así que la respuesta es solo depuración.
 */

/** Body de `POST /app-version/check`: la versión del bundle (SemVer `x.y.z`). */
export interface CheckAppVersionDto {
  version: string;
}

/** Respuesta (`data`) de `POST /app-version/check`. */
export interface AppVersionCheckResult {
  latestVersion: string;
}

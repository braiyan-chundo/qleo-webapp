/// <reference lib="webworker" />

/**
 * Service worker propio de Qleo (F3 QL-30 — infraestructura de push).
 *
 * Estrategia `injectManifest` de vite-plugin-pwa: este archivo se compila en el
 * build y Workbox reemplaza `self.__WB_MANIFEST` por el precache manifest.
 *
 * Aquí SOLO vive la infraestructura para RECIBIR y MOSTRAR notificaciones push
 * y manejar el click. La suscripción (`pushManager.subscribe`), el toggle del
 * perfil y las llamadas a `/push/*` son F4 (otra tarea) y NO se implementan aquí.
 */
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

import { IMAGE_CACHE_NAME } from './shared/lib/image-cache'

// El contexto de un SW es `ServiceWorkerGlobalScope`, no `Window`.
declare const self: ServiceWorkerGlobalScope

// --- Precache del app shell (Workbox) -------------------------------------
// `self.__WB_MANIFEST` lo inyecta vite-plugin-pwa en build.
precacheAndRoute(self.__WB_MANIFEST)

// --- Caché persistente de imágenes (QL-182, §3.60) ------------------------
// El backend sirve `private, max-age=86400, immutable` en los tres endpoints de binarios y la
// URL identifica al binario (avatar de usuario por `?v=<hash>`; catálogo y adjuntos por id), así
// que cachear la RESPUESTA ya resuelta 24 h es seguro. Con esto la imagen persiste entre recargas
// y cierres de app SIN inflar la RAM (los blobs en memoria de TanStack Query siguen a 5 min).
//
// Nombre de caché VERSIONADO (`IMAGE_CACHE_NAME`, fuente única compartida con la app): al cerrar
// sesión la app lo vacía por privacidad (equipo compartido) vía `clearImageCache`.
//
// Rutas de binario cacheables. Se hace match por `url.pathname` (no por origen) porque la API
// puede vivir en otro origen (`VITE_QLEO_API_BASE_URL`).
const IMAGE_PATH_RE =
  /^\/(?:users\/[^/]+\/avatar|avatars\/[^/]+\/image|attachments\/[^/]+\/download)$/

// ⚠️ `/attachments/:id/download` también sirve PDF y vídeo de hasta 50 MB (QL-177): NO deben
// entrar en esta caché de imágenes. El filtro guarda solo respuestas 200 cuyo `Content-Type`
// empieza por `image/` y cuyo `Content-Length` está por debajo de un techo razonable; lo que no
// pasa se sirve igual, simplemente no se persiste.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // ~5 MB

registerRoute(
  ({ url }) => IMAGE_PATH_RE.test(url.pathname),
  new CacheFirst({
    cacheName: IMAGE_CACHE_NAME,
    plugins: [
      {
        // Solo se guarda una imagen 200 por debajo del techo; el resto (PDF/vídeo, errores) se
        // sirve pero no se cachea. Devolver `null` aquí descarta el almacenamiento.
        cacheWillUpdate: async ({ response }) => {
          if (response.status !== 200) return null
          const type = response.headers.get('Content-Type') ?? ''
          if (!type.startsWith('image/')) return null
          const length = Number(response.headers.get('Content-Length') ?? '0')
          if (length > MAX_IMAGE_BYTES) return null
          return response
        },
      },
      new ExpirationPlugin({
        maxAgeSeconds: 86400, // 1 día, alineado con el `max-age` del backend
        maxEntries: 300,
        purgeOnQuotaError: true,
      }),
    ],
  }),
)

// --- Auto-update (equivalente a registerType: 'autoUpdate') ---------------
// Tomamos el control inmediatamente para que la versión nueva del SW active
// sin esperar a que se cierren todas las pestañas.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// --- Actualización forzada desde la app (QL-148) --------------------------
// La acción "Actualizar" del aviso de nueva versión hace `registration.update()` y, si el SW
// nuevo quedara en "waiting", nos manda `SKIP_WAITING` para activar el build nuevo de inmediato
// (además del `self.skipWaiting()` de arriba, que ya cubre el flujo normal de autoUpdate).
self.addEventListener('message', (event) => {
  const data = event.data as { type?: string } | null
  if (data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// --- Payload que envía el backend (F2) ------------------------------------
// El backend enviará: { title, body, url, type, badge? }. En el MVP `url` = '/notifications'.
interface PushPayload {
  title?: string
  body?: string
  url?: string
  type?: string
  /** (QL-118) nº de no leídos del destinatario en el momento del push. Best-effort. */
  badge?: number
}

// --- Badging API (QL-118, §3.17) ------------------------------------------
// Pinta/limpia el contador numérico del icono de la app (estilo WhatsApp). En un SW la API
// vive en `self.navigator` (WorkerNavigator); `lib.webworker` no la tipa, así que la
// declaramos de forma mínima. Nunca debe romper el `waitUntil`: todo va con feature-detection
// y try/catch, y siempre resuelve.
interface BadgingNavigator {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

function setAppBadge(count: number): Promise<void> {
  const nav = self.navigator as WorkerNavigator & BadgingNavigator
  if (typeof nav.setAppBadge !== 'function') return Promise.resolve()
  try {
    return Promise.resolve(nav.setAppBadge(count)).catch(() => undefined)
  } catch {
    return Promise.resolve()
  }
}

function clearAppBadge(): Promise<void> {
  const nav = self.navigator as WorkerNavigator & BadgingNavigator
  if (typeof nav.clearAppBadge !== 'function') return Promise.resolve()
  try {
    return Promise.resolve(nav.clearAppBadge()).catch(() => undefined)
  } catch {
    return Promise.resolve()
  }
}

/**
 * Aplica el badge que viene en el payload del push. Si `badge` no es número (el backend no
 * lo pudo calcular), NO se toca el badge. `badge > 0` lo pinta; `badge === 0` lo limpia.
 */
function applyBadgeFromPayload(badge: number | undefined): Promise<void> {
  if (typeof badge !== 'number') return Promise.resolve()
  return badge > 0 ? setAppBadge(badge) : clearAppBadge()
}

const DEFAULT_TITLE = 'Qleo'
const DEFAULT_BODY = 'Tienes una nueva notificación'
const DEFAULT_URL = '/notifications'

function parsePayload(event: PushEvent): PushPayload {
  if (!event.data) return {}
  try {
    return event.data.json() as PushPayload
  } catch {
    // Si no es JSON válido, degradamos a texto plano en el body.
    try {
      const text = event.data.text()
      return text ? { body: text } : {}
    } catch {
      return {}
    }
  }
}

// --- Listener `push`: muestra la notificación -----------------------------
self.addEventListener('push', (event) => {
  const payload = parsePayload(event)
  const title = payload.title ?? DEFAULT_TITLE
  const url = payload.url ?? DEFAULT_URL

  const options: NotificationOptions = {
    body: payload.body ?? DEFAULT_BODY,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: { url },
  }

  // Mostramos la notificación y, en paralelo, pintamos el badge numérico del icono (QL-118).
  // Ambas van dentro del mismo `waitUntil`; el badge es best-effort y no rompe si falla.
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      applyBadgeFromPayload(payload.badge),
    ]).then(() => undefined),
  )
})

// --- Listener `notificationclick`: enfoca/abre la ventana correcta --------
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = (event.notification.data ?? {}) as { url?: string }
  const targetPath = data.url ?? DEFAULT_URL
  const targetUrl = self.location.origin + targetPath

  // Al abrir/enfocar la app el usuario "ve" las novedades: limpiamos el badge del icono
  // (QL-118). El cliente lo re-sincroniza con el conteo fresco (polling) al montarse.
  const focusWindow = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Si ya hay una ventana de la app abierta, la enfocamos y navegamos.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if ('navigate' in focused) {
              return focused.navigate(targetUrl).then(() => undefined)
            }
            return undefined
          })
        }
      }
      // Si no hay ninguna, abrimos una nueva.
      return self.clients.openWindow(targetUrl).then(() => undefined)
    })

  event.waitUntil(Promise.all([focusWindow, clearAppBadge()]).then(() => undefined))
})

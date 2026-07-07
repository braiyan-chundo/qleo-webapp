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

// El contexto de un SW es `ServiceWorkerGlobalScope`, no `Window`.
declare const self: ServiceWorkerGlobalScope

// --- Precache del app shell (Workbox) -------------------------------------
// `self.__WB_MANIFEST` lo inyecta vite-plugin-pwa en build.
precacheAndRoute(self.__WB_MANIFEST)

// --- Auto-update (equivalente a registerType: 'autoUpdate') ---------------
// Tomamos el control inmediatamente para que la versión nueva del SW active
// sin esperar a que se cierren todas las pestañas.
self.skipWaiting()
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// --- Payload que envía el backend (F2) ------------------------------------
// El backend enviará: { title, body, url, type }. En el MVP `url` = '/notifications'.
interface PushPayload {
  title?: string
  body?: string
  url?: string
  type?: string
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

  event.waitUntil(self.registration.showNotification(title, options))
})

// --- Listener `notificationclick`: enfoca/abre la ventana correcta --------
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = (event.notification.data ?? {}) as { url?: string }
  const targetPath = data.url ?? DEFAULT_URL
  const targetUrl = self.location.origin + targetPath

  event.waitUntil(
    self.clients
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
      }),
  )
})

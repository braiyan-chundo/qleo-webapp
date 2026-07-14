---
name: react-pwa-push-closed-app
description: >
  Patrón completo de notificaciones push que llegan con la PWA CERRADA + badge numérico del
  icono (estilo WhatsApp) en qleo-webapp: service worker `injectManifest` (`src/sw.ts`),
  handlers `push`/`notificationclick`, Badging API (`setAppBadge`/`clearAppBadge`), suscripción
  VAPID (`use-push.ts` + `push.service.ts`) y auto-re-suscripción ante desajuste de clave.
  Usa esta habilidad al tocar el flujo de push, el badge del icono, o al diagnosticar
  "los push solo llegan al abrir la app".
---

# Push con la PWA cerrada + badge del icono (QL-30 / QL-118)

Web Push en Qleo: recibir notificaciones **con la pestaña/PWA cerrada** y pintar el **badge
numérico del icono** de la app. El contrato back→front vive en `../INTEGRACION_FRONTEND.md`
§3.17 (payload, tabla de qué cuenta `badge` por `type`).

## Arquitectura

| Pieza | Archivo | Responsabilidad |
|-------|---------|-----------------|
| Service worker | `src/sw.ts` | Recibe el `push`, muestra la `Notification`, pinta/limpia el badge, maneja `notificationclick`. |
| Badge en el SW | `src/sw.ts` (`applyBadgeFromPayload`) | `setAppBadge`/`clearAppBadge` con la app **cerrada**, desde el payload. |
| Badge en cliente | `src/shared/lib/app-badge.ts` | `setAppBadge`/`clearAppBadge` mientras la PWA está **abierta**. |
| Sync del badge | `src/shared/hooks/use-app-badge-sync.ts` | Une los no leídos (campana + muro) y sincroniza el badge; se monta en `AppLayout`. |
| Suscripción | `src/features/push/hooks/use-push.ts` | Permiso, `pushManager.subscribe`, estado tri-estado, **auto-re-suscripción**. |
| Red | `src/features/push/services/push.service.ts` | `getVapidPublicKey()`, `subscribe()`, `unsubscribe()`. |
| Helpers | `src/features/push/lib/push-utils.ts` | `urlBase64ToUint8Array`, `applicationServerKeyMatches`, `isPushSupported`. |

### Estrategia del SW: `injectManifest`
`vite-plugin-pwa` compila `src/sw.ts` (no genera un SW autoescrito). Es un
`ServiceWorkerGlobalScope` (`/// <reference lib="webworker" />` + `declare const self`).
Workbox reemplaza `self.__WB_MANIFEST` (precache del app shell). Aquí viven los listeners
`push` y `notificationclick`.

### Contrato del payload (lo recibe el SW, no una respuesta HTTP)
```ts
{ title: string; body: string; url: string; type: string; badge?: number }
```
- `type`: `'MENTION' | 'DEADLINE_EXTENSION_REQUEST' | 'WALL_MENTION' | 'WALL_MESSAGE'`.
- `url`: ruta a abrir al hacer clic (`/notifications` o `/?tab=muro`).
- `badge` (QL-118): nº de **no leídos** del destinatario en el momento del push. **Opcional /
  best-effort**: si no viene, el SW **no toca** el badge (no lo pone a 0).

## Requisitos para que un push llegue con la app CERRADA
1. **VAPID en el backend** (par de claves configurado). El front obtiene la pública por
   `GET /push/vapid-public-key`; si viene `""`, el server no tiene VAPID → no suscribir.
2. **Suscripción válida** registrada en el backend (`POST /push/subscribe` con
   `subscription.toJSON()` → `{ endpoint, keys: { p256dh, auth } }`).
3. **`userVisibleOnly: true`** en `pushManager.subscribe` (obligatorio en Chrome/Android; si
   no, el navegador no entrega el push en background).
4. **La clave de la suscripción debe COINCIDIR con la VAPID vigente** (ver gotcha abajo).
5. **iOS**: solo con la PWA **instalada** en pantalla de inicio (iOS 16.4+). `isPushSupported()`
   feature-detecta `serviceWorker` + `PushManager` + `Notification`.

## Gotcha central: desajuste de clave VAPID → "solo llega al abrir la app"
Si el dispositivo se suscribió con una `applicationServerKey` **antigua** (rotaste VAPID, o el
usuario venía de una versión previa), el push service **rechaza el envío con 403** y **no**
limpia la suscripción. Resultado típico: los push "solo llegan cuando abres la app" (porque el
polling in-app sí trae las novedades, pero el push en background nunca sale).

### Solución: auto-re-suscripción silenciosa (`use-push.ts`)
Al montar, si hay suscripción activa **y** permiso concedido:
1. Pide la VAPID vigente (`refetchVapidKey`).
2. Compara `subscription.options.applicationServerKey` (`ArrayBuffer | null`) con la pública,
   **normalizando ambas a base64url sin padding** (`applicationServerKeyMatches` en
   `push-utils.ts`). Clave `null` ⇒ trátala como desajuste.
3. Si **no** coinciden: `subscription.unsubscribe()` local → `subscribeDevice()` con la clave
   nueva (re-`subscribe` + `POST /push/subscribe`) → best-effort `DELETE /push/subscribe` del
   endpoint viejo.
4. **Silencioso**: sin toasts, **sin** `requestPermission` (ya hay permiso). No cambia el flujo
   de `enable()`/`disable()`; ambos reutilizan `subscribeDevice()`.

## Badge del icono (Badging API)
`navigator.setAppBadge(n)` / `navigator.clearAppBadge()`. Siempre **feature-detect**
(`'setAppBadge' in navigator`) y envolver en try/catch (puede rechazar). El SW y el cliente
tienen su propia copia mínima tipada porque `lib.webworker`/`lib.dom` no siempre la tipan.

**Se pinta:**
- **App cerrada** → en el handler `push` del SW, tras `showNotification`: `applyBadgeFromPayload`
  (`badge > 0` → set; `badge === 0` → clear; sin número → no tocar). Va dentro del mismo
  `waitUntil` (best-effort, no rompe la notificación).
- **App abierta** → `useAppBadgeSync()` (montado en `AppLayout`) suma los no leídos de la campana
  (`useUnreadCount`) y del muro (`useWallUnreadCount`) —ambos ya sondeados por TanStack Query— y
  `setAppBadge(total)` o `clearAppBadge()` cuando el total es 0.

**Se limpia:**
- En `notificationclick` del SW (al abrir/enfocar la app).
- Cuando el total de no leídos baja a 0 estando la app abierta (`useAppBadgeSync`).

El badge del push es una **foto puntual**; el conteo "en vivo" lo refresca el polling. Por eso
el cliente re-sincroniza al montarse tras abrir la app.

## Checklist de diagnóstico en producción ("no llega con la app cerrada")
1. **`GET /push/vapid-public-key`** devuelve una `publicKey` no vacía (VAPID configurado).
2. **Backend emite** el push (revisa logs de emisión): ¿se intentó enviar al endpoint?
3. **Código de rechazo del push service:**
   - **403** → **desajuste de clave VAPID** (el caso más común). La auto-re-suscripción de
     `use-push.ts` lo corrige al siguiente arranque; verifica que la suscripción se re-registró.
   - **410 / 404** → suscripción **caducada/inexistente**; el backend la purga solo al fallar el
     envío. El front no gestiona esto.
4. **DevTools → Application → Service Workers**: el SW está `activated`; **Push** (test) muestra
   la notificación → confirma que los handlers `push`/`notificationclick` funcionan.
5. **`userVisibleOnly: true`** en la suscripción (sin él, no hay push en background).
6. **iOS**: la PWA está **instalada** (no en Safari normal) y el permiso está concedido.

## Reglas del proyecto (no romper)
- `src/sw.ts` es un `ServiceWorkerGlobalScope`: mantén tipos correctos, nada de `any`.
- Datos de servidor por **TanStack Query** (VAPID key = query cacheable); la **suscripción** es
  estado del navegador, vive con `useState`/`useEffect` en `use-push.ts`, no en Zustand.
- Badge/SW: **feature-detection + try/catch** siempre; best-effort, nunca rompas `waitUntil`.
- `enable()` requiere gesto del usuario; la re-suscripción **no** (ya hay permiso).
- Versión (QL-116): tocar este flujo con `feat` → sube **minor** en `package.json`.

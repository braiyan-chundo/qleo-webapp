---
name: react-pwa
description: >
  Configuración y convenciones PWA de qleo-webapp con vite-plugin-pwa: manifest,
  estrategia de actualización, assets/íconos y consideraciones offline. Usa esta
  habilidad al ajustar el comportamiento instalable/offline de la app.
---

# PWA — vite-plugin-pwa (qleo-webapp)

## Configuración (`vite.config.ts`)
El plugin `VitePWA` ya está montado con `registerType: 'autoUpdate'` y un `manifest`
(nombre "Qleo MICE", `theme_color` `#0f62fe`, íconos 192/512). El service worker se
genera en build y se autoactualiza cuando hay una versión nueva.

```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
  manifest: { name: 'Qleo MICE', short_name: 'Qleo', theme_color: '#0f62fe', icons: [...] },
})
```

## Íconos y assets
Van en `public/`. Asegura que existan `pwa-192x192.png`, `pwa-512x512.png` y los assets
de `includeAssets`. El `theme_color` del manifest debe alinearse con el token primario.

## Estrategia de caché / offline
- `autoUpdate`: no molesta al usuario con prompts; toma la versión nueva al recargar.
- Para una app de datos como Qleo, **no** caches respuestas de la API con el SW: la
  frescura de datos la maneja TanStack Query. El SW cachea el **app shell** (assets),
  no los datos.
- Si más adelante se requiere trabajo offline real (colas de mutaciones, etc.), evalúa
  `workbox` runtime caching y persistencia de la caché de Query — pero es fuera del MVP.

## Verificación
- `pnpm build && pnpm preview` y comprueba en el navegador (DevTools → Application) que el
  manifest es válido y el SW se registra.
- La app debe ser instalable (icono de instalar en la barra de direcciones).

## Convenciones
- No dupliques el `theme_color`/nombre en varios sitios; el manifest del plugin es la
  fuente. El `<title>`/meta viven en `index.html`.
- Cambios de íconos → regenera y verifica tamaños 192 y 512 (maskable recomendado).

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { createRequire } from 'node:module'
import path from 'path'

// QL-116: exponemos la versión del producto (fuente de verdad: `package.json`) al bundle
// como `__APP_VERSION__`. Usamos `createRequire` en lugar de `import pkg from './package.json'`
// para no depender de `resolveJsonModule` en la config de Node y compilar limpio; el `as`
// evita que `version` se filtre como `any`.
const require = createRequire(import.meta.url)
const pkg = require('./package.json') as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // Service worker propio (F3 QL-30): pasamos de la estrategia por defecto
      // `generateSW` a `injectManifest` para poder registrar listeners `push` y
      // `notificationclick` en `src/sw.ts`. Workbox sigue inyectando el precache
      // manifest (`self.__WB_MANIFEST`) en ese archivo durante el build.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // `autoUpdate` + `injectManifest` es compatible en vite-plugin-pwa@1.3.0:
      // el plugin inyecta el registro (immediate) y el SW hace skipWaiting +
      // clientsClaim por su cuenta (ver src/sw.ts).
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // QL-35: con `injectManifest`, el plugin NO registra el SW en `pnpm dev` salvo que se
      // active explícitamente `devOptions`. Sin esto, `navigator.serviceWorker.ready` no
      // resuelve nunca en dev y la suscripción push (`enable()`) se quedaba colgada.
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo-icon.svg'],
      manifest: {
        name: 'Qleo',
        short_name: 'Qleo',
        description: 'Gestión colaborativa de tareas y proyectos',
        theme_color: '#2160E8',
        // QL-75: `background_color` pinta el splash de arranque de la PWA instalada. El
        // Web App Manifest es ESTÁTICO (se lee al instalar y no puede seguir el tema en
        // caliente), así que lo fijamos al `--surface` claro (#f8f9ff) para un splash
        // neutro que encaje con la app en vez del azul intenso anterior. Limitación del
        // estándar del Web App Manifest, no un bug.
        background_color: '#f8f9ff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})


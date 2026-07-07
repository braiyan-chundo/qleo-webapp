import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
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
        background_color: '#2160E8',
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


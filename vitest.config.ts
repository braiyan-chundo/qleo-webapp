import { defineConfig } from 'vitest/config'
import path from 'path'

// ADR-0004 · Pruebas de la web con vitest (las instala HU-0202). Config propia, sin los plugins
// de `vite.config.ts` (PWA): solo se prueba lógica pura, en Node.
//
// Zona horaria distinta de Bogotá a propósito (HU-0202, AC-12): la hora de los recordatorios no
// puede depender de la del dispositivo. Los procesos de prueba heredan esta variable.
process.env.TZ = 'Asia/Tokyo'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { queryClient } from '@/core/query/query-client'
import { RealtimeProvider } from '@/features/realtime/context/RealtimeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* QL-76: `enableSystem` + `defaultTheme="system"` → el tema sigue al SO por defecto,
        pero una elección explícita (Claro/Oscuro) gana y persiste. `disableTransitionOnChange`
        evita el parpadeo de transiciones CSS al alternar. El arranque pre-paint lo cubre el
        script inline de index.html (QL-75), que replica esta misma resolución. */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {/* QL-133: socket único `/realtime` a nivel de app (no de ruta: el dashboard y "Mis
            tareas" muestran datos de varios proyectos). Dentro del QueryClientProvider porque
            traduce los eventos a invalidaciones; se auto-gatea por sesión (sin token no conecta). */}
        <RealtimeProvider>
          <App />
        </RealtimeProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)

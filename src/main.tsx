import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { queryClient } from '@/core/query/query-client'

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
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)

---
name: react-routing-auth
description: >
  Cómo estructurar rutas y proteger vistas en qleo-webapp con react-router-dom v7:
  layouts anidados (AuthLayout / AppLayout), ProtectedRoute basado en el store de auth,
  y guards por rol (ADMIN/MEMBER de plataforma y roles por tarea). Usa esta habilidad al
  añadir rutas, layouts o control de acceso.
---

# Routing y Autenticación — react-router v7 (qleo-webapp)

## Estructura de rutas (`src/App.tsx`)
Rutas agrupadas por layout. Público bajo `AuthLayout`; privado bajo `ProtectedRoute` +
`AppLayout` (sidebar + topbar).

```tsx
<BrowserRouter>
  <Routes>
    <Route element={<AuthLayout />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        {/* nuevas rutas del MVP aquí */}
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

## ProtectedRoute (`shared/components/ProtectedRoute.tsx`)
Ya existe: si no hay sesión (`useAuthStore(...).isAuthenticated()`), redirige a `/login`;
si hay, renderiza `<Outlet />`. El fetch-client complementa: ante 401 hace logout global.

## Guard por rol de plataforma (ADMIN/MEMBER)
Para vistas solo-admin (usuarios, auditoría), crea un guard que lea el rol del store:
```tsx
export const RoleRoute = ({ role }: { role: 'ADMIN' | 'MEMBER' }) => {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
};
```
Úsalo anidando: `<Route element={<RoleRoute role="ADMIN" />}> ...admin... </Route>`.

## Roles por tarea (CREATOR/ASSIGNEE/COLLABORATOR/OBSERVER)
No son del token: dependen del vínculo usuario↔tarea que devuelve el backend por tarea
(ver `../INTEGRACION_FRONTEND.md`). No se resuelven con un guard de ruta, sino en la UI
del detalle de tarea: muestra/oculta acciones según el `taskRole` que traiga el endpoint.

## Navegación
- Enlaces con `NavLink` (estado activo) — ver `shared/components/AppSidebar.tsx`.
- Navegación programática con `useNavigate` (tras login, tras crear, etc.).
- Layouts: `AppLayout` (privado, sidebar+topbar) y `AuthLayout` (público, centrado).

## Convenciones
- Rutas en minúscula y en plural para colecciones (`/projects`, `/tasks`).
- Cada nueva página se registra bajo el layout correcto y, si aplica, en el `AppSidebar`.
- Mantén el árbol de rutas en `App.tsx` legible; si crece mucho, extrae a `app/routes`.

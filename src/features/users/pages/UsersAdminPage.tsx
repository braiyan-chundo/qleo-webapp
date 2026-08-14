import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, UserX } from 'lucide-react';

import {
  useQueryParamNumber,
  useQueryParamSearch,
  useQueryParamState,
} from '@/shared/hooks/use-query-param-state';
import {
  AvatarCell,
  DataCard,
  DataCardRow,
  DataTableCard,
  RoleBadge,
  StatusDot,
  TablePagination,
} from '@/shared/components/data-table';
import { BackButton } from '@/shared/components/BackButton';
import { USER_ROLES, USER_ROLE_LABEL, roleIsAtLeast } from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/store/auth.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useUsersList } from '../hooks/use-users';
import { birthdayLabel } from '../lib/birth-date';
import { UserFormDialog } from '../components/UserFormDialog';
import { DeactivateUserDialog } from '../components/DeactivateUserDialog';
import type { UserSummary } from '../services/users.service';

const PAGE_SIZE = 12;

const ALL = 'ALL';

interface UserRowActionsProps {
  user: UserSummary;
  /** `false` ⇒ el backend rechazaría la acción (403 `CANNOT_MANAGE_ADMIN`). */
  canManage: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  className?: string;
}

/**
 * Acciones de una fila de usuario (compartidas por la tabla de desktop y la tarjeta de móvil).
 *
 * (QL-195) Con `canManage` en `false` —Dirección mirando a un ADMIN— salen deshabilitadas con
 * el porqué en el `title`, en vez de dejar pulsar y devolver un toast de error. El backend
 * sigue siendo la autoridad: esto solo evita ofrecer lo que ya se sabe que va a fallar.
 */
function UserRowActions({
  user,
  canManage,
  onEdit,
  onDeactivate,
  className,
}: UserRowActionsProps) {
  const blockedHint = canManage
    ? undefined
    : 'Solo un Administrador del sistema puede gestionar a otro Administrador.';

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        disabled={!canManage}
        title={blockedHint}
        onClick={onEdit}
      >
        Editar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-error hover:bg-error-container hover:text-on-error-container"
        disabled={!canManage || user.status === 'INACTIVE'}
        title={blockedHint}
        onClick={onDeactivate}
      >
        Desactivar
      </Button>
    </div>
  );
}

/**
 * (QL-198, §3.70) Perfil de permisos de la fila. Un perfil **retirado** se marca: el usuario lo
 * conserva asignado pero no recibe sus permisos, y esconder esa diferencia haría creer que sigue
 * concediendo.
 */
function ProfileCell({ user }: { user: UserSummary }) {
  if (!user.profile) return <span className="text-on-surface-variant">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-on-surface">{user.profile.name}</span>
      {!user.profile.active && (
        <Badge variant="outline" className="text-on-surface-variant">
          Retirado
        </Badge>
      )}
    </span>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function UsersAdminPage() {
  const currentUserRole = useAuthStore((s) => s.user?.role);

  /**
   * (QL-195) ¿Puede el usuario en sesión gestionar a `target`? Es **≥, no >**: Dirección sí
   * gestiona a otra Dirección; lo único que no alcanza es un ADMIN (403 `CANNOT_MANAGE_ADMIN`).
   * Espeja `canGrantOrManageRole` del backend, que es la autoridad — aquí solo decidimos si se
   * pinta la acción, para no ofrecer un botón que va a fallar.
   */
  const canManageUser = (target: UserRole) => roleIsAtLeast(currentUserRole, target);

  // Filtros + paginación persistidos en la URL (params: `q`, `rol`, `estado`, `page`).
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('q', 350);
  const [role, setRole] = useQueryParamState<'ALL' | UserRole>('rol', 'ALL');
  const [status, setStatus] = useQueryParamState<'ALL' | 'ACTIVE' | 'INACTIVE'>(
    'estado',
    'ALL',
  );
  const [page, setPage] = useQueryParamNumber('page', 1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserSummary | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<UserSummary | null>(null);

  const debouncedSearch = committed;

  // Al cambiar un filtro, vuelve a la primera página. Se omite el primer render para no
  // pisar la `page` que venga en la URL al abrir/compartir el enlace.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
    // Intencionalmente reacciona solo a los filtros (no a `setPage`).
  }, [debouncedSearch, role, status]);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
      role: role === ALL ? undefined : role,
      status: status === ALL ? undefined : status,
    }),
    [page, debouncedSearch, role, status],
  );

  const { data, isLoading, isError, error, isFetching } = useUsersList(params);

  const users = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (user: UserSummary) => {
    setEditing(user);
    setFormOpen(true);
  };

  return (
    <div className="p-4 md:p-8">
      {/* Encabezado */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BackButton fallback={{ to: '/', label: 'Inicio' }} />
          <div>
            <h1 className="text-3xl font-bold text-on-surface">Usuarios</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Administra las cuentas del espacio: altas, roles de plataforma y estado.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="h-10">
          <Plus />
          Nuevo usuario
        </Button>
      </div>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-outline" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="h-10 border-outline-variant/50 bg-surface-container-low pl-9"
          />
        </div>

        <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los roles</SelectItem>
            {USER_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {USER_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof status)}
        >
          <SelectTrigger className="h-10 w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activos</SelectItem>
            <SelectItem value="INACTIVE">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudieron cargar los usuarios
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <UserX className="size-7" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface">
            Sin resultados
          </h2>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            No hay usuarios que coincidan con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <>
          <DataTableCard
            cards={users.map((user) => (
              <DataCard key={user.id}>
                <div className="flex items-start justify-between gap-3">
                  <AvatarCell
                    name={user.name}
                    subtitle={user.email}
                    avatarUrl={user.avatarUrl}
                    avatarDownloadUrl={user.avatarDownloadUrl}
                  />
                  <RoleBadge role={user.role} />
                </div>
                <DataCardRow label="Estado">
                  <StatusDot
                    tone={user.status === 'ACTIVE' ? 'success' : 'muted'}
                    label={user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  />
                </DataCardRow>
                <DataCardRow label="Cargo">{user.jobTitle || '—'}</DataCardRow>
                {/* (QL-198) Perfil de permisos asignado. */}
                <DataCardRow label="Perfil">
                  <ProfileCell user={user} />
                </DataCardRow>
                {/* (QL-193) `birthdayLabel` decide solo: fecha completa si el backend la
                    sirve (ADMIN), y si no, día y mes sin año. Nunca se deduce la edad. */}
                <DataCardRow label="Cumpleaños">
                  {birthdayLabel(user) ?? '—'}
                </DataCardRow>
                <DataCardRow label="Creado">
                  {formatDate(user.createdAt)}
                </DataCardRow>
                <UserRowActions
                  user={user}
                  canManage={canManageUser(user.role)}
                  onEdit={() => openEdit(user)}
                  onDeactivate={() => setDeactivating(user)}
                  className="flex justify-end gap-2 pt-1"
                />
              </DataCard>
            ))}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Cumpleaños</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <AvatarCell
                      name={user.name}
                      subtitle={user.email}
                      avatarUrl={user.avatarUrl}
                      avatarDownloadUrl={user.avatarDownloadUrl}
                    />
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusDot
                      tone={user.status === 'ACTIVE' ? 'success' : 'muted'}
                      label={user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    />
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {user.jobTitle || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-on-surface-variant">
                    <ProfileCell user={user} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-on-surface-variant">
                    {birthdayLabel(user) ?? '—'}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRowActions
                      user={user}
                      canManage={canManageUser(user.role)}
                      onEdit={() => openEdit(user)}
                      onDeactivate={() => setDeactivating(user)}
                      className="flex justify-end gap-2"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTableCard>

          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            itemLabel={total === 1 ? 'usuario' : 'usuarios'}
            disabled={isFetching}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}

      {/* Diálogos */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
      />
      <DeactivateUserDialog
        user={deactivating}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null);
        }}
      />
    </div>
  );
}

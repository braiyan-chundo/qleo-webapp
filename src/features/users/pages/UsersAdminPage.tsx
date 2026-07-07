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
import { UserFormDialog } from '../components/UserFormDialog';
import { DeactivateUserDialog } from '../components/DeactivateUserDialog';
import type { UserSummary } from '../services/users.service';

const PAGE_SIZE = 12;

const ALL = 'ALL';

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
  // Filtros + paginación persistidos en la URL (params: `q`, `rol`, `estado`, `page`).
  const { value: search, setValue: setSearch, committed } = useQueryParamSearch('q', 350);
  const [role, setRole] = useQueryParamState<'ALL' | 'ADMIN' | 'MEMBER'>('rol', 'ALL');
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
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Usuarios</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Administra las cuentas del espacio: altas, roles de plataforma y estado.
          </p>
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
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="MEMBER">Miembro</SelectItem>
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
                <DataCardRow label="Creado">
                  {formatDate(user.createdAt)}
                </DataCardRow>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(user)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error hover:bg-error-container hover:text-on-error-container"
                    disabled={user.status === 'INACTIVE'}
                    onClick={() => setDeactivating(user)}
                  >
                    Desactivar
                  </Button>
                </div>
              </DataCard>
            ))}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Cargo</TableHead>
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
                  <TableCell className="text-on-surface-variant">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(user)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-error hover:bg-error-container hover:text-on-error-container"
                        disabled={user.status === 'INACTIVE'}
                        onClick={() => setDeactivating(user)}
                      >
                        Desactivar
                      </Button>
                    </div>
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

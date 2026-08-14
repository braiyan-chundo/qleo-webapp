import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiError } from '@/core/api/fetch-client';
import { cn } from '@/lib/utils';

import {
  usePermissionCatalog,
  usePermissionLabels,
  usePermissionProfiles,
  useDeletePermissionProfile,
  useUpdatePermissionProfile,
} from '../hooks/use-permission-profiles';
import type { PermissionProfile } from '../services/permission-profiles.service';
import { PermissionProfileFormDialog } from './PermissionProfileFormDialog';

/** Texto de "N usuarios" sin repetir el ternario en cada sitio. */
function usersLabel(count: number): string {
  return count === 1 ? '1 usuario' : `${count} usuarios`;
}

/**
 * Gestión de **perfiles de permisos** (QL-198, §3.70). Contenido del tab "Perfiles" de
 * Configuración; todo el CRUD es de Dirección (`MANAGER`+).
 *
 * Un perfil agrupa permisos del catálogo que sirve el backend y se asigna a un usuario desde su
 * ficha (`PATCH /users/:id { profileId }`). La lista trae **también los retirados**
 * (`includeInactive`), porque retirar es un estado gestionable —y reversible— y no verlos dejaría
 * al administrador sin forma de reactivarlos.
 *
 * Las dos operaciones delicadas se explican en la propia UI en vez de en un tooltip:
 * - **Retirar revoca** (§3.70 §4): no archiva, corta el acceso a quien ya lo tenga.
 * - **Borrar en uso responde 409** (§3.70 §5): se ofrece "Retirar" como salida reversible y un
 *   camino a Usuarios para reasignar, en vez de un error seco.
 */
export function PermissionProfilesManager() {
  const {
    data: profiles,
    isLoading,
    isError,
    error,
  } = usePermissionProfiles({ includeInactive: true });
  // El catálogo se usa para traducir cada clave del perfil a su `label` real. Si aún no llegó,
  // los chips caen a la clave cruda: es preferible a esconder permisos concedidos.
  const { data: catalog } = usePermissionCatalog();
  const catalogByKey = usePermissionLabels(catalog);

  const updateProfile = useUpdatePermissionProfile();
  const deleteProfile = useDeletePermissionProfile();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PermissionProfile | null>(null);
  const [deleting, setDeleting] = useState<PermissionProfile | null>(null);
  const [retiring, setRetiring] = useState<PermissionProfile | null>(null);
  /** 409 `PERMISSION_PROFILE_IN_USE`: se muestra el `message` del backend (lleva el recuento). */
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (profile: PermissionProfile) => {
    setEditing(profile);
    setFormOpen(true);
  };

  /**
   * Cambia `active`. Reactivar es inocuo y va directo; **retirar** pasa antes por confirmación
   * porque revoca: el `usersCount` del diálogo es lo único que hace visible el alcance real.
   */
  const setActive = (profile: PermissionProfile, active: boolean) => {
    if (!active && profile.usersCount > 0) {
      setRetiring(profile);
      return;
    }
    applyActive(profile, active);
  };

  const applyActive = (profile: PermissionProfile, active: boolean) => {
    updateProfile.mutate(
      { id: profile.id, dto: { active } },
      {
        onSuccess: () => {
          setRetiring(null);
          toast.success(
            active
              ? `Perfil "${profile.name}" reactivado. Sus permisos vuelven a aplicarse.`
              : `Perfil "${profile.name}" retirado. Ya no concede sus permisos.`,
          );
        },
        onError: (err) => {
          setRetiring(null);
          toast.error(
            err instanceof Error ? err.message : 'No se pudo cambiar el estado del perfil.',
          );
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleting) return;
    const target = deleting;
    deleteProfile.mutate(target.id, {
      onSuccess: () => {
        setDeleting(null);
        toast.success(`Perfil "${target.name}" eliminado.`);
      },
      onError: (err) => {
        setDeleting(null);
        // (§3.70 §5) No hay cascada: el backend obliga a reasignar antes. El recuento viaja
        // dentro del `message`, así que se enseña tal cual junto a la salida reversible.
        if (err instanceof ApiError && err.code === 'PERMISSION_PROFILE_IN_USE') {
          setInUseMessage(err.message);
          return;
        }
        toast.error(err instanceof Error ? err.message : 'No se pudo eliminar el perfil.');
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Perfiles de permisos</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-on-surface-variant">
            Agrupa permisos en un perfil ("Coordinador", "Consultor"…) y asígnaselo a una persona
            desde su ficha en Usuarios. Cada persona tiene <strong>un solo perfil</strong>. El
            perfil <strong>suma</strong> a lo que ya concedan su rol y sus permisos individuales.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10">
          <Plus />
          Nuevo perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-error/20 bg-error-container px-6 py-10 text-center">
          <p className="text-sm font-medium text-on-error-container">
            No se pudieron cargar los perfiles de permisos
          </p>
          <p className="mt-1 text-xs text-on-error-container/80">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-6 py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-primary-container text-primary">
            <ShieldCheck className="size-7" />
          </div>
          <h3 className="text-lg font-semibold text-on-surface">Aún no hay perfiles</h3>
          <p className="mt-1 max-w-md text-sm text-on-surface-variant">
            Crea el primero para poder conceder permisos sin subir a nadie de rol.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {(profiles ?? []).map((profile) => (
            <li
              key={profile.id}
              className={cn(
                'rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-3',
                !profile.active && 'opacity-75',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-on-surface">{profile.name}</span>
                    {profile.active ? (
                      <Badge variant="outline" className="border-tertiary/40 text-tertiary">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-on-surface-variant">
                        Retirado
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant">
                      <Users className="size-3.5" aria-hidden />
                      {usersLabel(profile.usersCount)}
                    </span>
                  </div>
                  {profile.description && (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {profile.description}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.permissions.length === 0 ? (
                      <span className="text-xs text-on-surface-variant">
                        Sin permisos. No concede nada todavía.
                      </span>
                    ) : (
                      profile.permissions.map((key) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="border-outline-variant/60 font-normal text-on-surface-variant"
                          title={catalogByKey.get(key)?.description}
                        >
                          {catalogByKey.get(key)?.label ?? key}
                        </Badge>
                      ))
                    )}
                  </div>

                  {!profile.active && profile.usersCount > 0 && (
                    <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-container/40 px-2.5 py-1.5 text-xs text-on-warning-container">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Retirado: {usersLabel(profile.usersCount)} lo conserva asignado pero{' '}
                        <strong>no recibe</strong> sus permisos. Reactívalo para devolvérselos.
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <label className="mr-1 flex items-center gap-2 text-xs text-on-surface-variant">
                    <Switch
                      checked={profile.active}
                      disabled={updateProfile.isPending}
                      onCheckedChange={(next) => setActive(profile, next)}
                      aria-label={`${profile.active ? 'Retirar' : 'Reactivar'} ${profile.name}`}
                    />
                    {profile.active ? 'Activo' : 'Retirado'}
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-on-surface-variant"
                    onClick={() => openEdit(profile)}
                    aria-label={`Editar ${profile.name}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-on-surface-variant hover:text-error"
                    onClick={() => setDeleting(profile)}
                    aria-label={`Eliminar ${profile.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PermissionProfileFormDialog
        open={formOpen}
        profile={editing}
        onOpenChange={setFormOpen}
      />

      {/* Retirar: la confirmación existe porque REVOCA, no porque archive (§3.70 §4). */}
      <AlertDialog
        open={!!retiring}
        onOpenChange={(open) => {
          if (!open) setRetiring(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar el perfil quita permisos</AlertDialogTitle>
            <AlertDialogDescription>
              {retiring ? (
                <>
                  <span className="font-medium text-on-surface">{retiring.name}</span> dejará de
                  conceder sus permisos:{' '}
                  <span className="font-medium text-on-surface">
                    {usersLabel(retiring.usersCount)}
                  </span>{' '}
                  perderá lo que este perfil le daba, de inmediato. No es un archivado.
                  <br />
                  <br />
                  Conservan el perfil asignado, así que <strong>reactivarlo se lo devuelve</strong>
                  . Lo que cada persona tenga concedido por su rol o por sus permisos individuales
                  no se toca.
                </>
              ) : (
                ''
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateProfile.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (retiring) applyActive(retiring, false);
              }}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending && <Loader2 className="animate-spin" />}
              Retirar y quitar permisos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Borrar. Con usuarios asignados el backend responde 409; el diálogo lo anticipa. */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? deleting.usersCount > 0
                  ? `No se puede eliminar "${deleting.name}" mientras lo tengan asignado ${usersLabel(deleting.usersCount)}. Reasígnalos primero desde Usuarios, o retíralo (es reversible y no borra nada).`
                  : `Se eliminará el perfil "${deleting.name}". No lo tiene nadie asignado, así que nadie pierde permisos. Esta acción no se puede deshacer.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProfile.isPending}>Cancelar</AlertDialogCancel>
            {deleting && deleting.usersCount > 0 ? (
              <>
                <Button variant="outline" asChild>
                  <Link to="/admin">Ir a Usuarios</Link>
                </Button>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (deleting) setActive(deleting, false);
                  }}
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending && <Loader2 className="animate-spin" />}
                  Retirar en su lugar
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleteProfile.isPending}
              >
                {deleteProfile.isPending && <Loader2 className="animate-spin" />}
                Eliminar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/*
        Red de seguridad del 409: el `usersCount` de la lista puede estar obsoleto (alguien asignó
        el perfil desde otra sesión), así que el borrado se puede rechazar aunque el diálogo
        anterior lo diera por libre. Se muestra el `message` del backend —lleva el recuento real—
        y se lleva a reasignar, nunca a un error seco.
      */}
      <AlertDialog
        open={!!inUseMessage}
        onOpenChange={(open) => {
          if (!open) setInUseMessage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>El perfil está en uso</AlertDialogTitle>
            <AlertDialogDescription>{inUseMessage ?? ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendido</AlertDialogCancel>
            <Button asChild>
              <Link to="/admin">Ir a Usuarios</Link>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

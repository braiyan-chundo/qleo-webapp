import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/core/api/fetch-client';
import { cn } from '@/lib/utils';

import {
  useCreatePermissionProfile,
  usePermissionCatalog,
  useGroupedCatalog,
  useUpdatePermissionProfile,
} from '../hooks/use-permission-profiles';
import type { PermissionProfile } from '../services/permission-profiles.service';
import {
  permissionProfileFormSchema,
  type PermissionProfileFormValues,
} from '../schemas/permission-profile.schema';

interface PermissionProfileFormDialogProps {
  open: boolean;
  /** Perfil en edición; `null`/ausente = alta. */
  profile?: PermissionProfile | null;
  onOpenChange: (open: boolean) => void;
}

const emptyValues: PermissionProfileFormValues = {
  name: '',
  description: '',
  permissions: [],
  active: true,
};

/** Traduce los `error.code` del contrato (§3.70 §6) a mensajes accionables. */
function reportError(err: unknown) {
  if (err instanceof ApiError) {
    if (err.code === 'PERMISSION_PROFILE_NAME_TAKEN') {
      toast.error('Ya existe un perfil con ese nombre.');
      return;
    }
    if (err.code === 'PERMISSION_INVALID') {
      // No es un error del usuario: el front mandó una clave que no salió de `/catalog`.
      toast.error(
        'Uno de los permisos ya no existe en el catálogo. Recarga la página e inténtalo de nuevo.',
      );
      return;
    }
  }
  toast.error(err instanceof Error ? err.message : 'No se pudo guardar el perfil.');
}

/**
 * Alta/edición de un **perfil de permisos** (QL-198, §3.70). Solo Dirección.
 *
 * Las casillas se **renderizan desde `GET /permission-profiles/catalog`**, agrupadas por su
 * `group`, con el `label` y la `description` que manda el backend **tal cual**. Es deliberado y no
 * es pereza: en los permisos con alcance la `description` *es* donde vive ese alcance
 * (`TASK_DISCARD` = "únicamente en los proyectos donde el usuario es miembro"), así que reescribir
 * o recortar el copy haría creer a Dirección que concede más de lo que concede. El catálogo además
 * **crece**: una lista de casillas escrita a mano se queda coja en el siguiente permiso.
 *
 * Al guardar se manda **siempre `permissions` completo**: el `PATCH` reemplaza la lista entera, no
 * hace merge.
 */
export function PermissionProfileFormDialog({
  open,
  profile,
  onOpenChange,
}: PermissionProfileFormDialogProps) {
  const isEdit = !!profile;
  const { data: catalog, isLoading: catalogLoading } = usePermissionCatalog({
    enabled: open,
  });
  const groups = useGroupedCatalog(catalog);

  const createProfile = useCreatePermissionProfile();
  const updateProfile = useUpdatePermissionProfile();
  const isPending = createProfile.isPending || updateProfile.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PermissionProfileFormValues>({
    resolver: zodResolver(permissionProfileFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      profile
        ? {
            name: profile.name,
            description: profile.description ?? '',
            permissions: [...profile.permissions],
            active: profile.active,
          }
        : emptyValues,
    );
  }, [open, profile, reset]);

  const active = watch('active');
  const selected = watch('permissions');

  const onSubmit = (values: PermissionProfileFormValues) => {
    const name = values.name.trim();
    // '' se traduce a "sin descripción" en el backend, así que vale para limpiarla.
    const description = values.description?.trim() ?? '';

    if (isEdit && profile) {
      updateProfile.mutate(
        {
          id: profile.id,
          // `permissions` va completo: el PATCH reemplaza, no fusiona.
          dto: { name, description, permissions: values.permissions, active: values.active },
        },
        {
          onSuccess: () => {
            toast.success('Perfil actualizado.');
            onOpenChange(false);
          },
          onError: reportError,
        },
      );
      return;
    }

    createProfile.mutate(
      { name, description, permissions: values.permissions },
      {
        onSuccess: () => {
          toast.success('Perfil creado.');
          onOpenChange(false);
        },
        onError: reportError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar perfil' : 'Nuevo perfil de permisos'}</DialogTitle>
          <DialogDescription>
            Marca lo que este perfil concede. Los permisos <strong>se suman</strong> a los que la
            persona ya tenga por su rol o concedidos individualmente: asignar el perfil añade, y
            quitarlo solo retira lo que venía de él.
          </DialogDescription>
        </DialogHeader>

        <form id="permission-profile-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="profile-name" className="text-on-surface">
              Nombre <span className="text-error">*</span>
            </Label>
            <Input
              id="profile-name"
              placeholder="Ej. Coordinador"
              maxLength={60}
              className={cn('h-10', errors.name && 'border-error')}
              {...register('name')}
            />
            {errors.name && (
              <span className="text-xs font-medium text-error">{errors.name.message}</span>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="profile-description" className="text-on-surface">
              Descripción
            </Label>
            <Textarea
              id="profile-description"
              rows={2}
              maxLength={240}
              placeholder="Para qué sirve este perfil y a quién se le da."
              {...register('description')}
            />
          </div>

          {/* Casillas renderizadas DESDE el catálogo del backend, seccionadas por `group`. */}
          <Controller
            control={control}
            name="permissions"
            render={({ field }) => {
              const current = new Set(field.value);
              const toggle = (key: string, checked: boolean) => {
                const next = new Set(current);
                if (checked) next.add(key);
                else next.delete(key);
                // Se conserva el orden del catálogo para que el payload sea estable.
                field.onChange((catalog ?? []).map((i) => i.key).filter((k) => next.has(k)));
              };

              if (catalogLoading) {
                return (
                  <div className="grid gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 rounded-lg" />
                    ))}
                  </div>
                );
              }

              if (groups.length === 0) {
                return (
                  <p className="rounded-lg border border-outline-variant/50 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                    No se pudo cargar el catálogo de permisos. Guarda el perfil e inténtalo de
                    nuevo más tarde.
                  </p>
                );
              }

              return (
                <div className="grid gap-4">
                  {groups.map(({ group, items }) => (
                    <fieldset key={group} className="grid gap-2">
                      <legend className="mb-1 text-xs font-semibold tracking-wide text-on-surface-variant uppercase">
                        {group}
                      </legend>
                      <div className="grid gap-2">
                        {items.map((item) => (
                          <label
                            key={item.key}
                            htmlFor={`perm-${item.key}`}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                              current.has(item.key)
                                ? 'border-primary/40 bg-primary-container/25'
                                : 'border-outline-variant/50 bg-surface-container-low hover:bg-surface-container-high/50',
                            )}
                          >
                            <Checkbox
                              id={`perm-${item.key}`}
                              className="mt-0.5"
                              checked={current.has(item.key)}
                              disabled={isPending}
                              onCheckedChange={(value) => toggle(item.key, value === true)}
                            />
                            <span className="grid gap-0.5">
                              <span className="text-sm font-medium text-on-surface">
                                {item.label}
                              </span>
                              {/*
                                `description` del backend, íntegra. En los permisos ACOTADOS
                                (TASK_DISCARD) es donde vive el alcance: recortarla haría creer
                                que se concede más de lo que se concede.
                              */}
                              <span className="text-xs leading-snug text-on-surface-variant">
                                {item.description}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              );
            }}
          />

          {selected.length === 0 && !catalogLoading && (
            <p className="text-xs text-on-surface-variant">
              Sin ninguna casilla marcada el perfil es válido, pero no concede nada: solo etiqueta
              a la persona.
            </p>
          )}

          {/* Retirar/reactivar solo en edición (un perfil nace activo). */}
          {isEdit && (
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="grid gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium text-on-surface">Perfil activo</span>
                      <span className="text-xs text-on-surface-variant">
                        Retirado deja de ofrecerse para asignaciones nuevas.
                      </span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>

                  {/*
                    (§3.70 §4) Lo importante de retirar NO es que se oculte: es que REVOCA. Sin
                    decirlo con todas las letras, alguien apaga el interruptor creyendo que
                    archiva y deja a gente sin acceso (o peor: cree que cortó el acceso y no lo
                    cortó, si además tienen el permiso por otra vía).
                  */}
                  {!field.value && (
                    <p className="inline-flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning-container/40 px-2.5 py-2 text-xs text-on-warning-container">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Al guardar, este perfil <strong>dejará de conceder</strong> sus permisos a{' '}
                        {profile && profile.usersCount === 1
                          ? 'la persona que lo tiene'
                          : `las ${profile?.usersCount ?? 0} personas que lo tienen`}
                        . No es un archivado. Conservan la asignación, así que reactivarlo se los
                        devuelve.
                      </span>
                    </p>
                  )}
                </div>
              )}
            />
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="permission-profile-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? (active ? 'Guardar cambios' : 'Guardar y retirar') : 'Crear perfil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

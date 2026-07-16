import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/core/api/fetch-client';

import { useCreateUser, useUpdateUser } from '../hooks/use-users';
import {
  createUserSchema,
  updateUserSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from '../schemas/user.schema';
import type {
  CreateUserDto,
  UpdateUserDto,
  UserSummary,
} from '../services/users.service';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, el diálogo funciona en modo edición. */
  user?: UserSummary;
}

const createDefaults: CreateUserFormValues = {
  name: '',
  email: '',
  password: '',
  role: 'MEMBER',
  jobTitle: '',
  // QL-127: por defecto los miembros NO pueden crear proyectos.
  canCreateProjects: false,
};

interface CanCreateProjectsFieldProps {
  /** Valor real del flag en el formulario (el que se envía al backend). */
  value: boolean;
  onChange: (next: boolean) => void;
  /** Rol **seleccionado ahora mismo** en el formulario, no el guardado. */
  role: 'ADMIN' | 'MEMBER';
}

/**
 * Control del permiso de crear proyectos (QL-127). Compartido por el alta y la edición.
 *
 * Con rol ADMIN se fuerza a "marcado + deshabilitado": el flag no le aplica (un ADMIN
 * siempre puede) y mostrarlo apagado sería mentir. Solo se pinta el valor forzado; el valor
 * real del formulario no se toca, así que al volver a MEMBER reaparece tal cual estaba.
 */
function CanCreateProjectsField({ value, onChange, role }: CanCreateProjectsFieldProps) {
  const isAdmin = role === 'ADMIN';

  return (
    <div className="grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
      <label className="flex items-center gap-2.5 text-sm font-medium text-on-surface">
        <Switch
          checked={isAdmin || value}
          disabled={isAdmin}
          onCheckedChange={onChange}
        />
        Puede crear proyectos
      </label>
      <p className="text-xs text-on-surface-variant">
        {isAdmin
          ? 'Los administradores siempre pueden crear proyectos.'
          : 'Si está desactivado, solo trabajará en los proyectos a los que se le agregue.'}
      </p>
    </div>
  );
}

/** Traduce un fallo de la API a un toast (409 = email duplicado). */
function reportError(err: unknown) {
  if (err instanceof ApiError && err.status === 409) {
    toast.error('Ya existe un usuario con ese email.');
    return;
  }
  toast.error(err instanceof Error ? err.message : 'No se pudo guardar el usuario.');
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = !!user;
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: createDefaults,
  });

  const editForm = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'MEMBER',
      status: 'ACTIVE',
      jobTitle: '',
      password: '',
      canCreateProjects: false,
    },
  });

  // Rellena / reinicia el formulario al abrir o cambiar de usuario.
  useEffect(() => {
    if (!open) return;
    if (user) {
      editForm.reset({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        jobTitle: user.jobTitle ?? '',
        password: '',
        canCreateProjects: user.canCreateProjects ?? false,
      });
    } else {
      createForm.reset(createDefaults);
    }
    // Reiniciar solo cuando cambia el usuario objetivo o la apertura del diálogo.
  }, [open, user, createForm, editForm]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // QL-127: el control del permiso reacciona al rol elegido en vivo (no al guardado).
  const createRole = createForm.watch('role');
  const editRole = editForm.watch('role');

  const onCreate = (values: CreateUserFormValues) => {
    const dto: CreateUserDto = {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      role: values.role,
      jobTitle: values.jobTitle?.trim() || undefined,
      canCreateProjects: values.canCreateProjects,
    };
    createMutation.mutate(dto, {
      onSuccess: () => {
        toast.success('Usuario creado.');
        onOpenChange(false);
      },
      onError: reportError,
    });
  };

  const onUpdate = (values: UpdateUserFormValues) => {
    if (!user) return;
    const dto: UpdateUserDto = {
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role,
      status: values.status,
      jobTitle: values.jobTitle?.trim() || undefined,
      canCreateProjects: values.canCreateProjects,
      ...(values.password ? { password: values.password } : {}),
    };
    updateMutation.mutate(
      { id: user.id, dto },
      {
        onSuccess: () => {
          toast.success('Usuario actualizado.');
          onOpenChange(false);
        },
        onError: reportError,
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos, el rol de plataforma o el estado de la cuenta.'
              : 'Da de alta un usuario y define su rol de plataforma.'}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form
            id="user-form"
            onSubmit={editForm.handleSubmit(onUpdate)}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-on-surface">
                Nombre <span className="text-error">*</span>
              </Label>
              <Input id="name" className="h-10" {...editForm.register('name')} />
              {editForm.formState.errors.name && (
                <span className="text-xs font-medium text-error">
                  {editForm.formState.errors.name.message}
                </span>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-on-surface">
                Email <span className="text-error">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                className="h-10"
                {...editForm.register('email')}
              />
              {editForm.formState.errors.email && (
                <span className="text-xs font-medium text-error">
                  {editForm.formState.errors.email.message}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-on-surface">Rol</Label>
                <Controller
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Miembro</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-on-surface">Estado</Label>
                <Controller
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Activo</SelectItem>
                        <SelectItem value="INACTIVE">Inactivo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="jobTitle" className="text-on-surface">
                Cargo
              </Label>
              <Input
                id="jobTitle"
                className="h-10"
                placeholder="Coordinador de proyectos"
                {...editForm.register('jobTitle')}
              />
            </div>

            <Controller
              control={editForm.control}
              name="canCreateProjects"
              render={({ field }) => (
                <CanCreateProjectsField
                  value={!!field.value}
                  onChange={field.onChange}
                  role={editRole}
                />
              )}
            />

            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-on-surface">
                Nueva contraseña
              </Label>
              <Input
                id="password"
                type="password"
                className="h-10"
                placeholder="Dejar vacío para no cambiarla"
                autoComplete="new-password"
                {...editForm.register('password')}
              />
              {editForm.formState.errors.password && (
                <span className="text-xs font-medium text-error">
                  {editForm.formState.errors.password.message}
                </span>
              )}
            </div>
          </form>
        ) : (
          <form
            id="user-form"
            onSubmit={createForm.handleSubmit(onCreate)}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-on-surface">
                Nombre <span className="text-error">*</span>
              </Label>
              <Input id="name" className="h-10" {...createForm.register('name')} />
              {createForm.formState.errors.name && (
                <span className="text-xs font-medium text-error">
                  {createForm.formState.errors.name.message}
                </span>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-on-surface">
                Email <span className="text-error">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                className="h-10"
                {...createForm.register('email')}
              />
              {createForm.formState.errors.email && (
                <span className="text-xs font-medium text-error">
                  {createForm.formState.errors.email.message}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-on-surface">
                  Contraseña <span className="text-error">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  className="h-10"
                  autoComplete="new-password"
                  {...createForm.register('password')}
                />
                {createForm.formState.errors.password && (
                  <span className="text-xs font-medium text-error">
                    {createForm.formState.errors.password.message}
                  </span>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-on-surface">Rol</Label>
                <Controller
                  control={createForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Miembro</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="jobTitle" className="text-on-surface">
                Cargo
              </Label>
              <Input
                id="jobTitle"
                className="h-10"
                placeholder="Coordinador de proyectos"
                {...createForm.register('jobTitle')}
              />
            </div>

            <Controller
              control={createForm.control}
              name="canCreateProjects"
              render={({ field }) => (
                <CanCreateProjectsField
                  value={!!field.value}
                  onChange={field.onChange}
                  role={createRole}
                />
              )}
            />
          </form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

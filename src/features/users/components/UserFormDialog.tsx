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
};

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
      });
    } else {
      createForm.reset(createDefaults);
    }
    // Reiniciar solo cuando cambia el usuario objetivo o la apertura del diálogo.
  }, [open, user, createForm, editForm]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onCreate = (values: CreateUserFormValues) => {
    const dto: CreateUserDto = {
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      role: values.role,
      jobTitle: values.jobTitle?.trim() || undefined,
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
                placeholder="Coordinador de viajes"
                {...editForm.register('jobTitle')}
              />
            </div>

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
                placeholder="Coordinador de viajes"
                {...createForm.register('jobTitle')}
              />
            </div>
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

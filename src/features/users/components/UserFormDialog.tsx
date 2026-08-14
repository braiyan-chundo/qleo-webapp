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
import {
  USER_ROLES,
  USER_ROLE_LABEL,
  hasAtLeastRole,
  roleIsAtLeast,
} from '@/shared/lib/permissions';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/store/auth.store';

import { useCreateUser, useUpdateUser } from '../hooks/use-users';
import { birthDateErrorMessage } from '../lib/birth-date';
import { userRoleErrorMessage } from '../lib/user-role-errors';
import { BirthDateField } from './BirthDateField';
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
  // QL-193: sin fecha de nacimiento al alta (es opcional).
  birthDate: '',
  // QL-127: por defecto los miembros NO pueden crear proyectos.
  canCreateProjects: false,
  // QL-184: por defecto los miembros SÍ pueden usar la IA (default invertido).
  canUseAi: true,
};

interface CanCreateProjectsFieldProps {
  /** Valor real del flag en el formulario (el que se envía al backend). */
  value: boolean;
  onChange: (next: boolean) => void;
  /** Rol **seleccionado ahora mismo** en el formulario, no el guardado. */
  role: UserRole;
}

/**
 * Control del permiso de crear proyectos (QL-127). Compartido por el alta y la edición.
 *
 * Con rol ADMIN o **Dirección** se fuerza a "marcado + deshabilitado": el flag no les aplica
 * (los dos pueden siempre, QL-195) y mostrarlo apagado sería mentir. Solo se pinta el valor
 * forzado; el valor real del formulario no se toca, así que al volver a MEMBER reaparece tal
 * cual estaba.
 */
function CanCreateProjectsField({ value, onChange, role }: CanCreateProjectsFieldProps) {
  const bypasses = roleIsAtLeast(role, 'MANAGER');

  return (
    <div className="grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
      <label className="flex items-center gap-2.5 text-sm font-medium text-on-surface">
        <Switch
          checked={bypasses || value}
          disabled={bypasses}
          onCheckedChange={onChange}
        />
        Puede crear proyectos
      </label>
      <p className="text-xs text-on-surface-variant">
        {bypasses
          ? 'Administración y Dirección siempre pueden crear proyectos.'
          : 'Si está desactivado, solo trabajará en los proyectos a los que se le agregue.'}
      </p>
    </div>
  );
}

/**
 * Control del permiso de usar el panel de IA (QL-184). Compartido por el alta y la edición.
 *
 * Espejo de `CanCreateProjectsField` con el default invertido: el permiso viene **activado** y se
 * revoca explícitamente. Con rol ADMIN o Dirección se fuerza a "marcado + deshabilitado": el flag
 * no les aplica. Solo se pinta el valor forzado; el valor real del formulario no se toca, así que
 * al volver a MEMBER reaparece tal cual estaba.
 */
function CanUseAiField({ value, onChange, role }: CanCreateProjectsFieldProps) {
  const bypasses = roleIsAtLeast(role, 'MANAGER');

  return (
    <div className="grid gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
      <label className="flex items-center gap-2.5 text-sm font-medium text-on-surface">
        <Switch
          checked={bypasses || value}
          disabled={bypasses}
          onCheckedChange={onChange}
        />
        Puede usar la IA
      </label>
      <p className="text-xs text-on-surface-variant">
        {bypasses
          ? 'Administración y Dirección siempre pueden usar el panel de IA.'
          : 'Si está desactivado, no verá ni podrá usar el panel de IA.'}
      </p>
    </div>
  );
}

interface RoleSelectProps {
  value: UserRole;
  onChange: (next: UserRole) => void;
  /** Roles ofrecidos (QL-195: Dirección no puede conceder ADMIN). */
  options: UserRole[];
  /** Bloqueado porque el backend rechazaría el cambio (`CANNOT_CHANGE_OWN_ROLE`). */
  disabled?: boolean;
  /** Aviso bajo el selector cuando está bloqueado. */
  hint?: string;
}

/**
 * Selector del rol de plataforma. Las etiquetas salen de `USER_ROLE_LABEL` (QL-195), así que
 * `MANAGER` aparece como **«Dirección»**. Qué opciones se ofrecen lo decide el llamador.
 */
function RoleSelect({ value, onChange, options, disabled, hint }: RoleSelectProps) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-on-surface">Rol</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as UserRole)}
        disabled={disabled}
      >
        <SelectTrigger className="h-10 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((role) => (
            <SelectItem key={role} value={role}>
              {USER_ROLE_LABEL[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <span className="text-xs text-on-surface-variant">{hint}</span>}
    </div>
  );
}

/**
 * Traduce un fallo de la API a un toast. Orden: los 403 de rol (QL-195), el 409 de email
 * duplicado y los `error.code` de la fecha de nacimiento (QL-193).
 */
function reportError(err: unknown) {
  const roleMessage = userRoleErrorMessage(err);
  if (roleMessage) {
    toast.error(roleMessage);
    return;
  }
  if (err instanceof ApiError && err.status === 409) {
    toast.error('Ya existe un usuario con ese email.');
    return;
  }
  toast.error(birthDateErrorMessage(err, 'No se pudo guardar el usuario.'));
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const isEdit = !!user;
  const currentUser = useAuthStore((s) => s.user);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  /**
   * (QL-195) Qué roles puede conceder quien está editando. Dirección no ve la opción
   * «Administrador»: el backend responde 403 `ROLE_ESCALATION_FORBIDDEN` y es mejor no
   * ofrecerla que traducir el error.
   */
  const roleOptions: UserRole[] = hasAtLeastRole(currentUser, 'ADMIN')
    ? [...USER_ROLES]
    : USER_ROLES.filter((role) => role !== 'ADMIN');

  /**
   * (QL-195) Nadie cambia su **propio** rol, ni un ADMIN (403 `CANNOT_CHANGE_OWN_ROLE`). El
   * selector se bloquea, pero el valor se sigue enviando: reenviar el rol sin cambiarlo no
   * dispara el error, así que el resto del formulario funciona con normalidad.
   */
  const editingSelf = isEdit && !!currentUser && user.id === currentUser.id;

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
      birthDate: '',
      password: '',
      canCreateProjects: false,
      canUseAi: true,
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
        // (QL-193) `GET /users` es ruta del área de administración, así que `birthDate` llega
        // sin enmascarar y un `null` aquí sí significa "sin fecha".
        birthDate: user.birthDate ?? '',
        password: '',
        canCreateProjects: user.canCreateProjects ?? false,
        // QL-184: default activado; ausente en usuarios antiguos = con acceso.
        canUseAi: user.canUseAi ?? true,
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
      // (QL-193) Día civil literal, ya en `'YYYY-MM-DD'`. Sin fecha → se omite el campo.
      birthDate: values.birthDate?.trim() || undefined,
      canCreateProjects: values.canCreateProjects,
      canUseAi: values.canUseAi,
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
      // (QL-193) Día civil literal; `null` explícito para **borrar** la fecha guardada.
      birthDate: values.birthDate?.trim() || null,
      canCreateProjects: values.canCreateProjects,
      canUseAi: values.canUseAi,
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
              <Controller
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    value={field.value}
                    onChange={field.onChange}
                    /* El rol actual siempre está en la lista aunque no se pueda conceder:
                       si no, editar a un ADMIN dejaría el selector en blanco. */
                    options={
                      roleOptions.includes(field.value)
                        ? roleOptions
                        : [field.value, ...roleOptions]
                    }
                    disabled={editingSelf}
                    hint={
                      editingSelf
                        ? 'Nadie puede cambiar su propio rol. Tiene que hacerlo otra persona.'
                        : undefined
                    }
                  />
                )}
              />
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

            {/* (QL-193, §3.66) Fecha de nacimiento: solo el propio usuario y quien administra
                (ADMIN o Dirección, QL-195) pueden editarla y ver el año. */}
            <Controller
              control={editForm.control}
              name="birthDate"
              render={({ field }) => (
                <BirthDateField
                  id="edit-birthDate"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  disabled={isPending}
                  hint="Marca su cumpleaños en el calendario del equipo. Solo tú y esa persona veis el año."
                />
              )}
            />

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

            <Controller
              control={editForm.control}
              name="canUseAi"
              render={({ field }) => (
                <CanUseAiField
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
              <Controller
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={roleOptions}
                  />
                )}
              />
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

            {/* (QL-193, §3.66) Opcional al alta; el usuario puede fijarla luego desde su perfil. */}
            <Controller
              control={createForm.control}
              name="birthDate"
              render={({ field }) => (
                <BirthDateField
                  id="create-birthDate"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  disabled={isPending}
                  hint="Opcional. Marca su cumpleaños en el calendario del equipo."
                />
              )}
            />

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

            <Controller
              control={createForm.control}
              name="canUseAi"
              render={({ field }) => (
                <CanUseAiField
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

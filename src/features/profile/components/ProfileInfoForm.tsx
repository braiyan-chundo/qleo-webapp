import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { AvatarUploader } from './AvatarUploader';
import { useUpdateProfile } from '../hooks/use-profile';
import {
  profileFormSchema,
  type ProfileFormValues,
} from '../schemas/profile.schema';
import type { UpdateMePayload } from '../services/profile.service';
import type { User } from '@/store/auth.store';

interface ProfileInfoFormProps {
  user: User;
}

/** Convierte los valores del formulario al payload; envía cadenas vacías como `''` (trim). */
function toPayload(values: ProfileFormValues): UpdateMePayload {
  return {
    name: values.name.trim(),
    jobTitle: values.jobTitle?.trim() ?? '',
    avatarUrl: values.avatarUrl?.trim() ?? '',
  };
}

/**
 * Formulario de datos del perfil (`PATCH /users/me`). Precarga con el usuario actual y
 * al guardar invalida el caché de perfil/sesión (lo hace `useUpdateProfile`).
 */
export function ProfileInfoForm({ user }: ProfileInfoFormProps) {
  const updateMutation = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      avatarUrl: user.avatarUrl ?? '',
    },
  });

  // Resincroniza si el usuario cambia (p. ej. tras refetch).
  useEffect(() => {
    reset({
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      avatarUrl: user.avatarUrl ?? '',
    });
  }, [user, reset]);

  const onSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(toPayload(values), {
      onSuccess: () => toast.success('Perfil actualizado.'),
      onError: (err) =>
        toast.error(
          err instanceof Error ? err.message : 'No se pudo guardar el perfil.',
        ),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
      {/* Foto de perfil (QL-32): subir/quitar el avatar. Mutación inmediata, fuera del form. */}
      <AvatarUploader user={user} />

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-on-surface">
          {user.email}
        </p>
        <p className="text-xs text-on-surface-variant">
          El correo y el rol solo los cambia un administrador.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="name" className="text-on-surface">
          Nombre <span className="text-error">*</span>
        </Label>
        <Input
          id="name"
          className="h-10"
          placeholder="Tu nombre"
          {...register('name')}
        />
        {errors.name && (
          <span className="text-xs font-medium text-error">
            {errors.name.message}
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="jobTitle" className="text-on-surface">
          Cargo
        </Label>
        <Input
          id="jobTitle"
          className="h-10"
          placeholder="Coordinador de proyectos"
          {...register('jobTitle')}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="avatarUrl" className="text-on-surface">
          URL del avatar (alternativa)
        </Label>
        <Input
          id="avatarUrl"
          className="h-10"
          placeholder="https://…/foto.jpg"
          {...register('avatarUrl')}
        />
        <span className="text-xs text-on-surface-variant">
          Fallback externo: solo se usa si no has subido una foto arriba.
        </span>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

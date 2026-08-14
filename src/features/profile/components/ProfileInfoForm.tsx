import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BirthDateField } from '@/features/users/components/BirthDateField';
import { birthDateErrorMessage } from '@/features/users/lib/birth-date';

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

/**
 * Convierte los valores del formulario al payload; envía cadenas vacías como `''` (trim).
 *
 * (QL-193) `birthDate` viaja **tal cual está en el formulario** —ya es el día civil
 * `'YYYY-MM-DD'` que eligió el usuario— y `null` cuando se borró. Aquí no se construye ningún
 * `Date` ni se llama a `toISOString()`: ese es justo el camino que en UTC-5 guarda el día
 * anterior (§3.66).
 */
function toPayload(values: ProfileFormValues): UpdateMePayload {
  return {
    name: values.name.trim(),
    jobTitle: values.jobTitle?.trim() ?? '',
    avatarUrl: values.avatarUrl?.trim() ?? '',
    birthDate: values.birthDate?.trim() || null,
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
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      avatarUrl: user.avatarUrl ?? '',
      birthDate: user.birthDate ?? '',
    },
  });

  // Resincroniza si el usuario cambia (p. ej. tras refetch).
  useEffect(() => {
    reset({
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      avatarUrl: user.avatarUrl ?? '',
      // (QL-193) En el perfil propio el backend nunca enmascara `birthDate`, así que un `null`
      // aquí sí significa "no tengo fecha" → campo vacío.
      birthDate: user.birthDate ?? '',
    });
  }, [user, reset]);

  const onSubmit = (values: ProfileFormValues) => {
    updateMutation.mutate(toPayload(values), {
      onSuccess: () => toast.success('Perfil actualizado.'),
      onError: (err) =>
        toast.error(birthDateErrorMessage(err, 'No se pudo guardar el perfil.')),
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
          El correo y el rol solo los cambia Administración o Dirección.
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

      {/* (QL-193, §3.66) Fecha de nacimiento: solo la edita su dueño o un ADMIN. Al resto de
          la plataforma únicamente se le muestra el día y el mes, nunca el año. */}
      <Controller
        control={control}
        name="birthDate"
        render={({ field }) => (
          <BirthDateField
            id="birthDate"
            value={field.value ?? ''}
            onChange={field.onChange}
            disabled={updateMutation.isPending}
            hint="Solo tú y quien administra la plataforma veis el año. En el calendario del equipo se marca el día, sin la edad."
          />
        )}
      />

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

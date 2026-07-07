import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/core/api/fetch-client';

import { useChangePassword } from '../hooks/use-profile';
import {
  passwordFormSchema,
  type PasswordFormValues,
} from '../schemas/profile.schema';

/**
 * Formulario de cambio de contraseña (`PATCH /users/me/password`). Si el backend responde
 * `INVALID_CURRENT_PASSWORD` (400), se marca el campo "contraseña actual"; se distingue de
 * un 401 (sesión caducada, que el fetch-client ya redirige al login).
 */
export function ChangePasswordForm() {
  const changeMutation = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: PasswordFormValues) => {
    changeMutation.mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          toast.success('Contraseña actualizada.');
          reset();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
            setError('currentPassword', {
              message: 'La contraseña actual no es correcta.',
            });
            return;
          }
          toast.error(
            err instanceof Error
              ? err.message
              : 'No se pudo cambiar la contraseña.',
          );
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword" className="text-on-surface">
          Contraseña actual <span className="text-error">*</span>
        </Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className="h-10"
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <span className="text-xs font-medium text-error">
            {errors.currentPassword.message}
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="newPassword" className="text-on-surface">
          Nueva contraseña <span className="text-error">*</span>
        </Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className="h-10"
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <span className="text-xs font-medium text-error">
            {errors.newPassword.message}
          </span>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword" className="text-on-surface">
          Confirmar nueva contraseña <span className="text-error">*</span>
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="h-10"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <span className="text-xs font-medium text-error">
            {errors.confirmPassword.message}
          </span>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={changeMutation.isPending}>
          {changeMutation.isPending && <Loader2 className="animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </form>
  );
}

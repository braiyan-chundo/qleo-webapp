import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useUpdateAppSettings } from '../hooks/use-settings';
import { DEFAULT_SUPPORT_EMAIL } from '../services/settings.service';
import {
  supportEmailSchema,
  type SupportEmailFormValues,
} from '../schemas/settings.schema';

interface SupportEmailFormProps {
  /** Correo que se está mostrando ahora (siembra el campo). */
  currentEmail: string;
  /** Cierra la edición: se llama al guardar con éxito y al cancelar. */
  onDone: () => void;
}

/**
 * Edición inline del correo de soporte (QL-129), **solo para ADMIN** (el consumidor decide
 * si renderizarla; el backend valida igual con 403).
 *
 * Vive en el feature `settings` porque es quien posee el dato, aunque se renderice desde
 * Ayuda › Soporte: es el único sitio donde el correo se consume, así que el ADMIN edita
 * justo lo que ve. El toast de éxito/error lo emite `useUpdateAppSettings`.
 */
export function SupportEmailForm({ currentEmail, onDone }: SupportEmailFormProps) {
  const updateSettings = useUpdateAppSettings();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupportEmailFormValues>({
    resolver: zodResolver(supportEmailSchema),
    defaultValues: { supportEmail: currentEmail },
  });

  const onSubmit = handleSubmit((values) => {
    updateSettings.mutate(
      { supportEmail: values.supportEmail },
      { onSuccess: () => onDone() },
    );
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-1.5 sm:max-w-sm">
      <Label htmlFor="supportEmail" className="text-on-surface">
        Correo de soporte
      </Label>
      <Input
        id="supportEmail"
        type="email"
        className="h-10"
        autoComplete="off"
        placeholder={DEFAULT_SUPPORT_EMAIL}
        {...register('supportEmail')}
      />
      {errors.supportEmail && (
        <span className="text-xs font-medium text-error">
          {errors.supportEmail.message}
        </span>
      )}
      <p className="text-xs text-on-surface-variant">
        Es la dirección que ve todo el equipo en esta sección.
      </p>
      <div className="mt-1 flex gap-2">
        <Button type="submit" disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="size-4 animate-spin" />}
          Guardar
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onDone}
          disabled={updateSettings.isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

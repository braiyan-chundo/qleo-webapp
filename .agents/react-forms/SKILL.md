---
name: react-forms
description: >
  Cómo construir formularios en qleo-webapp con react-hook-form + zod: schema,
  zodResolver, registro de campos, mensajes de error, y submit conectado a una mutación
  de TanStack Query. Usa esta habilidad al crear cualquier formulario (login, crear
  proyecto, crear tarea, etc.).
---

# Formularios — react-hook-form + zod (qleo-webapp)

## Patrón estándar
1. **Schema zod** (en `features/<f>/schemas/`), tipo inferido con `z.infer`.
2. `useForm` con `zodResolver` y `defaultValues`.
3. Campos con `{...form.register('campo')}` sobre `@/components/ui/input`.
4. Errores desde `form.formState.errors`.
5. `onSubmit` llama a una **mutación** (no async/try-catch manual). El estado de carga y
   error de red viene de la mutación, no de `useState`.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCreateProject } from '../hooks/use-projects';

const schema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  destination: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ProjectForm() {
  const createProject = useCreateProject();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', destination: '' },
  });

  const onSubmit = (values: Values) => createProject.mutate(values);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-on-surface">Nombre</Label>
        <Input id="name" {...form.register('name')} />
        {form.formState.errors.name && (
          <span className="text-xs text-error">{form.formState.errors.name.message}</span>
        )}
      </div>

      <Button type="submit" disabled={createProject.isPending}>
        {createProject.isPending ? 'Guardando…' : 'Crear proyecto'}
      </Button>

      {createProject.error instanceof Error && (
        <p className="text-sm text-error">{createProject.error.message}</p>
      )}
    </form>
  );
}
```

## Reglas
- Mensajes de validación **en español**, definidos en el schema zod.
- Un schema por formulario, colocado en `schemas/` del feature; exporta el tipo inferido.
- No dupliques la validación del backend, pero valida lo esencial en cliente (UX).
- El estado de red (`isPending`, `error`) sale de la **mutación**, no de `useState`.
- Reutiliza `@/components/ui/*` (Input, Label, Button, Select...) y tokens Material 3.
- Para selects/switches usa el componente shadcn correspondiente, no `<select>` crudo.

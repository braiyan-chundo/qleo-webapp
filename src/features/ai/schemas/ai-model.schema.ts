import { z } from 'zod';

/**
 * Charset del identificador de modelo (QL-194, §3.67): alfanumérico inicial y después letras,
 * dígitos, `.`, `-`, `_`, `:`. Espeja la validación del backend para dar el error en el campo en
 * vez de gastar un 400 (el backend valida igual: esto es cortesía, no confianza).
 */
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** Formulario de "añadir modelo al listado" (`POST /ai/config/models`). */
export const addAiModelSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1, 'Escribe el identificador del modelo.')
    .max(64, 'El identificador no puede superar los 64 caracteres.')
    .regex(
      MODEL_ID_PATTERN,
      'Solo letras, dígitos y . - _ : y debe empezar por letra o dígito.',
    ),
});

export type AddAiModelFormValues = z.infer<typeof addAiModelSchema>;

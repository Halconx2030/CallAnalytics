import { z } from 'zod';

import { paginaSchema, uuidSchema } from './comunes.js';

/** Cuerpo para crear un formato (`RF-FMT-1.1`). */
export const crearFormatoBodySchema = z.object({
  nombre: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
});

/** Cuerpo para renombrar un formato (`RF-FMT-1.3`). */
export const actualizarFormatoBodySchema = crearFormatoBodySchema;

/** Parámetros de ruta con el id del formato. */
export const formatoParamsSchema = z.object({
  id: uuidSchema,
});

/** Representación de un formato. */
export const formatoResponseSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** Respuesta paginada de formatos. */
export const formatoPaginaSchema = paginaSchema(formatoResponseSchema);

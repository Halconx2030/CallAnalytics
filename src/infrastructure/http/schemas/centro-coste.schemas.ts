import { z } from 'zod';

import { paginaSchema, uuidSchema } from './comunes.js';

/** Cuerpo para crear un centro de coste (`RF-CC-1.1`). */
export const crearCentroCosteBodySchema = z.object({
  codigo: z
    .string({ error: 'El código es obligatorio' })
    .trim()
    .min(1, 'El código es obligatorio')
    .max(50, 'El código no puede superar los 50 caracteres'),
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(200, 'El nombre no puede superar los 200 caracteres'),
  formato_id: uuidSchema,
});

/** Cuerpo para actualizar un centro de coste (`RF-CC-1.4`): el código es inmutable. */
export const actualizarCentroCosteBodySchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200).optional(),
  formato_id: uuidSchema.optional(),
});

/** Parámetros de ruta con el id del centro de coste. */
export const centroCosteParamsSchema = z.object({
  id: uuidSchema,
});

/** Filtros y paginación del listado de centros de coste (`RF-CC-1.6`). */
export const centroCosteQuerySchema = z.object({
  codigo: z.string().trim().min(1).optional(),
  nombre: z.string().trim().min(1).optional(),
  formato_id: uuidSchema.optional(),
  /**
   * Búsqueda libre por código o nombre (case-insensitive).
   *
   * La usa el buscador (combobox) de la UI, que con cientos de centros de coste
   * no puede cargar el listado completo en el cliente.
   */
  busqueda: z.string().trim().max(100).optional(),
  after_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Representación de un centro de coste. */
export const centroCosteResponseSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  formato_id: z.string(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** Respuesta paginada de centros de coste. */
export const centroCostePaginaSchema = paginaSchema(centroCosteResponseSchema);

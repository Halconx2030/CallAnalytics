import { z } from 'zod';

/**
 * Schemas Zod compartidos por los endpoints de TELEFONO 2.
 *
 * Convención de la API HTTP: **snake_case** en peticiones y respuestas (igual que las cabeceras
 * de los archivos de importación y que la regla `after_id` de la constitución).
 */

/** Identificador de recurso (UUID). */
export const uuidSchema = z.string().uuid('Debe ser un UUID válido');

/** Paginación por cursor (`RF-LIN-1.9`, constitución regla 11). */
export const paginacionQuerySchema = z.object({
  /** Cursor opaco devuelto en la página anterior. */
  after_id: z.string().min(1).optional(),
  /** Cantidad de elementos por página (20 por defecto). */
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Formato de salida de las exportaciones (`RF-LIN-EXP-1.1`). */
export const formatoExportacionQuerySchema = z.object({
  /** `csv` (por defecto) o `xlsx`. */
  format: z.enum(['csv', 'xlsx']).default('csv'),
});

/**
 * Booleano en query string.
 *
 * No se usa `z.coerce.boolean()` porque interpreta cualquier texto no vacío como `true`
 * (el valor `"false"` se convertiría en `true`).
 */
export const booleanoQuerySchema = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((valor) => valor === 'true' || valor === '1');

/** Detalle de un error de validación dentro de la respuesta RFC 7807. */
export const detalleErrorSchema = z.object({
  /** Campo cuestionado, si aplica. */
  campo: z.string().optional(),
  /** Mensaje legible para el usuario. */
  mensaje: z.string(),
});

/** Respuesta de error en formato RFC 7807 (constitución regla 14). */
export const errorRfc7807Schema = z.object({
  /** URI que identifica el tipo de error. */
  type: z.string(),
  /** Resumen corto del error. */
  title: z.string(),
  /** Código de estado HTTP. */
  status: z.number().int(),
  /** Explicación concreta del error. */
  detail: z.string(),
  /** Ruta donde ocurrió el error. */
  instance: z.string(),
  /** Errores de validación por campo (opcional). */
  errors: z.array(detalleErrorSchema).optional(),
});

/** Error de validación de Fastify (ajustado al formato RFC 7807). */
export const errorValidacionSchema = errorRfc7807Schema.extend({
  errors: z.array(detalleErrorSchema),
});

/** Paginación de la respuesta de listados. */
export function paginaSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    /** Elementos de la página actual. */
    items: z.array(item),
    /** Cursor para la página siguiente (`null` si no hay más). */
    next_cursor: z.string().nullable(),
    /** Indica si existe una página siguiente. */
    has_next_page: z.boolean(),
  });
}

import { z } from 'zod';

import { formatoExportacionQuerySchema, paginaSchema, uuidSchema } from './comunes.js';

/** Estados válidos de una línea (constitución, regla 2). */
export const estadoLineaSchema = z.enum(['activa', 'baja', 'pendiente', 'portabilidad']);

/** Tipos de línea (móvil o fijo). */
export const tipoLineaSchema = z.enum(['movil', 'fijo']);

/** Tipos de uso (extensibles vía migración, constitución regla 9). */
export const tipoUsoSchema = z.enum(['personal', 'geovictoria']);

/** Costo mensual: se acepta número o texto decimal. */
const costoMensualSchema = z.union([z.number(), z.string()]);

/** Fecha en formato `YYYY-MM-DD`. */
const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD');

/** Cuerpo para crear una línea (`RF-LIN-1.1`). */
export const crearLineaBodySchema = z.object({
  numero: z
    .string({ required_error: 'El número es obligatorio' })
    .trim()
    .min(1, 'El número es obligatorio')
    .max(50, 'El número no puede superar los 50 caracteres'),
  numero_original: z.string().trim().min(1).max(50).optional(),
  proveedor: z.string().trim().max(100).optional(),
  centro_coste_id: uuidSchema,
  fecha_asignacion: fechaSchema.optional(),
  costo_mensual: costoMensualSchema.optional(),
  tipo_linea: tipoLineaSchema.optional(),
  empleado: z.string().trim().max(255).nullable().optional(),
  estado: estadoLineaSchema.optional(),
  tipo_uso: tipoUsoSchema.optional(),
});

/** Cuerpo para actualizar una línea (`RF-LIN-1.5`): `numero` e `id` son inmutables. */
export const actualizarLineaBodySchema = z.object({
  numero_original: z.string().trim().min(1).max(50).optional(),
  proveedor: z.string().trim().max(100).optional(),
  centro_coste_id: uuidSchema.optional(),
  fecha_asignacion: fechaSchema.optional(),
  costo_mensual: costoMensualSchema.optional(),
  tipo_linea: tipoLineaSchema.optional(),
  empleado: z.string().trim().max(255).nullable().optional(),
  estado: estadoLineaSchema.optional(),
  tipo_uso: tipoUsoSchema.optional(),
});

/** Cuerpo para cambiar el estado de una línea (`RF-LIN-1.6`). */
export const cambiarEstadoLineaBodySchema = z.object({
  estado: estadoLineaSchema,
});

/** Cuerpo para el cambio de estado masivo (`RF-LIN-1.7`). */
export const cambiarEstadoMasivoBodySchema = z.object({
  ids: z.array(uuidSchema).min(1, 'Debe indicar al menos una línea'),
  estado: estadoLineaSchema,
});

/** Parámetros de ruta con el id de la línea. */
export const lineaParamsSchema = z.object({
  id: uuidSchema,
});

/** Los 14 filtros del listado de líneas (`RF-LIN-1.9`) más orden y paginación. */
export const lineaQuerySchema = z.object({
  numero: z.string().trim().min(1).optional(),
  proveedor: z.string().trim().min(1).optional(),
  centro_coste_id: uuidSchema.optional(),
  centro_coste_codigo: z.string().trim().min(1).optional(),
  centro_coste_nombre: z.string().trim().min(1).optional(),
  /**
   * Búsqueda libre por código **o** nombre del centro de coste.
   *
   * Devuelve las líneas de **todos** los centros de coste que contienen ese texto
   * (semántica OR). Lo usa el buscador de la UI en modo "todos los que coincidan".
   */
  centro_coste_busqueda: z.string().trim().max(100).optional(),
  fecha_asignacion: fechaSchema.optional(),
  fecha_desde: fechaSchema.optional(),
  fecha_hasta: fechaSchema.optional(),
  costo_min: z.coerce.number().min(0).optional(),
  costo_max: z.coerce.number().min(0).optional(),
  tipo_linea: tipoLineaSchema.optional(),
  empleado: z.string().trim().min(1).optional(),
  estado: estadoLineaSchema.optional(),
  tipo_uso: tipoUsoSchema.optional(),
  /** Columna de ordenamiento: el conjunto cerrado de RF-ORD-1.2 (`empleado` queda fuera, Q4). */
  sort: z
    .enum([
      'numero',
      'proveedor',
      'centro_coste_codigo',
      'fecha_asignacion',
      'costo_mensual',
      'tipo_linea',
      'estado',
      'tipo_uso',
      'created_at',
    ])
    .optional(),
  /** Dirección del ordenamiento. */
  order: z.enum(['asc', 'desc']).optional(),
  after_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Representación de una línea telefónica. */
export const lineaResponseSchema = z.object({
  id: z.string(),
  numero: z.string(),
  numero_original: z.string(),
  proveedor: z.string(),
  centro_coste_id: z.string(),
  centro_coste_codigo: z.string().optional(),
  centro_coste_nombre: z.string().optional(),
  fecha_asignacion: z.string(),
  costo_mensual: z.string(),
  tipo_linea: z.string(),
  empleado: z.string().nullable(),
  estado: z.string(),
  tipo_uso: z.string(),
  version: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
  deleted_at: z.string().nullable(),
});

/** Respuesta paginada de líneas. */
export const lineaPaginaSchema = paginaSchema(lineaResponseSchema);

/**
 * Query de exportación de líneas: los 14 filtros más el formato y la inclusión de bajas.
 *
 * `incluir_bajas` se parsea con una unión de literales porque `z.coerce.boolean()`
 * interpretaría el texto `"false"` como `true`.
 */
export const lineaExportQuerySchema = lineaQuerySchema.merge(formatoExportacionQuerySchema).extend({
  incluir_bajas: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((valor) => valor === 'true' || valor === '1'),
});

/** Resultado de un cambio de estado masivo (`RF-LIN-1.7`). */
export const cambioEstadoMasivoResponseSchema = z.object({
  actualizadas: z.number().int(),
  ignoradas: z.number().int(),
  fallidas: z.number().int(),
});

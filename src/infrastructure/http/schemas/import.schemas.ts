import { z } from 'zod';

/** Tipo de plantilla descargable desde el módulo de importación (`RF-UI-IMP-1.4`). */
export const tipoPlantillaSchema = z.enum(['centros-coste', 'lineas']);

/** Parámetros de la plantilla a descargar. */
export const plantillaQuerySchema = z.object({
  tipo: tipoPlantillaSchema.default('lineas'),
});

/** Error de una fila en la importación de centros de coste (`RF-CC-IMP-1.4`). */
export const errorImportacionCentroSchema = z.object({
  fila: z.number().int(),
  codigo: z.string(),
  motivo: z.string(),
});

/** Error de una fila en la importación de líneas (`RF-LIN-IMP-1.8`). */
export const errorImportacionLineaSchema = z.object({
  fila: z.number().int(),
  numero: z.string(),
  motivo: z.string(),
});

/** Duplicado detectado en la importación de líneas (`RF-LIN-IMP-1.3`). */
export const duplicadoImportacionLineaSchema = z.object({
  fila: z.number().int(),
  numero: z.string(),
  motivo: z.string(),
});

/** Reporte de la importación de centros de coste (todo-o-nada). */
export const reporteImportacionCentrosSchema = z.object({
  insertados: z.number().int(),
  duplicados: z.number().int(),
  errores: z.array(errorImportacionCentroSchema),
  /** Formatos creados durante la importación (vacío si no se creó ninguno). */
  formatos_creados: z.array(z.string()),
});

/** Reporte de la importación de líneas. */
export const reporteImportacionLineasSchema = z.object({
  insertados: z.number().int(),
  duplicados: z.array(duplicadoImportacionLineaSchema),
  errores: z.array(errorImportacionLineaSchema),
});

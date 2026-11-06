import * as XLSX from 'xlsx';

/**
 * Generación de archivos de exportación (CSV/Excel) y de las plantillas de importación.
 */

/** Formatos de archivo soportados en las exportaciones. */
export type FormatoArchivo = 'csv' | 'xlsx';

/** Archivo generado por una exportación, listo para enviarse en la respuesta. */
export interface ArchivoExportado {
  /** Contenido binario del archivo. */
  readonly contenido: Buffer;
  /** Nombre sugerido para la descarga. */
  readonly nombreArchivo: string;
  /** `Content-Type` del archivo. */
  readonly contentType: string;
}

/** Marca de tiempo `YYYYMMDD_HHMMSS` usada en los nombres de archivo (`RF-LIN-EXP-1.4`). */
export function marcaTiempo(fecha: Date = new Date()): string {
  const dos = (valor: number): string => String(valor).padStart(2, '0');

  const yyyy = fecha.getFullYear();
  const mm = dos(fecha.getMonth() + 1);
  const dd = dos(fecha.getDate());
  const hh = dos(fecha.getHours());
  const mm2 = dos(fecha.getMinutes());
  const ss = dos(fecha.getSeconds());

  return `${yyyy}${mm}${dd}_${hh}${mm2}${ss}`;
}

/** Nombre del archivo de exportación, por ejemplo `lineas_20261104_101530.csv`. */
export function nombreArchivoExport(
  prefijo: string,
  formato: FormatoArchivo,
  fecha: Date = new Date()
): string {
  return `${prefijo}_${marcaTiempo(fecha)}.${formato}`;
}

/** Construye el archivo CSV (con BOM para que Excel respete UTF-8). */
export function construirCsv(
  columnas: string[],
  filas: (string | number | null | undefined)[][]
): Buffer {
  const hoja = XLSX.utils.aoa_to_sheet([
    columnas,
    ...filas.map((fila) => fila.map((v) => v ?? '')),
  ]);
  const csv = XLSX.utils.sheet_to_csv(hoja, { FS: ',', RS: '\r\n' });

  return Buffer.from(`\uFEFF${csv}`, 'utf8');
}

/** Construye el archivo Excel (`.xlsx`). */
export function construirXlsx(
  columnas: string[],
  filas: (string | number | null | undefined)[][]
): Buffer {
  const hoja = XLSX.utils.aoa_to_sheet([
    columnas,
    ...filas.map((fila) => fila.map((v) => v ?? '')),
  ]);
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, hoja, 'Datos');

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Construye el archivo de exportación en el formato pedido. */
export function construirArchivo(
  columnas: string[],
  filas: (string | number | null | undefined)[][],
  formato: FormatoArchivo
): Buffer {
  return formato === 'xlsx' ? construirXlsx(columnas, filas) : construirCsv(columnas, filas);
}

/** Columnas de la exportación de líneas (`RF-LIN-EXP-1.2`). */
export const COLUMNAS_EXPORT_LINEAS = [
  'numero',
  'numero_original',
  'proveedor',
  'centro_coste_codigo',
  'centro_coste_nombre',
  'fecha_asignacion',
  'costo_mensual',
  'tipo_linea',
  'empleado',
  'estado',
  'tipo_uso',
  'created_at',
] as const;

/** Columnas de la exportación de centros de coste (`RF-CC-EXP-1.1`). */
export const COLUMNAS_EXPORT_CENTROS = [
  'codigo',
  'nombre',
  'formato_nombre',
  'created_at',
] as const;

/** Columnas de la exportación de formatos (`RF-FMT-EXP-1.1`). */
export const COLUMNAS_EXPORT_FORMATOS = ['nombre', 'created_at'] as const;

/** Contenido de la plantilla CSV para importar centros de coste. */
export const PLANTILLA_CENTROS_COSTE = [
  'codigo,nombre,formato_nombre',
  '510,RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO,SMU',
  'C059102801,FALABELLA TOTTUS Av. Alessandri 4025,FALABELLA',
].join('\r\n');

/** Contenido de la plantilla CSV para importar líneas. */
export const PLANTILLA_LINEAS = [
  'numero,proveedor,centro_coste_codigo,fecha_asignacion,costo_mensual,tipo_linea,empleado,estado,tipo_uso',
  '+56912345678,Movistar,510,2026-01-15,25000,movil,Ana Pérez,pendiente,personal',
].join('\r\n');

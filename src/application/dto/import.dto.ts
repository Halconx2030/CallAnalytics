/** Tamaño máximo admitido para un archivo de importación: 10 MB (RF-CC-IMP-1.5). */
export const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024;

/** Cantidad máxima de filas de datos admitidas en un archivo (RF-LIN-IMP-1.10). */
export const MAX_FILAS_ARCHIVO = 50_000;

/** Archivo a importar. */
export interface ImportarArchivoDto {
  /** Contenido binario del archivo (CSV o Excel). */
  readonly contenido: Buffer;
  /** Nombre original del archivo; se usa para detectar la extensión. */
  readonly nombreArchivo: string;
  /**
   * Crea los formatos que no existan en la base de datos durante la importación de centros
   * de coste (opción *opt-in*; por defecto es `false`).
   *
   * También se puede pasar en el segundo parámetro de `ImportService.importarCentrosCoste()`,
   * que tiene prioridad sobre este valor.
   */
  readonly crearFormatosFaltantes?: boolean;
}

/** Opciones de la importación de centros de coste. */
export interface OpcionesImportacionCentros {
  /**
   * Si es `true`, los formatos que no existan en la base de datos se crean durante la
   * importación (dentro de la misma transacción que la inserción de los centros de coste).
   *
   * Por defecto es `false`: un `formato_nombre` inexistente se reporta como error en la fila
   * y no se importa ninguna fila (RF-CC-IMP-1.2).
   */
  readonly crearFormatosFaltantes?: boolean;
}

/** Error detectado en una fila de la importación de centros de coste. */
export interface ErrorImportacionCentroDto {
  /** Número de fila en el archivo (la cabecera es la fila 1). */
  readonly fila: number;
  /** Código del centro de coste de la fila (o cadena vacía). */
  readonly codigo: string;
  /** Motivo del error, listo para mostrar al usuario. */
  readonly motivo: string;
}

/** Error detectado en una fila de la importación de líneas. */
export interface ErrorImportacionLineaDto {
  /** Número de fila en el archivo (la cabecera es la fila 1). */
  readonly fila: number;
  /** Número de la fila (o cadena vacía si no se pudo leer). */
  readonly numero: string;
  /** Motivo del error, listo para mostrar al usuario. */
  readonly motivo: string;
}

/** Duplicado detectado en la importación de líneas (RF-LIN-IMP-1.3). */
export interface DuplicadoImportacionLineaDto {
  /** Número de fila en el archivo (la cabecera es la fila 1). */
  readonly fila: number;
  /** Número normalizado que ya existe. */
  readonly numero: string;
  /** Motivo del duplicado, listo para mostrar al usuario. */
  readonly motivo: string;
}

/**
 * Reporte de la importación de centros de coste (RF-CC-IMP-1.4).
 *
 * La importación de centros es todo-o-nada: si hay `duplicados` o `errores`, no se inserta
 * ninguna fila.
 */
export interface ReporteImportacionCentrosDto {
  /** Centros de coste insertados. */
  readonly insertados: number;
  /** Filas cuyo código ya existía en la base de datos. */
  readonly duplicados: number;
  /** Detalle de las filas con problemas (incluye los duplicados). */
  readonly errores: ErrorImportacionCentroDto[];
  /**
   * Formatos creados durante la importación (solo si se pidió la creación automática).
   *
   * Se devuelve con el nombre tal como aparece en el archivo (recortado).
   */
  readonly formatosCreados?: string[];
}

/**
 * Reporte de la importación de líneas (RF-LIN-IMP-1.8).
 *
 * Los duplicados no bloquean la importación (RF-LIN-IMP-1.9), pero cualquier error de
 * validación sí la cancela por completo.
 */
export interface ReporteImportacionLineasDto {
  /** Líneas insertadas. */
  readonly insertados: number;
  /** Filas ignoradas porque su número ya existía. */
  readonly duplicados: DuplicadoImportacionLineaDto[];
  /** Filas con errores de validación. */
  readonly errores: ErrorImportacionLineaDto[];
}

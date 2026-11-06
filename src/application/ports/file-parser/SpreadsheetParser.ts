/**
 * Puerto de lectura de archivos tabulares (CSV / Excel) usado por el módulo de importación.
 *
 * La aplicación no conoce la librería concreta: solo consume filas ya normalizadas.
 */

/** Fila del archivo, indexada por nombre de columna normalizado. */
export type FilaSpreadsheet = Record<string, string>;

/** Resultado del parseo de un archivo. */
export interface ResultadoParseo {
  /** Filas de datos (la primera fila del archivo se usa como cabecera). */
  readonly filas: FilaSpreadsheet[];
  /** Nombres de columna detectados en la cabecera. */
  readonly columnas: string[];
}

/**
 * Lector de planillas.
 */
export interface SpreadsheetParser {
  /**
   * Parsea el contenido de un archivo.
   *
   * @param contenido contenido binario del archivo.
   * @param nombreArchivo nombre original; se usa para detectar el formato (csv/xlsx/xls).
   * @throws {ValidationError} si el archivo no tiene cabecera, no tiene filas o es ilegible.
   */
  parsear(contenido: Buffer, nombreArchivo: string): Promise<ResultadoParseo>;
}

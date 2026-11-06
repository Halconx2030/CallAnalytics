import * as XLSX from 'xlsx';

import { ValidationError } from '@domain/errors/DomainError.js';

import type {
  FilaSpreadsheet,
  ResultadoParseo,
  SpreadsheetParser,
} from '@application/ports/file-parser/SpreadsheetParser.js';

/** Extensiones soportadas por el parser. */
const EXTENSIONES_SOPORTADAS = new Set(['csv', 'xlsx', 'xls']);

/**
 * Implementación de {@link SpreadsheetParser} sobre SheetJS (`xlsx`).
 *
 * Lee tanto CSV como Excel y normaliza las cabeceras (minúsculas, sin BOM y con espacios
 * convertidos en `_`) para que el servicio de importación pueda invocarlas sin sorpresas.
 */
export class XlsxParser implements SpreadsheetParser {
  parsear(contenido: Buffer, nombreArchivo: string): Promise<ResultadoParseo> {
    try {
      return Promise.resolve(this.parsearContenido(contenido, nombreArchivo));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /** Lógica de parseo (síncrona): cualquier error se propaga como `ValidationError`. */
  private parsearContenido(contenido: Buffer, nombreArchivo: string): ResultadoParseo {
    const extension = this.extensionArchivo(nombreArchivo);

    if (!EXTENSIONES_SOPORTADAS.has(extension)) {
      throw new ValidationError(
        'archivo',
        `formato no soportado "${extension}". Se admiten: csv, xlsx, xls.`
      );
    }

    if (contenido.length === 0) {
      throw new ValidationError('archivo', 'el archivo está vacío');
    }

    let libro: XLSX.WorkBook;

    try {
      libro = XLSX.read(contenido, { type: 'buffer', raw: false, cellDates: false });
    } catch {
      throw new ValidationError('archivo', 'no se pudo leer el archivo');
    }

    const nombreHoja = libro.SheetNames[0];
    const hoja = nombreHoja === undefined ? undefined : libro.Sheets[nombreHoja];

    if (hoja === undefined) {
      throw new ValidationError('archivo', 'el archivo no contiene hojas');
    }

    const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    });

    const cabecera = matriz[0];

    if (cabecera === undefined) {
      throw new ValidationError('archivo', 'el archivo no tiene cabeceras');
    }

    const columnas = this.normalizarCabecera(cabecera);

    if (columnas.length === 0) {
      throw new ValidationError('archivo', 'el archivo no tiene cabeceras');
    }

    const filas: FilaSpreadsheet[] = [];

    for (const fila of matriz.slice(1)) {
      const valores = this.normalizarFila(fila, columnas.length);

      if (valores.every((valor) => valor === '')) {
        continue;
      }

      const registro: FilaSpreadsheet = {};

      columnas.forEach((columna, indice) => {
        registro[columna] = valores[indice] ?? '';
      });

      filas.push(registro);
    }

    if (filas.length === 0) {
      throw new ValidationError('archivo', 'el archivo no contiene filas de datos');
    }

    return { filas, columnas };
  }

  /** Extensión en minúsculas del archivo (sin punto). */
  private extensionArchivo(nombreArchivo: string): string {
    const partes = nombreArchivo.toLowerCase().split('.');
    return partes[partes.length - 1] ?? '';
  }

  /** Normaliza los nombres de columna y resuelve duplicados. */
  private normalizarCabecera(cabecera: unknown[]): string[] {
    const columnas: string[] = [];
    const usadas = new Map<string, number>();

    for (const celda of cabecera) {
      const base = this.normalizarColumna(celda);
      const clave = base === '' ? 'columna' : base;
      const repeticiones = usadas.get(clave) ?? 0;
      usadas.set(clave, repeticiones + 1);
      columnas.push(repeticiones === 0 ? clave : `${clave}_${repeticiones + 1}`);
    }

    return columnas;
  }

  /** Convierte una fila a un arreglo de strings del largo de la cabecera. */
  private normalizarFila(fila: unknown[], largo: number): string[] {
    const valores: string[] = [];

    for (let indice = 0; indice < largo; indice += 1) {
      valores.push(this.normalizarTexto(fila[indice]));
    }

    return valores;
  }

  /** Normaliza el contenido de una celda a texto sin espacios sobrantes. */
  private normalizarTexto(valor: unknown): string {
    if (valor === null || valor === undefined) {
      return '';
    }

    if (valor instanceof Date) {
      return valor.toISOString().slice(0, 10);
    }

    return String(valor)
      .replace(/^\uFEFF/, '')
      .trim();
  }

  /**
   * Normaliza un nombre de columna: sin BOM, en minúsculas y con los espacios convertidos
   * en `_` (ej. "Centro de Coste" → "centro_de_coste").
   */
  private normalizarColumna(valor: unknown): string {
    return this.normalizarTexto(valor).toLowerCase().replace(/\s+/g, '_');
  }
}

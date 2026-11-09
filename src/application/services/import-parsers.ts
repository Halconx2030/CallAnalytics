import { ValidationError } from '@domain/errors/DomainError.js';

import { MAX_BYTES_ARCHIVO, MAX_FILAS_ARCHIVO } from '@application/dto/import.dto.js';
import type { FilaSpreadsheet } from '@application/ports/file-parser/SpreadsheetParser.js';

/** Prefijos que Excel/CSV interpretan como fórmula (regla de sanitización). */
const PREFIJOS_PELIGROSOS = /^[=+\-@]/;

/** Valida el tamaño máximo del archivo (10 MB). */
export function validarTamanoArchivo(contenido: Buffer): void {
  if (contenido.length > MAX_BYTES_ARCHIVO) {
    throw new ValidationError(
      'archivo',
      `el archivo supera el máximo de ${Math.floor(MAX_BYTES_ARCHIVO / (1024 * 1024))} MB`
    );
  }
}

/** Valida que el archivo tenga todas las columnas obligatorias. */
export function exigirColumnasArchivo(columnas: string[], requeridas: readonly string[]): void {
  const faltantes = requeridas.filter((columna) => !columnas.includes(columna));

  if (faltantes.length > 0) {
    throw new ValidationError(
      'archivo',
      `faltan las columnas obligatorias: ${faltantes.join(', ')}`
    );
  }
}

/** Valida la cantidad máxima de filas (50.000). */
export function validarCantidadFilasArchivo(cantidad: number): void {
  if (cantidad > MAX_FILAS_ARCHIVO) {
    throw new ValidationError(
      'archivo',
      `el archivo supera el máximo de ${MAX_FILAS_ARCHIVO.toLocaleString('es-CL')} filas`
    );
  }
}

/** Lee una celda del archivo; devuelve cadena vacía si la columna no existe. */
export function obtenerCelda(fila: FilaSpreadsheet, columna: string): string {
  const valor = fila[columna];
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Sanitiza una celda de texto: si empieza por `=`, `+`, `-` o `@` se le antepone un
 * apóstrofo para que no se interprete como fórmula.
 */
export function sanitizarCelda(valor: string): string {
  return PREFIJOS_PELIGROSOS.test(valor) ? `'${valor}` : valor;
}

/**
 * Interpreta un decimal escrito en el archivo.
 *
 * Acepta `1234.56`, `1234,56`, `1.234,56` y `1,234.56`.
 */
export function parsearDecimal(valor: string): number | null {
  const texto = valor.replace(/[$\s\u00a0]/g, '');

  if (texto === '') {
    return null;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)) {
    return Number(texto.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(texto)) {
    return Number(texto.replace(/,/g, ''));
  }

  if (/^\d+,\d+$/.test(texto)) {
    return Number(texto.replace(',', '.'));
  }

  if (/^\d+(\.\d+)?$/.test(texto)) {
    return Number(texto);
  }

  return null;
}

/**
 * Interpreta una fecha escrita en el archivo.
 *
 * Acepta `YYYY-MM-DD` y el formato chileno `DD/MM/YYYY` (y `DD-MM-YYYY`).
 */
export function parsearFecha(valor: string): string | null {
  const texto = valor.trim();

  if (texto === '') {
    return null;
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);

  if (iso !== null) {
    return componerFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const latino = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto);

  if (latino !== null) {
    return componerFecha(Number(latino[3]), Number(latino[2]), Number(latino[1]));
  }

  return null;
}

/** Construye una fecha `YYYY-MM-DD` verificando que exista en el calendario. */
function componerFecha(anio: number, mes: number, dia: number): string | null {
  const fueraDeRango = anio < 1900 || anio > 2999 || mes < 1 || mes > 12 || dia < 1 || dia > 31;

  if (fueraDeRango) {
    return null;
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const coincideCalendario =
    !Number.isNaN(fecha.getTime()) &&
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia;

  if (!coincideCalendario) {
    return null;
  }

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Extrae un mensaje legible de un error de dominio o de infraestructura. */
export function describirError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'error inesperado';
}

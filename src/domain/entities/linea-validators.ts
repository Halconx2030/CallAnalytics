import { ValidationError } from '../errors/DomainError.js';

import type { TipoLinea } from '../value-objects/PhoneNumber.js';

/** Estados posibles de una línea (spec 001, §5.3). */
export type EstadoLinea = 'activa' | 'baja' | 'pendiente' | 'portabilidad';

/** Tipos de uso de una línea. */
export type TipoUso = 'personal' | 'geovictoria';

export const ESTADOS_LINEA: readonly EstadoLinea[] = [
  'activa',
  'baja',
  'pendiente',
  'portabilidad',
];

export const TIPOS_USO: readonly TipoUso[] = ['personal', 'geovictoria'];

export const TIPOS_LINEA: readonly TipoLinea[] = ['movil', 'fijo'];

const MAX_NUMERO_ORIGINAL = 50;
const MAX_PROVEEDOR = 100;
const MAX_EMPLEADO = 100;
const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida que el número original sea un texto no vacío de hasta 50 caracteres. */
export function validarNumeroOriginal(valor: string): string {
  if (typeof valor !== 'string') {
    throw new ValidationError('numeroOriginal', 'debe ser un texto');
  }

  if (valor.trim() === '') {
    throw new ValidationError('numeroOriginal', 'no puede estar vacío');
  }

  if (valor.length > MAX_NUMERO_ORIGINAL) {
    throw new ValidationError(
      'numeroOriginal',
      `no puede superar los ${MAX_NUMERO_ORIGINAL} caracteres`
    );
  }

  return valor;
}

/** Valida y recorta el nombre del proveedor. */
export function validarProveedor(valor: string): string {
  if (typeof valor !== 'string') {
    throw new ValidationError('proveedor', 'debe ser un texto');
  }

  const recortado = valor.trim();
  if (recortado.length > MAX_PROVEEDOR) {
    throw new ValidationError('proveedor', `no puede superar los ${MAX_PROVEEDOR} caracteres`);
  }

  return recortado;
}

/** Valida y normaliza el nombre del empleado (cadena vacía se convierte en `null`). */
export function validarEmpleado(valor: string | null): string | null {
  const desconocido: unknown = valor;

  if (desconocido === null || desconocido === undefined) {
    return null;
  }

  if (typeof desconocido !== 'string') {
    throw new ValidationError('empleado', 'debe ser un texto o null');
  }

  const recortado = desconocido.trim();
  if (recortado === '') {
    return null;
  }

  if (recortado.length > MAX_EMPLEADO) {
    throw new ValidationError('empleado', `no puede superar los ${MAX_EMPLEADO} caracteres`);
  }

  return recortado;
}

/** Valida el identificador del centro de coste. */
export function validarCentroCosteId(valor: string): string {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') {
    throw new ValidationError('centroCosteId', 'no puede estar vacío');
  }
  return recortado;
}

/** Valida el estado de la línea contra los valores admitidos. */
export function validarEstado(valor: string): EstadoLinea {
  if (!ESTADOS_LINEA.includes(valor as EstadoLinea)) {
    throw new ValidationError('estado', `debe ser uno de: ${ESTADOS_LINEA.join(', ')}`);
  }
  return valor as EstadoLinea;
}

/** Valida el tipo de uso de la línea contra los valores admitidos. */
export function validarTipoUso(valor: string): TipoUso {
  if (!TIPOS_USO.includes(valor as TipoUso)) {
    throw new ValidationError('tipoUso', `debe ser uno de: ${TIPOS_USO.join(', ')}`);
  }
  return valor as TipoUso;
}

/** Valida el tipo de línea (`movil` o `fijo`). */
export function validarTipoLinea(valor: string): TipoLinea {
  if (!TIPOS_LINEA.includes(valor as TipoLinea)) {
    throw new ValidationError('tipoLinea', `debe ser uno de: ${TIPOS_LINEA.join(', ')}`);
  }
  return valor as TipoLinea;
}

/** Valida el identificador de la línea. */
export function validarId(valor: string): string {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') {
    throw new ValidationError('id', 'no puede estar vacío');
  }
  return recortado;
}

/** Valida el número de versión para bloqueo optimista. */
export function validarVersion(valor: number): number {
  if (!Number.isInteger(valor) || valor < 1) {
    throw new ValidationError('version', 'debe ser un entero mayor o igual a 1');
  }
  return valor;
}

/** Valida que la fecha de asignación tenga formato `YYYY-MM-DD` y exista en el calendario. */
export function validarFechaAsignacion(valor: string): string {
  const texto: unknown = valor;

  if (typeof texto !== 'string' || !REGEX_FECHA_ISO.test(texto)) {
    throw new ValidationError('fechaAsignacion', 'debe tener formato YYYY-MM-DD');
  }

  const fecha = new Date(`${texto}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== texto) {
    throw new ValidationError('fechaAsignacion', 'no es una fecha válida');
  }

  return texto;
}

/** Formatea un objeto `Date` como `YYYY-MM-DD` en UTC. */
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Convierte un valor `Date | string` a cadena `YYYY-MM-DD`. */
export function formatearFechaDesde(valor: Date | string): string {
  return valor instanceof Date ? formatearFecha(valor) : valor;
}

/** Convierte un valor `Date | string` a instancia `Date` validada. */
export function aFecha(valor: Date | string, campo: string): Date {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new ValidationError(campo, 'no es una fecha válida');
  }
  return fecha;
}

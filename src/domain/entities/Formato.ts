import { ValidationError } from '../errors/DomainError.js';

const MAX_NOMBRE = 100;

/** Datos de entrada para crear un formato. */
export interface CrearFormatoInput {
  readonly nombre: string;
}

/** Fila de persistencia de `formatos` con la que se reconstituye la entidad. */
export interface FormatoRowData {
  readonly id: string;
  readonly nombre: string;
  readonly version: number;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

interface FormatoProps {
  id: string | null;
  nombre: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Formato de importación (ej. "SMU", "FALABELLA").
 *
 * Contrato de `id`: al crear la entidad el id es `null`; se asigna al persistir con `conId()`.
 * La entidad es inmutable: `renombrar` y `conId` devuelven instancias nuevas.
 *
 * `version` (optimistic locking) la administra la capa de persistencia: las factories de
 * dominio la leen de la fila (`reconstituirFormato`) pero no la incrementan.
 */
export class Formato {
  readonly id: string | null;
  readonly nombre: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: FormatoProps) {
    this.id = props.id;
    this.nombre = props.nombre;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    Object.freeze(this);
  }

  /** Crea un formato aún no persistido (`id: null`, `version: 1`). */
  static crearFormato(input: CrearFormatoInput, ahora: Date = new Date()): Formato {
    return new Formato({
      id: null,
      nombre: validarNombre(input.nombre),
      version: 1,
      createdAt: ahora,
      updatedAt: ahora,
    });
  }

  /** Reconstituye la entidad a partir de una fila de la base de datos. */
  static reconstituirFormato(row: FormatoRowData): Formato {
    return new Formato({
      id: validarId(row.id),
      nombre: validarNombre(row.nombre),
      version: validarVersion(row.version),
      createdAt: aFecha(row.createdAt, 'createdAt'),
      updatedAt: aFecha(row.updatedAt, 'updatedAt'),
    });
  }

  /** Devuelve una copia con el nuevo nombre (no muta la instancia actual). */
  renombrar(nombre: string, ahora: Date = new Date()): Formato {
    return new Formato({
      id: this.id,
      nombre: validarNombre(nombre),
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: ahora,
    });
  }

  /** Devuelve una copia con el id asignado por la base de datos. */
  conId(id: string): Formato {
    return new Formato({
      id: validarId(id),
      nombre: this.nombre,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }
}

function validarNombre(nombre: string): string {
  if (typeof nombre !== 'string') {
    throw new ValidationError('nombre', 'debe ser un texto');
  }

  const recortado = nombre.trim();
  if (recortado === '') {
    throw new ValidationError('nombre', 'no puede estar vacío');
  }

  if (recortado.length > MAX_NOMBRE) {
    throw new ValidationError('nombre', `no puede superar los ${MAX_NOMBRE} caracteres`);
  }

  return recortado;
}

function validarId(id: string): string {
  const recortado = typeof id === 'string' ? id.trim() : '';
  if (recortado === '') {
    throw new ValidationError('id', 'no puede estar vacío');
  }
  return recortado;
}

function validarVersion(version: number): number {
  if (!Number.isInteger(version) || version < 1) {
    throw new ValidationError('version', 'debe ser un entero mayor o igual a 1');
  }
  return version;
}

function aFecha(valor: Date | string, campo: string): Date {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new ValidationError(campo, 'no es una fecha válida');
  }
  return fecha;
}

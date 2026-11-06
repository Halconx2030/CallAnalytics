import { ValidationError } from '../errors/DomainError.js';

const MAX_CODIGO = 50;
/** La columna `centros_coste.nombre` es `varchar(200)`; el dominio no debe admitir más. */
const MAX_NOMBRE = 200;

/** Datos de entrada para crear un centro de coste. */
export interface CrearCentroCosteInput {
  readonly codigo: string;
  readonly nombre: string;
  readonly formatoId: string;
}

/** Fila de persistencia de `centros_coste` con la que se reconstituye la entidad. */
export interface CentroCosteRowData {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly formatoId: string;
  readonly version: number;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

interface CentroCosteProps {
  id: string | null;
  codigo: string;
  nombre: string;
  formatoId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Centro de coste al que se asignan líneas telefónicas.
 *
 * Contrato de `id`: `null` hasta persistir; se asigna con `conId()`.
 * `codigo` es inmutable (RF-CC-1.4) y se conserva tal cual lo escribe el usuario: la
 * comparación case-insensitive es responsabilidad de importación/repositorio.
 */
export class CentroCoste {
  readonly id: string | null;
  readonly codigo: string;
  readonly nombre: string;
  readonly formatoId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: CentroCosteProps) {
    this.id = props.id;
    this.codigo = props.codigo;
    this.nombre = props.nombre;
    this.formatoId = props.formatoId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    Object.freeze(this);
  }

  /** Crea un centro de coste aún no persistido (`id: null`, `version: 1`). */
  static crearCentroCoste(input: CrearCentroCosteInput, ahora: Date = new Date()): CentroCoste {
    return new CentroCoste({
      id: null,
      codigo: validarCodigo(input.codigo),
      nombre: validarNombre(input.nombre),
      formatoId: validarFormatoId(input.formatoId),
      version: 1,
      createdAt: ahora,
      updatedAt: ahora,
    });
  }

  /** Reconstituye la entidad a partir de una fila de la base de datos. */
  static reconstituirCentroCoste(row: CentroCosteRowData): CentroCoste {
    return new CentroCoste({
      id: validarId(row.id),
      codigo: validarCodigo(row.codigo),
      nombre: validarNombre(row.nombre),
      formatoId: validarFormatoId(row.formatoId),
      version: validarVersion(row.version),
      createdAt: aFecha(row.createdAt, 'createdAt'),
      updatedAt: aFecha(row.updatedAt, 'updatedAt'),
    });
  }

  /** Devuelve una copia con el nombre actualizado (no muta la instancia actual). */
  renombrar(nombre: string, ahora: Date = new Date()): CentroCoste {
    return new CentroCoste({
      ...this.props(),
      nombre: validarNombre(nombre),
      updatedAt: ahora,
    });
  }

  /** Devuelve una copia asignada a otro formato (no muta la instancia actual). */
  cambiarFormato(formatoId: string, ahora: Date = new Date()): CentroCoste {
    return new CentroCoste({
      ...this.props(),
      formatoId: validarFormatoId(formatoId),
      updatedAt: ahora,
    });
  }

  /** Devuelve una copia con el id asignado por la base de datos. */
  conId(id: string): CentroCoste {
    return new CentroCoste({ ...this.props(), id: validarId(id) });
  }

  private props(): CentroCosteProps {
    return {
      id: this.id,
      codigo: this.codigo,
      nombre: this.nombre,
      formatoId: this.formatoId,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function validarCodigo(codigo: string): string {
  if (typeof codigo !== 'string') {
    throw new ValidationError('codigo', 'debe ser un texto');
  }

  const recortado = codigo.trim();
  if (recortado === '') {
    throw new ValidationError('codigo', 'no puede estar vacío');
  }

  if (recortado.length > MAX_CODIGO) {
    throw new ValidationError('codigo', `no puede superar los ${MAX_CODIGO} caracteres`);
  }

  return recortado;
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

function validarFormatoId(formatoId: string): string {
  const recortado = typeof formatoId === 'string' ? formatoId.trim() : '';
  if (recortado === '') {
    throw new ValidationError('formatoId', 'no puede estar vacío');
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

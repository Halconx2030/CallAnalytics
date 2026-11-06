import { ValidationError } from '../errors/DomainError.js';
import { CostoMensual } from '../value-objects/CostoMensual.js';
import { normalizePhone, type TipoLinea } from '../value-objects/PhoneNumber.js';

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

/** Datos de entrada para crear una línea telefónica. */
export interface CrearLineaTelefonicaInput {
  /** Número tal como lo ingresa el usuario; se normaliza a E.164. */
  readonly numero: string;

  /** Valor crudo original. Si se omite se guarda `numero` sin transformar. */
  readonly numeroOriginal?: string;

  readonly proveedor?: string;
  readonly centroCosteId: string;

  /** Fecha en formato `YYYY-MM-DD`. Por defecto, el día de `ahora` en UTC. */
  readonly fechaAsignacion?: string;

  readonly costoMensual?: number | string;
  readonly tipoLinea?: TipoLinea;
  readonly empleado?: string | null;
  readonly estado?: EstadoLinea;
  readonly tipoUso?: TipoUso;
}

/**
 * Campos modificables de una línea. `id` y `numero` no aparecen: son inmutables
 * (RF-LIN-1.5).
 */
export interface CambiosLineaTelefonica {
  readonly numeroOriginal?: string;
  readonly proveedor?: string;
  readonly centroCosteId?: string;
  readonly fechaAsignacion?: string;
  readonly costoMensual?: number | string;
  readonly tipoLinea?: TipoLinea;
  readonly empleado?: string | null;
  readonly estado?: EstadoLinea;
  readonly tipoUso?: TipoUso;
}

/** Fila de persistencia de `lineas_telefonicas` con la que se reconstituye la entidad. */
export interface LineaTelefonicaRowData {
  readonly id: string;
  readonly numero: string;
  readonly numeroOriginal: string;
  readonly proveedor: string;
  readonly centroCosteId: string;
  readonly fechaAsignacion: Date | string;
  readonly costoMensual: number | string;
  readonly tipoLinea: string;
  readonly empleado: string | null;
  readonly estado: string;
  readonly tipoUso: string;
  readonly version: number;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly deletedAt: Date | string | null;
}

interface LineaTelefonicaProps {
  id: string | null;
  numero: string;
  numeroOriginal: string;
  proveedor: string;
  centroCosteId: string;
  fechaAsignacion: string;
  costoMensual: CostoMensual;
  tipoLinea: TipoLinea;
  empleado: string | null;
  estado: EstadoLinea;
  tipoUso: TipoUso;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Línea telefónica.
 *
 * Invariantes:
 * - `numero` es inmutable y siempre está normalizado (`normalizePhone`).
 * - `id` es `null` hasta persistir y se asigna con `conId()`.
 * - `estado = 'baja'` implica `deletedAt` no nulo (baja lógica, RF-LIN-1.8).
 * - La entidad es inmutable: todos sus métodos devuelven instancias nuevas.
 *
 * `version` (optimistic locking) es administrada por la capa de persistencia.
 */
export class LineaTelefonica {
  readonly id: string | null;
  readonly numero: string;
  readonly numeroOriginal: string;
  readonly proveedor: string;
  readonly centroCosteId: string;
  /** Fecha en formato `YYYY-MM-DD` (UTC). */
  readonly fechaAsignacion: string;
  readonly costoMensual: CostoMensual;
  readonly tipoLinea: TipoLinea;
  readonly empleado: string | null;
  readonly estado: EstadoLinea;
  readonly tipoUso: TipoUso;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;

  private constructor(props: LineaTelefonicaProps) {
    this.id = props.id;
    this.numero = props.numero;
    this.numeroOriginal = props.numeroOriginal;
    this.proveedor = props.proveedor;
    this.centroCosteId = props.centroCosteId;
    this.fechaAsignacion = props.fechaAsignacion;
    this.costoMensual = props.costoMensual;
    this.tipoLinea = props.tipoLinea;
    this.empleado = props.empleado;
    this.estado = props.estado;
    this.tipoUso = props.tipoUso;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.deletedAt = props.deletedAt;
    Object.freeze(this);
  }

  /**
   * Crea una línea aún no persistida.
   *
   * Defaults (RF-LIN-IMP-1.4): `estado='pendiente'`, `tipoUso='personal'`, `proveedor=''`,
   * `empleado=null`, `costoMensual=0`, `fechaAsignacion=hoy` y `tipoLinea` inferido del
   * número normalizado.
   */
  static crearLineaTelefonica(
    input: CrearLineaTelefonicaInput,
    ahora: Date = new Date()
  ): LineaTelefonica {
    const { normalized, tipo } = normalizePhone(input.numero);
    const estado = input.estado === undefined ? 'pendiente' : validarEstado(input.estado);

    return new LineaTelefonica({
      id: null,
      numero: normalized,
      numeroOriginal:
        input.numeroOriginal === undefined
          ? input.numero
          : validarNumeroOriginal(input.numeroOriginal),
      proveedor: validarProveedor(input.proveedor ?? ''),
      centroCosteId: validarCentroCosteId(input.centroCosteId),
      fechaAsignacion:
        input.fechaAsignacion === undefined
          ? formatearFecha(ahora)
          : validarFechaAsignacion(input.fechaAsignacion),
      costoMensual: CostoMensual.create(input.costoMensual ?? 0),
      tipoLinea: input.tipoLinea === undefined ? tipo : validarTipoLinea(input.tipoLinea),
      empleado: validarEmpleado(input.empleado ?? null),
      estado,
      tipoUso: input.tipoUso === undefined ? 'personal' : validarTipoUso(input.tipoUso),
      version: 1,
      createdAt: ahora,
      updatedAt: ahora,
      deletedAt: estado === 'baja' ? ahora : null,
    });
  }

  /** Reconstituye la entidad a partir de una fila de la base de datos. */
  static reconstituirLineaTelefonica(row: LineaTelefonicaRowData): LineaTelefonica {
    const { normalized } = normalizePhone(row.numero);

    return new LineaTelefonica({
      id: validarId(row.id),
      numero: normalized,
      numeroOriginal: validarNumeroOriginal(row.numeroOriginal),
      proveedor: validarProveedor(row.proveedor),
      centroCosteId: validarCentroCosteId(row.centroCosteId),
      fechaAsignacion: validarFechaAsignacion(formatearFechaDesde(row.fechaAsignacion)),
      costoMensual: CostoMensual.create(row.costoMensual),
      tipoLinea: validarTipoLinea(row.tipoLinea),
      empleado: validarEmpleado(row.empleado),
      estado: validarEstado(row.estado),
      tipoUso: validarTipoUso(row.tipoUso),
      version: validarVersion(row.version),
      createdAt: aFecha(row.createdAt, 'createdAt'),
      updatedAt: aFecha(row.updatedAt, 'updatedAt'),
      deletedAt: row.deletedAt === null ? null : aFecha(row.deletedAt, 'deletedAt'),
    });
  }

  /** Indica si la línea está dada de baja (soft delete). */
  estaDadaDeBaja(): boolean {
    return this.deletedAt !== null;
  }

  /** Devuelve una copia con el id asignado por la base de datos. */
  conId(id: string): LineaTelefonica {
    return new LineaTelefonica({ ...this.props(), id: validarId(id) });
  }

  /**
   * Cambia el estado de la línea.
   *
   * - Pasar a `baja` setea `deletedAt = ahora` (RF-LIN-1.8) si aún no estaba de baja.
   * - Salir de `baja` limpia `deletedAt` para no dejar una línea "activa" con soft delete.
   * - Si el estado no cambia, devuelve la misma instancia (operación idempotente).
   */
  cambiarEstado(nuevoEstado: EstadoLinea, ahora: Date = new Date()): LineaTelefonica {
    const estado = validarEstado(nuevoEstado);

    if (estado === this.estado) {
      return this;
    }

    return new LineaTelefonica({
      ...this.props(),
      estado,
      updatedAt: ahora,
      deletedAt: estado === 'baja' ? ahora : null,
    });
  }

  /** Baja lógica: `estado='baja'` y `deletedAt=ahora` (idempotente). */
  darDeBaja(ahora: Date = new Date()): LineaTelefonica {
    return this.cambiarEstado('baja', ahora);
  }

  /**
   * Aplica cambios sobre los campos mutables. `id` y `numero` no se pueden modificar.
   *
   * Si el nuevo estado es `baja` setea `deletedAt`; si sale de `baja`, lo limpia.
   */
  actualizar(cambios: CambiosLineaTelefonica, ahora: Date = new Date()): LineaTelefonica {
    const props = this.props();

    if (cambios.numeroOriginal !== undefined) {
      props.numeroOriginal = validarNumeroOriginal(cambios.numeroOriginal);
    }
    if (cambios.proveedor !== undefined) {
      props.proveedor = validarProveedor(cambios.proveedor);
    }
    if (cambios.centroCosteId !== undefined) {
      props.centroCosteId = validarCentroCosteId(cambios.centroCosteId);
    }
    if (cambios.fechaAsignacion !== undefined) {
      props.fechaAsignacion = validarFechaAsignacion(cambios.fechaAsignacion);
    }
    if (cambios.costoMensual !== undefined) {
      props.costoMensual = CostoMensual.create(cambios.costoMensual);
    }
    if (cambios.tipoLinea !== undefined) {
      props.tipoLinea = validarTipoLinea(cambios.tipoLinea);
    }
    if (cambios.empleado !== undefined) {
      props.empleado = validarEmpleado(cambios.empleado);
    }
    if (cambios.tipoUso !== undefined) {
      props.tipoUso = validarTipoUso(cambios.tipoUso);
    }
    if (cambios.estado !== undefined) {
      const estado = validarEstado(cambios.estado);
      props.estado = estado;

      if (estado === 'baja') {
        props.deletedAt = this.estado === 'baja' ? this.deletedAt : ahora;
      } else {
        props.deletedAt = null;
      }
    }

    props.updatedAt = ahora;
    return new LineaTelefonica(props);
  }

  private props(): LineaTelefonicaProps {
    return {
      id: this.id,
      numero: this.numero,
      numeroOriginal: this.numeroOriginal,
      proveedor: this.proveedor,
      centroCosteId: this.centroCosteId,
      fechaAsignacion: this.fechaAsignacion,
      costoMensual: this.costoMensual,
      tipoLinea: this.tipoLinea,
      empleado: this.empleado,
      estado: this.estado,
      tipoUso: this.tipoUso,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

function validarNumeroOriginal(valor: string): string {
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

function validarProveedor(valor: string): string {
  if (typeof valor !== 'string') {
    throw new ValidationError('proveedor', 'debe ser un texto');
  }

  const recortado = valor.trim();
  if (recortado.length > MAX_PROVEEDOR) {
    throw new ValidationError('proveedor', `no puede superar los ${MAX_PROVEEDOR} caracteres`);
  }

  return recortado;
}

function validarEmpleado(valor: string | null): string | null {
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

function validarCentroCosteId(valor: string): string {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') {
    throw new ValidationError('centroCosteId', 'no puede estar vacío');
  }
  return recortado;
}

function validarEstado(valor: string): EstadoLinea {
  if (!ESTADOS_LINEA.includes(valor as EstadoLinea)) {
    throw new ValidationError('estado', `debe ser uno de: ${ESTADOS_LINEA.join(', ')}`);
  }
  return valor as EstadoLinea;
}

function validarTipoUso(valor: string): TipoUso {
  if (!TIPOS_USO.includes(valor as TipoUso)) {
    throw new ValidationError('tipoUso', `debe ser uno de: ${TIPOS_USO.join(', ')}`);
  }
  return valor as TipoUso;
}

function validarTipoLinea(valor: string): TipoLinea {
  if (!TIPOS_LINEA.includes(valor as TipoLinea)) {
    throw new ValidationError('tipoLinea', `debe ser uno de: ${TIPOS_LINEA.join(', ')}`);
  }
  return valor as TipoLinea;
}

function validarId(valor: string): string {
  const recortado = typeof valor === 'string' ? valor.trim() : '';
  if (recortado === '') {
    throw new ValidationError('id', 'no puede estar vacío');
  }
  return recortado;
}

function validarVersion(valor: number): number {
  if (!Number.isInteger(valor) || valor < 1) {
    throw new ValidationError('version', 'debe ser un entero mayor o igual a 1');
  }
  return valor;
}

function validarFechaAsignacion(valor: string): string {
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

function formatearFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function formatearFechaDesde(valor: Date | string): string {
  return valor instanceof Date ? formatearFecha(valor) : valor;
}

function aFecha(valor: Date | string, campo: string): Date {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new ValidationError(campo, 'no es una fecha válida');
  }
  return fecha;
}

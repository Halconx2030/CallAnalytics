import type { EstadoLinea, LineaTelefonica, TipoUso } from '@domain/entities/LineaTelefonica.js';
import type { TipoLinea } from '@domain/value-objects/PhoneNumber.js';

import type { PaginaCursor, PaginacionCursor } from './paginacion.js';

/** Columnas por las que se puede ordenar el listado de líneas. */
export type ColumnaOrdenLinea =
  | 'numero'
  | 'proveedor'
  | 'centro_coste_codigo'
  | 'fecha_asignacion'
  | 'costo_mensual'
  | 'tipo_linea'
  | 'estado'
  | 'tipo_uso'
  | 'created_at';

/** Dirección del ordenamiento. */
export type DireccionOrden = 'asc' | 'desc';

/** Los 14 filtros soportados por el listado de líneas. */
export interface FiltrosLinea {
  /** Búsqueda parcial del número normalizado. */
  readonly numero?: string | undefined;
  /** Búsqueda parcial del proveedor. */
  readonly proveedor?: string | undefined;
  /** Filtro exacto por id de centro de coste. */
  readonly centroCosteId?: string | undefined;
  /** Búsqueda parcial del código de centro de coste. */
  readonly centroCosteCodigo?: string | undefined;
  /** Búsqueda parcial del nombre de centro de coste. */
  readonly centroCosteNombre?: string | undefined;
  /**
   * Búsqueda libre por código **o** nombre del centro de coste (semántica OR).
   *
   * Devuelve las líneas de **todos** los centros de coste que contienen ese texto;
   * es el filtro que usa el buscador de la UI en modo "todos los que coincidan".
   */
  readonly centroCosteBusqueda?: string | undefined;
  /** Fecha de asignación exacta (`YYYY-MM-DD`). */
  readonly fechaAsignacion?: string | undefined;
  /** Fecha de asignación mínima (inclusive). */
  readonly fechaDesde?: string | undefined;
  /** Fecha de asignación máxima (inclusive). */
  readonly fechaHasta?: string | undefined;
  /** Costo mensual mínimo (inclusive). */
  readonly costoMin?: number | undefined;
  /** Costo mensual máximo (inclusive). */
  readonly costoMax?: number | undefined;
  /** Tipo de línea exacto. */
  readonly tipoLinea?: TipoLinea | undefined;
  /** Búsqueda parcial del empleado. */
  readonly empleado?: string | undefined;
  /** Estado exacto de la línea. */
  readonly estado?: EstadoLinea | undefined;
  /** Tipo de uso exacto. */
  readonly tipoUso?: TipoUso | undefined;
}

/** Parámetros de listado de líneas. */
export interface OpcionesListadoLineas extends FiltrosLinea, PaginacionCursor {
  /** Columna de ordenamiento; por defecto `created_at`. */
  readonly sortColumn?: ColumnaOrdenLinea | undefined;
  /** Dirección del ordenamiento; por defecto `desc`. */
  readonly sortOrder?: DireccionOrden | undefined;
}

/** Línea telefónica junto con los datos de su centro de coste. */
export interface LineaListado {
  readonly linea: LineaTelefonica;
  readonly centroCosteCodigo: string;
  readonly centroCosteNombre: string;
}

/** Fila plana de exportación de líneas (RF-LIN-EXP-1.2). */
export interface LineaExportRow {
  readonly numero: string;
  readonly numeroOriginal: string;
  readonly proveedor: string;
  readonly centroCosteCodigo: string;
  readonly centroCosteNombre: string;
  readonly fechaAsignacion: string;
  readonly costoMensual: string;
  readonly tipoLinea: string;
  readonly empleado: string | null;
  readonly estado: string;
  readonly tipoUso: string;
  readonly createdAt: Date;
}

/** Resultado de un cambio de estado masivo. */
export interface ResultadoCambioEstadoMasivo {
  /** Líneas que quedaron en el estado pedido. */
  readonly actualizados: number;
  /** Líneas que ya estaban en ese estado (operación idempotente). */
  readonly sinCambios: number;
  /** Ids que no existen en la base de datos. */
  readonly noEncontrados: number;
}

/**
 * Puerto de persistencia de líneas telefónicas.
 */
export interface LineaRepository {
  /** Persiste una línea nueva y devuelve la entidad con el id de la base de datos. */
  crear(linea: LineaTelefonica): Promise<LineaTelefonica>;

  /**
   * Inserta varias líneas dentro de una sola transacción: si alguna falla, no se inserta
   * ninguna (todo-o-nada).
   */
  crearMuchas(lineas: LineaTelefonica[]): Promise<LineaTelefonica[]>;

  /** Busca una línea por id; `null` si no existe. */
  buscarPorId(id: string): Promise<LineaTelefonica | null>;

  /** Busca una línea activa (no dada de baja) por número normalizado. */
  buscarPorNumero(numero: string): Promise<LineaTelefonica | null>;

  /**
   * Busca varias líneas activas (no dadas de baja) por número normalizado.
   *
   * Se usa en la importación de líneas para detectar duplicados en una sola consulta.
   */
  buscarPorNumeros(numeros: string[]): Promise<LineaTelefonica[]>;

  /** Lista líneas con los 14 filtros, ordenamiento y paginación por cursor. */
  listar(opciones: OpcionesListadoLineas): Promise<PaginaCursor<LineaListado>>;

  /**
   * Actualiza una línea aplicando *optimistic locking*.
   *
   * @returns la entidad actualizada, o `null` si no existe o la versión no coincide.
   */
  actualizar(linea: LineaTelefonica, versionEsperada: number): Promise<LineaTelefonica | null>;

  /**
   * Cambia el estado de varias líneas dentro de una transacción.
   *
   * Pasar a `baja` performs la baja lógica (`deleted_at`); las líneas que ya estaban de
   * baja se cuentan como `sinCambios` (idempotencia, Q3 de la spec).
   */
  actualizarEstadoMasivo(
    ids: string[],
    estado: EstadoLinea,
    ahora: Date
  ): Promise<ResultadoCambioEstadoMasivo>;

  /**
   * Cuenta las líneas asociadas a un centro de coste (incluidas las dadas de baja).
   *
   * Se usa para impedir el borrado de un centro de coste que todavía tiene líneas
   * (RF-CC-1.5).
   */
  contarPorCentroCoste(centroCosteId: string): Promise<number>;

  /**
   * Exporta líneas usando los mismos filtros del listado, sin paginación.
   *
   * @param incluirBajas `true` incluye también las líneas dadas de baja lógicamente.
   */
  exportar(filtros: FiltrosLinea, incluirBajas: boolean): Promise<LineaExportRow[]>;
}

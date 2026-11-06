import type { CentroCoste } from '@domain/entities/CentroCoste.js';

import type { PaginaCursor, PaginacionCursor } from './paginacion.js';

/** Filtros disponibles para listar centros de coste. */
export interface FiltrosCentroCoste {
  /** Búsqueda parcial del código (case-insensitive). */
  readonly codigo?: string | undefined;
  /** Búsqueda parcial del nombre (case-insensitive). */
  readonly nombre?: string | undefined;
  /** Filtro exacto por formato asociado. */
  readonly formatoId?: string | undefined;
  /**
   * Búsqueda libre por código **o** nombre (case-insensitive).
   *
   * Pensada para el buscador de la UI: con cientos de centros de coste no es
   * viable cargarlos todos en el cliente, así que el filtrado se hace en la base
   * de datos.
   */
  readonly busqueda?: string | undefined;
}

/** Parámetros de listado de centros de coste. */
export interface OpcionesListadoCentroCoste extends FiltrosCentroCoste, PaginacionCursor {}

/** Centro de coste junto al nombre de su formato (para exportaciones y vistas). */
export interface CentroCosteConFormato {
  readonly centro: CentroCoste;
  readonly formatoNombre: string;
}

/**
 * Puerto de persistencia de centros de coste.
 */
export interface CentroCosteRepository {
  /** Persiste un centro de coste nuevo y devuelve la entidad con el id de la base de datos. */
  crear(centroCoste: CentroCoste): Promise<CentroCoste>;

  /** Busca un centro de coste por id; `null` si no existe. */
  buscarPorId(id: string): Promise<CentroCoste | null>;

  /** Busca un centro de coste por código, ignorando mayúsculas y minúsculas. */
  buscarPorCodigo(codigo: string): Promise<CentroCoste | null>;

  /**
   * Busca varios centros de coste por código, ignorando mayúsculas y minúsculas.
   *
   * Se usa en la importación de líneas para resolver todos los `centro_coste_codigo` del
   * archivo en una sola consulta.
   */
  buscarPorCodigos(codigos: string[]): Promise<CentroCoste[]>;

  /**
   * Inserta varios centros de coste dentro de una sola transacción: si alguna inserción
   * falla, no se inserta ninguna (todo-o-nada).
   */
  crearMuchos(centrosCoste: CentroCoste[]): Promise<CentroCoste[]>;

  /** Lista centros de coste con filtros y paginación por cursor. */
  listar(opciones: OpcionesListadoCentroCoste): Promise<PaginaCursor<CentroCoste>>;

  /**
   * Actualiza un centro de coste aplicando *optimistic locking*.
   *
   * @returns la entidad actualizada, o `null` si no existe o la versión no coincide.
   */
  actualizar(centroCoste: CentroCoste, versionEsperada: number): Promise<CentroCoste | null>;

  /**
   * Elimina un centro de coste, opcionalmente de forma **condicional por versión**.
   *
   * @param versionEsperada si se indica, el borrado solo se aplica si la fila tiene esa
   * versión (`DELETE ... WHERE id = $1 AND version = $2`); si no coincide, no se borra nada.
   * @returns `false` si no se eliminó ninguna fila (no existe o la versión no coincide).
   */
  eliminar(id: string, versionEsperada?: number): Promise<boolean>;

  /** Cuenta los centros de coste asociados a un formato. */
  contarPorFormato(formatoId: string): Promise<number>;

  /** Lista todos los centros de coste (con el nombre de su formato) para la exportación. */
  listarTodos(filtros?: FiltrosCentroCoste): Promise<CentroCosteConFormato[]>;
}

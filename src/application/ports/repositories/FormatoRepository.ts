import type { Formato } from '@domain/entities/Formato.js';

import type { PaginaCursor, PaginacionCursor } from './paginacion.js';

/**
 * Puerto de persistencia de formatos de importación (ej. "SMU", "FALABELLA").
 *
 * La capa de aplicación solo conoce esta interfaz; la implementación con Drizzle vive en
 * `src/infrastructure/database/repositories/`.
 */
export interface FormatoRepository {
  /** Persiste un formato nuevo y devuelve la entidad con el id asignado por la base de datos. */
  crear(formato: Formato): Promise<Formato>;

  /** Busca un formato por id; `null` si no existe. */
  buscarPorId(id: string): Promise<Formato | null>;

  /** Busca un formato por nombre exacto; `null` si no existe. */
  buscarPorNombre(nombre: string): Promise<Formato | null>;

  /**
   * Busca varios formatos a la vez, ignorando mayúsculas y minúsculas.
   *
   * Se usa en la importación de centros de coste para resolver todos los `formato_nombre`
   * del archivo en una sola consulta.
   */
  buscarPorNombres(nombres: string[]): Promise<Formato[]>;

  /**
   * Lista formatos con paginación por cursor.
   *
   * Orden: `nombre ASC, id ASC`; el cursor keyset viaja sobre `nombre` (RF-FMT-1.3 y RF-ORD-1.4).
   */
  listar(paginacion: PaginacionCursor): Promise<PaginaCursor<Formato>>;

  /**
   * Actualiza un formato aplicando *optimistic locking*.
   *
   * @param versionEsperada versión que el cliente cree tener.
   * @returns la entidad actualizada, o `null` si no existe o la versión no coincide.
   */
  actualizar(formato: Formato, versionEsperada: number): Promise<Formato | null>;

  /**
   * Elimina un formato, opcionalmente de forma **condicional por versión**.
   *
   * @param versionEsperada si se indica, el borrado solo se aplica si la fila tiene esa
   * versión (`DELETE ... WHERE id = $1 AND version = $2`); si no coincide, no se borra nada.
   * @returns `false` si no se eliminó ninguna fila (no existe o la versión no coincide).
   */
  eliminar(id: string, versionEsperada?: number): Promise<boolean>;

  /** Devuelve todos los formatos (sin paginación) para la exportación. */
  listarTodos(): Promise<Formato[]>;
}

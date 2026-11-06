/**
 * Tipos de paginación compartidos por los repositorios.
 *
 * La constitución (regla 11) exige paginación **cursor-based**: el cliente pide la página
 * siguiente enviando el cursor opaco que recibió en la respuesta anterior. No se usa
 * `OFFSET` porque con filtros y ordenamientos variables salta registros o los repite.
 */

/** Página por defecto (spec 001: 20 filas por página). */
export const LIMIT_PAGINACION_POR_DEFECTO = 20;

/** Tope máximo de filas por página para no agotar la base de datos. */
export const LIMIT_PAGINACION_MAXIMO = 100;

/** Parámetros de paginación por cursor. */
export interface PaginacionCursor {
  /** Cursor opaco devuelto por la página anterior (`null` en la primera página). */
  readonly afterId?: string | undefined;
  /** Cantidad máxima de elementos a devolver. */
  readonly limit?: number | undefined;
}

/** Resultado de una consulta paginada por cursor. */
export interface PaginaCursor<T> {
  /** Elementos de la página actual. */
  readonly items: T[];
  /** Cursor de la página siguiente, o `null` si no hay más resultados. */
  readonly nextCursor: string | null;
  /** `true` cuando existen más elementos después de esta página. */
  readonly hasNextPage: boolean;
  /** Total de elementos que coinciden con los filtros de la consulta paginada. */
  readonly totalCount: number;
}

/**
 * Normaliza el límite pedido: usa el valor por defecto cuando no se informa y lo acota al
 * máximo permitido.
 */
export function normalizarLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return LIMIT_PAGINACION_POR_DEFECTO;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return LIMIT_PAGINACION_POR_DEFECTO;
  }

  return Math.min(limit, LIMIT_PAGINACION_MAXIMO);
}

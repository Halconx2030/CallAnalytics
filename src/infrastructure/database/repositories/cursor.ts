import { sql, type SQL } from 'drizzle-orm';

import { ValidationError } from '@domain/errors/DomainError.js';

/** Contenido de un cursor de paginación. */
export interface CursorPayload {
  /** Valor de la columna de ordenamiento de la última fila entregada. */
  readonly v: string;
  /** Id de la última fila entregada (desempate). */
  readonly id: string;
  /** Columna de ordenamiento a la que pertenece el valor `v`. */
  readonly c: string;
}

/** Codifica el cursor de la página siguiente (base64url opaco para el cliente). */
export function codificarCursor(valor: string, id: string, columna: string): string {
  const payload: CursorPayload = { v: valor, id, c: columna };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decodifica un cursor recibido del cliente.
 *
 * El cursor lleva la columna de ordenamiento (`c`) en la que fue emitido: si no coincide con
 * la que espera el listado actual se rechaza, porque comparar el valor con otra columna
 * devolvería una página incorrecta sin error visible.
 *
 * @throws {ValidationError} si el cursor no tiene el formato esperado, si es de otra columna
 * o si es un cursor legado sin columna.
 */
export function decodificarCursor(cursor: string, columnaEsperada: string): CursorPayload {
  try {
    const texto = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(texto);

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('cursor inválido');
    }

    const { v, id, c } = parsed as Record<string, unknown>;

    if (typeof v !== 'string' || typeof id !== 'string' || id === '' || c !== columnaEsperada) {
      throw new Error('cursor inválido');
    }

    return { v, id, c };
  } catch {
    throw new ValidationError('afterId', 'no es un cursor de paginación válido');
  }
}

/**
 * Construye el predicado *keyset* que permite continuar la paginación después de la fila
 * identificada por el cursor.
 *
 * La comparación es por tupla `(columna, id)`: si el valor de la columna coincide se
 * desempata por id, de modo que nunca se repiten ni se saltan filas.
 */
export function predicadoKeyset(
  expresion: SQL,
  idExpresion: SQL,
  tipo: string,
  valor: string,
  id: string,
  ascendente: boolean
): SQL {
  const operador = ascendente ? '>' : '<';

  return sql`(${expresion}, ${idExpresion}) ${sql.raw(operador)} (${valor}::${sql.raw(tipo)}, ${id}::uuid)`;
}

/**
 * Construye el `ORDER BY` estable: columna de ordenamiento y desempate por id, siempre en la
 * misma dirección.
 */
export function ordenKeyset(expresion: SQL, idExpresion: SQL, ascendente: boolean): SQL {
  const direccion = ascendente ? 'ASC' : 'DESC';
  return sql`${expresion} ${sql.raw(direccion)}, ${idExpresion} ${sql.raw(direccion)}`;
}

/**
 * Construye un `ILIKE` escapando los comodines `%` y `_` del valor buscado, para que el
 * usuario pueda filtrar literalmente por ellos.
 */
export function ilikeSeguro(expresion: SQL, valor: string): SQL {
  const escapado = valor.replace(/([\\%_])/g, '\\$1');
  return sql`${expresion} ILIKE ${`%${escapado}%`} ESCAPE '\\'`;
}

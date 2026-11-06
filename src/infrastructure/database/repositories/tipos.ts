import type * as schema from '../schema/index.js';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsDatabase, PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

/** Cliente Drizzle con conexión directa a la base de datos. */
export type ClienteDrizzle = PostgresJsDatabase<typeof schema>;

/** Transacción Drizzle en curso (si se abre dentro de otra, usa SAVEPOINT). */
export type TransaccionDrizzle = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

/**
 * Fuente de datos de los repositorios: la conexión directa o una transacción en curso.
 *
 * Permite que un repositorio funcione dentro de la transacción de la unidad de trabajo
 * (importación de centros con creación automática de formatos).
 */
export type FuenteDrizzle = ClienteDrizzle | TransaccionDrizzle;

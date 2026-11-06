import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import { env } from '@config/env.js';

import * as schema from './schema/index.js';

/** Cliente postgres.js (lazy: no abre conexiones hasta la primera consulta). */
export const sqlClient: Sql = postgres(env.DATABASE_URL, {
  max: env.DATABASE_POOL_SIZE,
  ssl: env.DATABASE_SSL ? 'require' : false,
  onnotice: () => undefined,
});

/** Instancia Drizzle tipada con el schema completo del proyecto. */
export const db: PostgresJsDatabase<typeof schema> = drizzle(sqlClient, { schema });

/** Cierra el pool de conexiones. Debe llamarse al apagar la aplicación. */
export async function closeDatabase(): Promise<void> {
  await sqlClient.end({ timeout: 5 });
}

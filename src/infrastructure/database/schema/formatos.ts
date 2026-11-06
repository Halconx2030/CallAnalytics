import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** Tabla de formatos de importación de líneas telefónicas. */
export const formatos = pgTable('formatos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: varchar('nombre', { length: 100 }).notNull().unique(),
  /** Optimistic locking (constitución, regla 10). */
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Fila de la tabla `formatos` tal como se lee de la base de datos. */
export type FormatoRow = typeof formatos.$inferSelect;

/** Datos para insertar una fila en `formatos`. */
export type NewFormato = typeof formatos.$inferInsert;

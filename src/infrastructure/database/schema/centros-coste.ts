import { foreignKey, index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { formatos } from './formatos.js';

/** Tabla de centros de coste; cada centro pertenece a un formato. */
export const centrosCoste = pgTable(
  'centros_coste',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codigo: varchar('codigo', { length: 50 }).notNull().unique(),
    nombre: varchar('nombre', { length: 200 }).notNull(),
    formatoId: uuid('formato_id').notNull(),
    /** Optimistic locking (constitución, regla 10). */
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fkCentroFormato: foreignKey({
      name: 'fk_centro_formato',
      columns: [table.formatoId],
      foreignColumns: [formatos.id],
    }).onDelete('restrict'),
    idxCentroFormato: index('idx_centro_formato').on(table.formatoId),
  })
);

/** Fila de la tabla `centros_coste` tal como se lee de la base de datos. */
export type CentroCosteRow = typeof centrosCoste.$inferSelect;

/** Datos para insertar una fila en `centros_coste`. */
export type NewCentroCoste = typeof centrosCoste.$inferInsert;

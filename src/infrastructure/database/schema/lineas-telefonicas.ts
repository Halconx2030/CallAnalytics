import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { centrosCoste } from './centros-coste.js';

/** Tabla de líneas telefónicas (soft delete vía `deleted_at`). */
export const lineasTelefonicas = pgTable(
  'lineas_telefonicas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Número normalizado E.164 chileno: +569XXXXXXXX o +56XXXXXXXXX. */
    numero: varchar('numero', { length: 20 }).notNull(),
    /** Número tal como venía en el archivo de importación. */
    numeroOriginal: varchar('numero_original', { length: 50 }).notNull(),
    proveedor: varchar('proveedor', { length: 100 }).notNull().default(''),
    centroCosteId: uuid('centro_coste_id').notNull(),
    fechaAsignacion: date('fecha_asignacion').notNull(),
    costoMensual: numeric('costo_mensual', { precision: 10, scale: 2 }).notNull().default('0'),
    tipoLinea: varchar('tipo_linea', { length: 10 }).notNull(),
    empleado: varchar('empleado', { length: 100 }),
    estado: varchar('estado', { length: 20 }).notNull().default('pendiente'),
    tipoUso: varchar('tipo_uso', { length: 20 }).notNull().default('personal'),
    /** Optimistic locking (constitución, regla 10). */
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    fkLineaCentro: foreignKey({
      name: 'fk_linea_centro',
      columns: [table.centroCosteId],
      foreignColumns: [centrosCoste.id],
    }).onDelete('restrict'),
    /** Unicidad de `numero` solo entre líneas no dadas de baja (soft delete). */
    uqLineaNumeroActiva: uniqueIndex('uq_linea_numero_activa')
      .on(table.numero)
      .where(sql`deleted_at IS NULL`),
    idxLineaCentroCoste: index('idx_linea_centro_coste').on(table.centroCosteId),
    idxLineaEstado: index('idx_linea_estado').on(table.estado),
    idxLineaTipoUso: index('idx_linea_tipo_uso').on(table.tipoUso),
    idxLineaFechaAsignacion: index('idx_linea_fecha_asignacion').on(table.fechaAsignacion),
    idxLineaProveedor: index('idx_linea_proveedor').on(table.proveedor),
    idxLineaEmpleado: index('idx_linea_empleado').on(table.empleado),
    ckLineaCostoMensual: check('ck_linea_costo_mensual', sql`${table.costoMensual} >= 0`),
    ckLineaTipoLinea: check('ck_linea_tipo_linea', sql`${table.tipoLinea} in ('movil', 'fijo')`),
    ckLineaEstado: check(
      'ck_linea_estado',
      sql`${table.estado} in ('activa', 'baja', 'pendiente', 'portabilidad')`
    ),
    ckLineaTipoUso: check(
      'ck_linea_tipo_uso',
      sql`${table.tipoUso} in ('personal', 'geovictoria')`
    ),
  })
);

/** Fila de la tabla `lineas_telefonicas` tal como se lee de la base de datos. */
export type LineaTelefonicaRow = typeof lineasTelefonicas.$inferSelect;

/** Datos para insertar una fila en `lineas_telefonicas`. */
export type NewLineaTelefonica = typeof lineasTelefonicas.$inferInsert;

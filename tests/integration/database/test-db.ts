import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';

import * as schema from '@infrastructure/database/schema/index.js';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

const DIRECTORIO_RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const RUTA_MIGRACION = path.join(
  DIRECTORIO_RAIZ,
  'src/infrastructure/database/migrations/0000_initial_schema.sql'
);

/** Nombre de la base de datos usada en los tests de integración. */
export const NOMBRE_BASE_PRUEBAS = 'telefono2_test';

const URL_BASE =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/telefono2';

/** URL de la base de pruebas (misma instancia, base distinta). */
export function urlBasePruebas(): string {
  const url = new URL(URL_BASE);
  url.pathname = `/${NOMBRE_BASE_PRUEBAS}`;
  return url.toString();
}

/**
 * Crea la base de pruebas si no existe.
 *
 * En esta máquina no hay Docker, por lo que los tests de integración usan el PostgreSQL
 * local en lugar de Testcontainers. Nunca se toca la base de desarrollo.
 */
export async function asegurarBaseDePruebas(): Promise<void> {
  const url = new URL(URL_BASE);
  url.pathname = '/postgres';

  const admin = postgres(url.toString(), { max: 1 });

  try {
    const existentes = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${NOMBRE_BASE_PRUEBAS}
    `;

    if (existentes.length === 0) {
      await admin.unsafe(`CREATE DATABASE ${NOMBRE_BASE_PRUEBAS}`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/** Aplica la migración inicial sobre la base de pruebas. */
export async function aplicarMigracion(cliente: Sql): Promise<void> {
  const contenido = readFileSync(RUTA_MIGRACION, 'utf8');
  const sentencias = contenido
    .split('--> statement-breakpoint')
    .map((sentencia) => sentencia.trim())
    .filter((sentencia) => sentencia.length > 0);

  for (const sentencia of sentencias) {
    await cliente.unsafe(sentencia);
  }
}

/** Vacía las tablas de negocio. */
export async function limpiarTablas(cliente: Sql): Promise<void> {
  await cliente.unsafe(
    'TRUNCATE TABLE formatos, centros_coste, lineas_telefonicas RESTART IDENTITY CASCADE'
  );
}

/** Base de datos de pruebas ya migrada. */
export interface BaseDePruebas {
  /** Instancia Drizzle apuntando a la base de pruebas. */
  db: PostgresJsDatabase<typeof schema>;
  /** Cliente postgres.js subyacente. */
  cliente: Sql;
  /** Vacía las tablas de negocio. */
  limpiar: () => Promise<void>;
  /** Cierra el pool de conexiones. */
  cerrar: () => Promise<void>;
}

/** Prepara la base de pruebas: la crea, migra y devuelve el cliente Drizzle. */
export async function crearBaseDePruebas(): Promise<BaseDePruebas> {
  await asegurarBaseDePruebas();

  const cliente = postgres(urlBasePruebas(), { max: 5, onnotice: () => undefined });
  await aplicarMigracion(cliente);

  const db = drizzle(cliente, { schema });

  return {
    db,
    cliente,
    limpiar: () => limpiarTablas(cliente),
    cerrar: () => cliente.end({ timeout: 5 }),
  };
}

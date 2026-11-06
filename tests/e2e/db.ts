import { readFileSync } from 'node:fs';
import path from 'node:path';

import postgres from 'postgres';

/** Base de datos usada por los tests E2E (nunca la de desarrollo). */
export const NOMBRE_BASE_PRUEBAS = 'telefono2_test';

const URL_BASE =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/telefono2';

const RUTA_MIGRACION = path.resolve(
  process.cwd(),
  'src/infrastructure/database/migrations/0000_initial_schema.sql'
);

/** URL de la base de pruebas. */
export function urlBasePruebas(): string {
  const url = new URL(URL_BASE);
  url.pathname = `/${NOMBRE_BASE_PRUEBAS}`;

  return url.toString();
}

/** Crea la base de pruebas si no existe. */
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

/** Aplica la migración inicial (es idempotente: usa `IF NOT EXISTS`). */
export async function aplicarMigracion(cliente: postgres.Sql): Promise<void> {
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
export async function limpiarTablas(cliente: postgres.Sql): Promise<void> {
  await cliente.unsafe(
    'TRUNCATE TABLE formatos, centros_coste, lineas_telefonicas RESTART IDENTITY CASCADE'
  );
}

/** Prepara la base de pruebas: la crea, migra y la deja vacía. */
export async function prepararBaseDePruebas(): Promise<void> {
  await asegurarBaseDePruebas();

  const cliente = postgres(urlBasePruebas(), { max: 2, onnotice: () => undefined });

  try {
    await aplicarMigracion(cliente);
    await limpiarTablas(cliente);
  } finally {
    await cliente.end({ timeout: 5 });
  }
}

/** Deja la base de pruebas vacía (usado antes de cada test). */
export async function vaciarBaseDePruebas(): Promise<void> {
  const cliente = postgres(urlBasePruebas(), { max: 2, onnotice: () => undefined });

  try {
    await limpiarTablas(cliente);
  } finally {
    await cliente.end({ timeout: 5 });
  }
}

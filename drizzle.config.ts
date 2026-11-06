import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';

import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: '.env' });

/**
 * Workaround para drizzle-kit 0.24.
 *
 * drizzle-kit compila el schema a CJS con esbuild-register y lo carga con
 * `require()`, que no aplica la sustitución `./x.js` → `./x.ts` que exige
 * `moduleResolution: NodeNext` en este proyecto. Sin este parche,
 * `pnpm db:generate` y `pnpm db:migrate` fallan con `Cannot find module './x.js'`.
 *
 * Además, drizzle-kit restaura `Module._resolveFilename` al terminar de cargar
 * la config, así que se define como accessor para que esa restauración no
 * desinstale el parche. Solo interviene cuando la resolución nativa falla,
 * el specifier termina en `.js` y existe el `.ts` hermano; en cualquier otro
 * caso se propaga el error original.
 */
type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown
) => string;

const moduleInternals = Module as unknown as { _resolveFilename: ResolveFilename };
const nativeResolveFilename = moduleInternals._resolveFilename;

const patchedResolveFilename = function patchedResolveFilename(
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown
): string {
  try {
    return nativeResolveFilename.call(Module, request, parent, isMain, options);
  } catch (error) {
    if (!request.endsWith('.js') || parent?.filename === undefined) {
      throw error;
    }

    const candidate = path.resolve(path.dirname(parent.filename), `${request.slice(0, -3)}.ts`);
    if (!fs.existsSync(candidate)) {
      throw error;
    }

    return nativeResolveFilename.call(Module, candidate, parent, isMain, options);
  }
};

Object.defineProperty(Module, '_resolveFilename', {
  configurable: true,
  get: () => patchedResolveFilename,
  // drizzle-kit guarda y restaura el resolver original; se ignora la escritura.
  set: () => undefined,
});

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/database/schema/**/*.ts',
  out: './src/infrastructure/database/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/telefono2',
  },
  verbose: true,
  strict: true,
});

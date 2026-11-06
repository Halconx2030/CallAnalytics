import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'rollup-plugin-tsconfig-paths';
import { defineConfig } from 'tsdown';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resuelve los imports relativos escritos con extensión `.js`.
 *
 * El proyecto usa `moduleResolution: NodeNext`, por lo que los imports de TypeScript
 * llevan `.js` aunque el archivo real sea `.ts`. Sin este plugin, el bundler no
 * encuentra los módulos y los deja como dependencias externas (el bundle no arranca).
 */
const resolverExtensionJs = {
  name: 'resolver-extension-js',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.js') || importer === undefined) {
      return null;
    }

    const base = path.resolve(path.dirname(importer), source.slice(0, -'.js'.length));

    for (const extension of ['.ts', '.tsx']) {
      if (fs.existsSync(`${base}${extension}`)) {
        return `${base}${extension}`;
      }
    }

    if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
      return null;
    }

    return null;
  },
};

export default defineConfig({
  entry: 'src/app.ts',
  platform: 'node',
  format: 'esm',
  outDir: 'dist',
  // El proyecto es una aplicación (no una librería): no se publican tipos.
  // Con `dts: true`, tsdown exige `isolatedDeclarations` y obliga a anotar
  // explícitamente cada export (incluidas las tablas de Drizzle), lo que
  // degrada la inferencia de tipos sin beneficio para este caso de uso.
  dts: false,
  sourcemap: true,
  clean: true,
  plugins: [tsconfigPaths(), resolverExtensionJs],
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
});

# ADR-006 · Lint y formato: ESLint 9 + Prettier 3

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

Se necesita un estándar único y verificable en CI, sobre un código TypeScript estricto con imports ordenados.

## Decisión

- **ESLint 9** en configuración plana (`eslint.config.js`) con `typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-unused-imports` y `eslint-config-prettier`.
- **Prettier 3** como formateador único (`.prettierrc`: `singleQuote`, `printWidth` 100, `tabWidth` 2, `trailingComma` es5).
- `prettier-plugin-organize-imports` **se eliminó**: peleaba con la regla `import/order` de ESLint. Ahora ESLint es el único responsable del orden de imports.
- `.prettierignore` excluye artefactos generados: `node_modules/`, `dist/`, `coverage/`, `pnpm-lock.yaml` y `src/infrastructure/database/migrations/meta/`.
- El ESLint de la raíz ignora `presentation/**` (la SPA tiene su propio `tsconfig` y su propio lint).

## Consecuencias

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test` son los 4 comandos que el CI debe dejar en verde.

## Alternativas descartadas

- **Biome**: muy rápido, pero menos maduro con los plugins de TypeScript actuales.
- **StandardJS**: sin soporte de TypeScript.

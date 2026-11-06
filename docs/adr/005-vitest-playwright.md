# ADR-005 · Estrategia de pruebas: Vitest + Playwright

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

El proyecto tiene tres capas con riesgos distintos: reglas de dominio puras, servicios que dependen de puertos y un flujo web completo (importar archivo → ver reporte → ver KPIs).

## Decisión

- **Vitest 2** para tests unitarios e integración (`*.test.ts`): `tests/unit/`, `tests/integration/database/`, `tests/integration/http/`.
- **Playwright** para E2E (`*.spec.ts`): `tests/e2e/`.
- Cobertura mínima: **80% statements / 70% branches** en `src/domain/` y `src/application/` (v8).
- `@vitest/coverage-v8` y `vitest-mock-extended` para mocks de puertos.
- Testcontainers está declarado como dependencia, pero **esta máquina no tiene Docker**: los tests de integración usan el PostgreSQL local con una base separada `telefono2_test` (helper `tests/integration/database/test-db.ts`).

## Consecuencias

- `vitest.config.ts` usa `fileParallelism: false` porque los tests de integración comparten la misma base de pruebas.
- Los E2E levantan la API (3000) y la SPA (5173) con `webServer` de Playwright y truncan las tablas entre tests.
- El `setup` global no usa timers falsos: bloqueaban las conexiones a Postgres.

## Alternativas descartadas

- **Jest**: más lento con ESM y sin `expect` matching tan ergonomico.
- **Cypress**: peor soporte de multi-tab y de descargas de archivo.
- **Testing Library + jsdom**: se reserva (si hiciera falta) para componentes; la cobertura real de UI se hace con Playwright.

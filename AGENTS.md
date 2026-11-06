# AGENTS.md — TELEFONO 2

Proyecto: **TELEFONO 2** — Control de Líneas Telefónicas
Stack: **Node.js 20+ / TypeScript 5 / Fastify / PostgreSQL / Drizzle / Vitest / pnpm**

## Comandos Exactos

| Acción                        | Comando                             |
| ----------------------------- | ----------------------------------- |
| Instalar dependencias         | `pnpm install`                      |
| Tests unitarios + integración | `pnpm test`                         |
| Tests en modo watch           | `pnpm test:watch`                   |
| Tests con coverage            | `pnpm test:coverage`                |
| Tests E2E                     | `pnpm test:e2e`                     |
| Lint (ESLint)                 | `pnpm lint`                         |
| Lint + fix                    | `pnpm lint:fix`                     |
| Format (Prettier)             | `pnpm format`                       |
| Format check                  | `pnpm format:check`                 |
| Type-check (tsc)              | `pnpm typecheck`                    |
| Build producción              | `pnpm build`                        |
| Dev server (hot reload)       | `pnpm dev`                          |
| DB: generar migración         | `pnpm db:generate`                  |
| DB: aplicar migraciones       | `pnpm db:migrate`                   |
| DB: studio (Drizzle)          | `pnpm db:studio`                    |
| DB: seed                      | `pnpm db:seed`                      |
| DB: reset (drop + migrate)    | `pnpm db:reset`                     |
| SPA: dev server (puerto 5173) | `pnpm --dir presentation dev`       |
| SPA: build                    | `pnpm --dir presentation build`     |
| SPA: type-check               | `pnpm --dir presentation typecheck` |

## Arquitectura

```
src/
├── app.ts                 # Entry point Fastify
├── config/                # Configuración (env, constants)
├── domain/                # Entidades, value objects, reglas de negocio puras
│   ├── entities/          # Linea, Proveedor, Region, Historial
│   ├── value-objects/     # PhoneNumber, EstadoLinea, etc.
│   └── events/            # Domain events
├── application/           # Casos de uso (services), puertos (interfaces)
│   ├── services/          # LineaService, ImportService, etc.
│   └── ports/             # Repositories interfaces
├── infrastructure/        # Adaptadores concretos
│   ├── database/          # Drizzle schema, repositories, migrations
│   ├── http/              # Fastify routes, schemas (Zod), middleware
│   └── external/          # Proveedores externos (si aplica)
presentation/               # SPA React + Vite (paquete propio del workspace pnpm)
docs/adr/                  # ADRs de decisiones de stack
```

**Regla de dependencias**: `domain` → `application` → `infrastructure`. Nunca al revés.
La SPA (`presentation/`) es un paquete independiente del workspace: consume la API por HTTP y nunca importa código de `src/`.

## Quirks y Convenciones

- **Normalización de teléfonos**: Única función `normalizePhone()` en `domain/value-objects/PhoneNumber.ts`. Ningún otro archivo transforma números.
- **Migraciones inmutables**: `pnpm db:generate` crea archivo en `src/infrastructure/database/migrations/`. Nunca edites una aplicada.
- **Variables de entorno**: `.env` (local), `.env.test` (tests), `.env.production`. Validadas con Zod en `config/env.ts` (se carga con `dotenv/config`; los booleanos usan un transform propio, nunca `z.coerce.boolean()`).
- **Tests**: Unitarios en `tests/unit/`, integración en `tests/integration/`, E2E en `tests/e2e/`. Fixtures en `tests/fixtures/`.
- **Sin Docker en la máquina**: los tests de integración y E2E usan el PostgreSQL local con la base `telefono2_test` (`tests/integration/database/test-db.ts` y `tests/e2e/db.ts`).
- **Paginación por cursor**: los listados usan `after_id` (keyset), nunca `OFFSET`; `limit` máximo 100 (schema HTTP).
- **OpenAPI**: Generado desde Zod schemas en routes. Servido en `/docs` (Swagger UI) y `/openapi.json`.
- **Logging**: Pino (structurado). Nivel via `LOG_LEVEL` env.

## Testing

- **Fixtures**: `tests/fixtures/` con builders; `tests/integration/database/test-db.ts` prepara la base de pruebas.
- **Testcontainers**: `@testcontainers/postgresql` está declarado, pero en esta máquina no hay Docker → se usa PostgreSQL local con la base `telefono2_test`.
- **Mocking**: Solo para dependencias externas (APIs de terceros). Repositorios usan DB real.
- **Naming**: `*.test.ts` para unit/integration, `*.spec.ts` para E2E (Playwright).
- **E2E**: Playwright levanta **sus propios servidores** con `webServer` (`reuseExistingServer: false`): la API en el puerto **3011** (base `telefono2_test`) y la SPA de Vite en el puerto **5183** (proxy `/api` -> `http://localhost:3011`). Por eso `pnpm test:e2e` se puede ejecutar **sin detener el dev server** (API en 3000, SPA en 5173) y nunca toca la base de desarrollo `telefono2`. Los puertos se pueden sobreescribir con `E2E_API_PORT` y `E2E_SPA_PORT`. `pnpm exec playwright install chromium` es requisito previo.
- **Ports de la SPA**: `presentation/vite.config.ts` toma el puerto de `process.env.VITE_PORT` (default `5173`) y el destino del proxy `/api` de `process.env.VITE_API_TARGET` (default `http://localhost:3000`).

## Constraints

- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- **Branches**: `feature/<spec-id>-<slug>`, `fix/<issue>`.
- **PRs**: Requieren CI verde (typecheck, lint, test, build). Mínimo 1 approval.
- **Main**: Protegida, solo merge via PR.
- **Versión**: SemVer en `package.json`. Tags `vX.Y.Z` en releases.

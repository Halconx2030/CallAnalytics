# ADR-007 · Contenerización: Dockerfile multi-stage

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

El proyecto debe poder desplegarse en un entorno limpio con Node y PostgreSQL externos (la base de datos no se incluye en la imagen).

## Decisión

`Dockerfile` multi-stage sobre `node:20-alpine`:

1. **Etapa `deps`**: habilita Corepack e instala dependencias con `pnpm install --frozen-lockfile`.
2. **Etapa `build`**: compila el backend (`pnpm build`) y la SPA (`pnpm --dir presentation build`).
3. **Etapa `runtime`**: usuario sin privilegios (`app`), solo dependencias de producción, migraciones SQL, código compilado del backend y la SPA servida como activos estáticos desde Fastify (`src/infrastructure/http/plugins/spa-static.ts`) con fallback History API hacia `index.html` y `HEALTHCHECK` sobre `/health/live`.

Variables documentadas: `DATABASE_URL`, `DATABASE_SSL`, `LOG_LEVEL`, `CORS_ORIGIN`, `PORT`.

## Consecuencias

- La imagen final no incluye `node_modules` de desarrollo ni las fuentes TypeScript.
- El contenedor único en el puerto `3000` sirve tanto la API (`/api/v1/*`, `/docs`, `/health/*`, `/openapi.json`) como la SPA compilada (`/`, `/lineas`, `/catalogos`, `/importacion`, `/assets/*`).
- `docker-compose.yml` levanta la aplicación junto a un PostgreSQL 16 con inicialización automática del esquema (`0000_initial_schema.sql`) y verificación de disponibilidad (`/health/ready`).

## Alternativas descartadas

- **Una sola etapa**: imagen grande y con herramientas de build en producción.
- **Imagen de aplicación con la base de datos dentro**: no es advisable; el estado debe vivir fuera del contenedor.

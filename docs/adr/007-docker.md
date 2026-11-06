# ADR-007 · Contenerización: Dockerfile multi-stage

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

El proyecto debe poder desplegarse en un entorno limpio con Node y PostgreSQL externos (la base de datos no se incluye en la imagen).

## Decisión

`Dockerfile` multi-stage sobre `node:20-alpine`:

1. **Etapa `deps`**: habilita Corepack y instala dependencias con `pnpm install --frozen-lockfile`.
2. **Etapa `build`**: compila el backend (`pnpm build`) y la SPA (`pnpm --dir presentation build`).
3. **Etapa `runtime`**: solo dependencias de producción, código compilado y la SPA servida como assets estáticos.

Variables documentadas: `DATABASE_URL`, `DATABASE_SSL`, `LOG_LEVEL`, `CORS_ORIGIN`, `PORT`.

## Consecuencias

- La imagen final no incluye `node_modules` de desarrollo ni las fuentes.
- `docker-compose.yml` puede levantar la aplicación junto a un PostgreSQL 16 para desarrollo.

## Alternativas descartadas

- **Una sola etapa**: imagen grande y con herramientas de build en producción.
- **Imagen de aplicación con la base de datos dentro**: no es advisable; el estado debe vivir fuera del contenedor.

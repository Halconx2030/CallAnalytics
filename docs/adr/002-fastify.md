# ADR-002 · Framework web: Fastify 4

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

La API expone el CRUD de formatos, centros de coste y líneas, además de la importación de archivos y la exportación CSV/Excel. Se necesita validación de payloads, serialización, OpenAPI y un manejo de errores uniforme (RFC 7807).

## Decisión

Usar **Fastify 4** con validación tipada mediante `fastify-type-provider-zod@2.1.0` (la versión 3+ exige Fastify 5) y `zod-to-json-schema` para generar el esquema OpenAPI.

- Las rutas se registran bajo el prefijo `/api/v1` (regla 13 de la constitución).
- `buildApp({ db?, silencioso? })` permite inyectar una base de datos alternativa en los tests.
- Plugins: `@fastify/helmet`, `@fastify/cors`, `@fastify/multipart` (límite 10 MB), `@fastify/swagger` + `@fastify/swagger-ui`.

## Consecuencias

- Validación y serialización derivadas de los schemas Zod (fuente única de verdad).
- OpenAPI disponible en `/openapi.json` y Swagger UI en `/docs`.
- El `error-handler` traduce los errores de dominio (`DomainError`) a códigos HTTP y a respuestas RFC 7807.

## Alternativas descartadas

- **Express**: menos rendimiento y sin validación integrada por esquema.
- **NestJS**: demasiado pesado para este tamaño; añade una capa de decoradores y DI.
- **Hono**: excelente rendimiento, pero ecosystem menos maduro con Drizzle/Postgres.

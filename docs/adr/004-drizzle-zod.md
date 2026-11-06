# ADR-004 · ORM Drizzle + validación Zod

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

Se necesita un mapeo objeto-relacional con tipos TypeScript inferidos, migraciones SQL versionadas e inmutables, y un único origen de verdad para la validación de entradas (API, importación y UI).

## Decisión

- **Drizzle ORM 0.33** como ORM: schemas tipados en `src/infrastructure/database/schema/`, consultas con `sql` template y migraciones generadas con `drizzle-kit`.
- **Zod 3** para validar: schemas de la API en `src/infrastructure/http/schemas/`, y validación en la capa de aplicación.
- El dominio (`src/domain/`) es TypeScript puro, sin dependencias de infraestructura.

## Consecuencias

- Los repositorios implementan interfaces (`application/ports/repositories`) y son intercambiables por mocks en los tests unitarios.
- La API, la importación de archivos y la UI comparten el mismo vocabulario de campos en `snake_case`.
- `fastify-type-provider-zod` conecta Zod con Fastify: los schemas de la ruta son la validación y el esquema OpenAPI a la vez.

## Alternativas descartadas

- **TypeORM**: decoradores y metadatos; peor tipado y entidades acopladas al framework.
- **Kysely**: excelente constructor de SQL, pero sin generación de migraciones ni schemas declarativos.
- **Prisma**: motor binario adicional y peor rendimiento en consultas dinámicas con muchos filtros.

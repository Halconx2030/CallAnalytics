# ADR-003 · Base de datos: PostgreSQL 16

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

El modelo tiene 3 tablas con claves foráneas `RESTRICT`, un índice único parcial (`numero` donde `deleted_at IS NULL`), CHECKs de dominio y auditoría inmutable. Se necesita soporte transaccional para la importación masiva y para el cambio de estado masivo.

## Decisión

Usar **PostgreSQL 16** con el driver `postgres` (postgres.js) y el ORM **Drizzle**.

- La unicidad de líneas se garantiza en la base con un índice único parcial, no solo en la aplicación.
- La importación de centros de coste es **todo-o-nada** (una transacción).
- El cambio de estado masivo es transaccional e idempotente para el estado `baja`.
- La auditoría (`linea_historial`) no admite `UPDATE`/`DELETE`.

## Consecuencias

- Los CHECKs y los índices se crean en la migración SQL; `drizzle-kit` 0.24.2 no serializa `check()`, por lo que se añaden a mano (documentado en `MEMORY.md`).
- Las claves foráneas `RESTRICT` impiden borrar formatos con centros asociados y centros con líneas: la API responde 409.

## Alternativas descartadas

- **MySQL/MariaDB**: sin índices únicos parciales (`WHERE`), que son esenciales para la baja lógica.
- **SQLite**: no sirve para pruebas de integración con Testcontainers ni para la concurrencia real.

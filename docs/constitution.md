---

# Constitución del Proyecto TELEFONO 2

## 1. Propósito

Sistema de control de líneas telefónicas para gestión de inventario, asignación y seguimiento de números telefónicos en entornos empresariales.

| Objetivo              | Qué significa en la práctica                                                        |
| --------------------- | ----------------------------------------------------------------------------------- |
| Inventario único      | Una fuente de verdad para todos los números de teléfono de la organización          |
| Trazabilidad completa | Historial de asignaciones, liberaciones y cambios de estado con auditoría           |
| Importación masiva    | Carga de archivos de proveedores (CSV/Excel) con validación y normalización         |
| Consulta rápida       | Búsqueda y filtrado por número, centro de coste, estado, proveedor, rango de fechas |
| Exportación de datos  | Generación de reportes CSV/Excel para análisis externo                              |

## 2. Alcance

**Dentro:**

- CRUD de formatos (ej: "SMU", "FALABELLA")
- CRUD de centros de coste (codigo único, nombre, formato_id)
- CRUD de líneas telefónicas (número, proveedor, centro_coste_id, fecha_asignacion, costo_mensual, tipo_linea, empleado, estado, tipo_uso)
- Importación masiva de centros de coste y líneas desde CSV/Excel
- Normalización automática de números chilenos (E.164: +569XXXXXXXXX móvil / +56XXXXXXXXXX fijo)
- Estados de línea: `activa`, `baja`, `pendiente`, `portabilidad` (default `pendiente`)
- Historial de cambios (auditoría inmutable en `linea_historial`)
- Dashboard KPIs: total, activas, personal, geovictoria
- API REST versionada (`/api/v1/`) + UI server-rendered (Fastify templates)
- Exportación CSV/Excel de líneas, centros de coste y formatos
- Optimistic locking (`version`) en entidades
- Paginación cursor-based
- Sanitización CSV/Excel (inyección de fórmulas)
- Errores estandarizados (RFC 7807)
- Logging estructurado (Pino + correlation_id)

**Fuera:**

- Facturación o rating de llamadas
- Integración con centralitas (PBX) en tiempo real
- Portabilidad automática con operadores
- Gestión de usuarios/permisos (se asume auth externa)
- Multi-tenancy / organizations
- Webhooks o notificaciones push
- Dashboard analítico avanzado (gráficos, tendencias)
- App móvil nativa

## 3. Stack Tecnológico

| Capa            | Elección              | Razón                                        | ADR     |
| --------------- | --------------------- | -------------------------------------------- | ------- |
| Runtime         | Node.js 20+ LTS       | Estándar servidor, amplio ecosistema         | ADR-001 |
| Lenguaje        | TypeScript 5.x        | Tipado estático, refactor seguro             | ADR-001 |
| Gestor paquetes | pnpm 9.x              | Velocidad, disk efficiency, monorepo ready   | ADR-001 |
| Framework web   | Fastify 4.x           | Alto rendimiento, schema validation nativo   | ADR-002 |
| Base de datos   | PostgreSQL 16         | Robusto, JSONB, consultas complejas          | ADR-003 |
| ORM             | Drizzle ORM           | Type-safe, ligero, migraciones SQL nativas   | ADR-004 |
| Validación      | Zod 3.x               | Schema-first, inference TypeScript           | ADR-004 |
| Tests unitarios | Vitest 2.x            | Rápido, compatible Jest, ESM nativo          | ADR-005 |
| Tests E2E       | Playwright            | Cross-browser, fixtures potentes             | ADR-005 |
| Lint/Format     | ESLint 9 + Prettier 3 | Estándar industria, configurable             | ADR-006 |
| Build           | tsdown / tsc          | Bundle optimizado, declaration maps          | ADR-001 |
| Interfaz web    | React 18 + Vite 5     | SPA con filtros, paginación por cursor y E2E | ADR-008 |
| Contenedor      | Docker multi-stage    | Reproducible, tamaño mínimo                  | ADR-007 |

## 4. Reglas del Dominio

1. **Normalización única**: Todo número telefónico pasa por `normalizePhone()` antes de persistirse. Ningún otro punto del código transforma números. Soporta prefijos regionales chilenos (móvil: 9; fijo: 2, 32, 33, 34, 35, 41, 42, 43, 44, 45, 51, 52, 53, 55, 56, 57, 58, 61, 63, 64, 65, 67, 71, 72, 73, 75).
2. **Estados de línea**: `activa`, `baja`, `pendiente`, `portabilidad`. Default `pendiente`. Sin transiciones obligatorias estrictas.
3. **Bajas lógicas**: Nunca `DELETE` sobre líneas. Cambio de estado a `baja` → SET `deleted_at = now()`. `fecha_baja` y `motivo_baja` opcionales.
4. **Unicidad**: Un número normalizado = único entre líneas no dadas de baja (`WHERE deleted_at IS NULL`).
5. **Auditoría obligatoria**: Todo CREATE/UPDATE de línea genera entrada en `linea_historial` con usuario, timestamp, diff.
6. **Importación insert-only**: Re-importar no actualiza existentes; solo inserta nuevas por número único. Reporta duplicados.
7. **Centro de coste obligatorio**: Toda línea telefónica debe pertenecer a un centro de coste válido.
8. **Proveedor como texto libre**: El campo proveedor es string libre (no catálogo referenciado).
9. **Tipos de uso extensibles**: `tipo_uso` admite `personal` | `geovictoria`; extensible vía migración (check constraint).
10. **Optimistic locking**: Campo `version` (int) en Formato, CentroCoste, LineaTelefonica. PUT/DELETE requiere `If-Match: <version>`.
11. **Paginación cursor-based**: Listados usan `after_id` + `limit`; no offset/limit.
12. **Sanitización importación**: Celdas que empiezan con `=`, `+`, `-`, `@` se prefijan con `'` para prevenir inyección.
13. **Errores RFC 7807**: Formato Problem Details estándar.
14. **API versionada**: Todas las rutas bajo `/api/v1/`.
15. **Logging Pino + correlation_id**: Propagado en headers request/response.

## 5. Invariantes de Base de Datos

```sql
-- Unicidad por número normalizado (solo líneas activas)
CREATE UNIQUE INDEX uq_linea_numero_activa ON lineas_telefonicas (numero)
WHERE deleted_at IS NULL;

-- FKs
ALTER TABLE centros_coste ADD CONSTRAINT fk_centro_formato
  FOREIGN KEY (formato_id) REFERENCES formatos(id) ON DELETE RESTRICT;

ALTER TABLE lineas_telefonicas ADD CONSTRAINT fk_linea_centro
  FOREIGN KEY (centro_coste_id) REFERENCES centros_coste(id) ON DELETE RESTRICT;

-- Check constraints
ALTER TABLE lineas_telefonicas ADD CONSTRAINT chk_costo_positivo
  CHECK (costo_mensual >= 0);

ALTER TABLE lineas_telefonicas ADD CONSTRAINT chk_estado_valido
  CHECK (estado IN ('activa','baja','pendiente','portabilidad'));

ALTER TABLE lineas_telefonicas ADD CONSTRAINT chk_tipo_linea_valido
  CHECK (tipo_linea IN ('movil','fijo'));

ALTER TABLE lineas_telefonicas ADD CONSTRAINT chk_tipo_uso_valido
  CHECK (tipo_uso IN ('personal','geovictoria'));

-- Versiones para optimistic locking
ALTER TABLE formatos ADD COLUMN version INT NOT NULL DEFAULT 1;
ALTER TABLE centros_coste ADD COLUMN version INT NOT NULL DEFAULT 1;
ALTER TABLE lineas_telefonicas ADD COLUMN version INT NOT NULL DEFAULT 1;

-- Historial inmutable
CREATE TABLE linea_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id UUID NOT NULL REFERENCES lineas_telefonicas(id) ON DELETE RESTRICT,
  usuario VARCHAR(255) NOT NULL, -- texto si auth externa
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('CREATE','UPDATE','DELETE','IMPORT')),
  diff JSONB NOT NULL, -- { antes: {...}, despues: {...} }
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Sin UPDATE/DELETE en linea_historial
```

## 6. Proceso de Desarrollo

- **Flujo SDD obligatorio**: Constitución → Spec → Clarificar → Plan → Tareas → Implementar → Validar
- **Ninguna fase avanza sin aprobación explícita del usuario** (ver skill `sdd`)
- **Tests first (TDD)**: Escribe test en rojo → implementa → verde → refactor
- **Commits atómicos**: Una tarea = un commit con mensaje convencional
- **Rama principal protegida**: `main` solo via PR con CI verde

## 7. Manejo de Archivos

| Patrón          | Qué hacer                                                        |
| --------------- | ---------------------------------------------------------------- |
| `imports/`      | Archivos subidos por proveedores (gitignored, respaldo S3/local) |
| `exports/`      | Archivos generados para descarga (gitignored, TTL 7 días)        |
| `node_modules/` | Gitignored                                                       |
| `dist/`         | Build output (gitignored)                                        |
| `.env*`         | Gitignored, usar `.env.example` como plantilla                   |
| `coverage/`     | Gitignored                                                       |
| `*.log`         | Gitignored                                                       |

## 8. Pruebas

| Nivel       | Qué exige                                       | Herramienta                       |
| ----------- | ----------------------------------------------- | --------------------------------- |
| Unitario    | Cada función pura, repo, service                | Vitest                            |
| Integración | Rutas API, middleware, DB real (testcontainers) | Vitest + PostgreSQL testcontainer |
| E2E         | Flujos críticos web (import, search, export)    | Playwright                        |
| Contrato    | Schema OpenAPI ↔ implementación                 | `dredd` o similar                 |

**Cobertura mínima**: 80% statements, 70% branches en código de dominio (`src/domain/`, `src/application/`).

## 9. Fuera de Alcance (Postergado)

- Webhooks para notificaciones de cambio de estado
- Multi-tenancy (organizations)
- API GraphQL
- Dashboard analítico avanzado (gráficos, tendencias)
- App móvil nativa

## 10. Referencias

- `docs/adr/001-stack.md` — Decisión de stack Node/TypeScript/pnpm
- `docs/adr/002-fastify.md` — Elección de framework web
- `docs/adr/003-postgresql.md` — Elección de base de datos
- `docs/adr/004-drizzle-zod.md` — ORM y validación
- `docs/adr/005-vitest-playwright.md` — Estrategia de testing
- `docs/adr/006-eslint-prettier.md` — Lint y formato
- `docs/adr/007-docker.md` — Contenerización
- `docs/adr/008-templates.md` — Server-rendered templates
- `AGENTS.md` — Comandos y convenciones de desarrollo
- `MEMORY.md` — Registro de decisiones y estado del proyecto
- `.opencode/skill/sdd/SKILL.md` — Flujo Spec-Driven Development

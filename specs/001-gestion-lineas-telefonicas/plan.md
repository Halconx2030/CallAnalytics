# Plan Técnico — Spec 001: Gestión de Líneas Telefónicas

**Estado**: aprobado
**Fecha**: 2026-11-04
**Spec**: `specs/001-gestion-lineas-telefonicas/spec.md` (aprobada)
**Fecha de aprobación del plan**: 2026-11-05

---

## 1. Mapa RF → Componente

| RF ID           | Descripción                                                                                                                                                                        | Módulo / Componente                                 | Función / Tabla                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| RF-FMT-1.1      | Crear Formato (nombre único)                                                                                                                                                       | `application/services/formato.service.ts`           | `FormatoService.crear()`                                              |
| RF-FMT-1.2      | Rechazar formato duplicado (409)                                                                                                                                                   | `application/services/formato.service.ts`           | `FormatoService.crear()` (constraint BD)                              |
| RF-FMT-1.3      | Listar Formatos ordenados por nombre                                                                                                                                               | `application/services/formato.service.ts`           | `FormatoService.listar()`                                             |
| RF-FMT-1.4      | Eliminar Formato si sin Centros (409 si tiene)                                                                                                                                     | `application/services/formato.service.ts`           | `FormatoService.eliminar()` (FK RESTRICT)                             |
| RF-CC-1.1       | Crear Centro Coste (codigo único, formato_id FK)                                                                                                                                   | `application/services/centro-coste.service.ts`      | `CentroCosteService.crear()`                                          |
| RF-CC-1.2       | Rechazar código duplicado (409)                                                                                                                                                    | `application/services/centro-coste.service.ts`      | `CentroCosteService.crear()` (constraint BD)                          |
| RF-CC-1.3       | Rechazar formato_id inexistente (400)                                                                                                                                              | `application/services/centro-coste.service.ts`      | `CentroCosteService.crear()` (FK check)                               |
| RF-CC-1.4       | Actualizar nombre/formato_id (codigo inmutable)                                                                                                                                    | `application/services/centro-coste.service.ts`      | `CentroCosteService.actualizar()`                                     |
| RF-CC-1.5       | Eliminar Centro si sin Líneas (409 si tiene)                                                                                                                                       | `application/services/centro-coste.service.ts`      | `CentroCosteService.eliminar()` (FK RESTRICT)                         |
| RF-CC-1.6       | Listar Centros paginado (20) + filtros                                                                                                                                             | `application/services/centro-coste.service.ts`      | `CentroCosteService.listar()`                                         |
| RF-CC-IMP-1.1   | Importar Centros CSV/Excel (codigo, nombre, formato_nombre)                                                                                                                        | `application/services/import.service.ts`            | `ImportService.importarCentrosCoste()`                                |
| RF-CC-IMP-1.2   | Validar formato_nombre existe; error → rollback total                                                                                                                              | `application/services/import.service.ts`            | `ImportService.importarCentrosCoste()` (tx)                           |
| RF-CC-IMP-1.3   | Validar código único (BD + archivo); duplicado → rollback                                                                                                                          | `application/services/import.service.ts`            | `ImportService.importarCentrosCoste()` (tx)                           |
| RF-CC-IMP-1.4   | Reporte: insertados, duplicados, errores por fila                                                                                                                                  | `application/services/import.service.ts`            | `ImportService.importarCentrosCoste()`                                |
| RF-CC-IMP-1.5   | Límite 10 MB / 50k filas                                                                                                                                                           | `infrastructure/http/routes/import.routes.ts`       | `multipart` config + validación previa                                |
| RF-LIN-1.1      | Crear Línea (numero normalizado, centro_coste_id FK, campos obligatorios + defaults)                                                                                               | `application/services/linea.service.ts`             | `LineaService.crear()`                                                |
| RF-LIN-1.2      | Rechazar número duplicado activo (409)                                                                                                                                             | `application/services/linea.service.ts`             | `LineaService.crear()` (unique index partial)                         |
| RF-LIN-1.3      | Rechazar centro_coste_id inexistente (400)                                                                                                                                         | `application/services/linea.service.ts`             | `LineaService.crear()` (FK check)                                     |
| RF-LIN-1.4      | Rechazar número inválido (400 + detalle)                                                                                                                                           | `domain/value-objects/PhoneNumber.ts`               | `normalizePhone()` → `InvalidPhoneNumberError`                        |
| RF-LIN-1.5      | Actualizar todos excepto numero/id (inmutables)                                                                                                                                    | `application/services/linea.service.ts`             | `LineaService.actualizar()`                                           |
| RF-LIN-1.6      | Cambio estado individual                                                                                                                                                           | `application/services/linea.service.ts`             | `LineaService.cambiarEstado()`                                        |
| RF-LIN-1.7      | Cambio estado masivo (array ids + estado); transacción; reporte ok/fallidas (idempotente baja)                                                                                     | `application/services/linea.service.ts`             | `LineaService.cambiarEstadoMasivo()`                                  |
| RF-LIN-1.8      | Baja lógica: estado='baja' → deleted_at=now()                                                                                                                                      | `application/services/linea.service.ts`             | `LineaService.cambiarEstado()` + `LineaService.cambiarEstadoMasivo()` |
| RF-LIN-1.9      | Listar Líneas paginado (20) + orden + filtros por campo                                                                                                                            | `application/services/linea.service.ts`             | `LineaService.listar()`                                               |
| RF-LIN-IMP-1.1  | Importar Líneas CSV/Excel (cabeceras completas)                                                                                                                                    | `application/services/import.service.ts`            | `ImportService.importarLineas()`                                      |
| RF-LIN-IMP-1.2  | Solo insertar si numero normalizado NO existe (no bajas)                                                                                                                           | `application/services/import.service.ts`            | `ImportService.importarLineas()` (check BD)                           |
| RF-LIN-IMP-1.3  | Duplicados → reporte, no actualizan existente                                                                                                                                      | `application/services/import.service.ts`            | `ImportService.importarLineas()`                                      |
| RF-LIN-IMP-1.4  | Crear línea solo con numero; defaults + inferir tipo_linea                                                                                                                         | `application/services/import.service.ts`            | `ImportService.importarLineas()` + `normalizePhone()`                 |
| RF-LIN-IMP-1.5  | centro_coste_codigo inexistente → error fila                                                                                                                                       | `application/services/import.service.ts`            | `ImportService.importarLineas()`                                      |
| RF-LIN-IMP-1.6  | Sin centro_coste_codigo NI centro_coste_id → error                                                                                                                                 | `application/services/import.service.ts`            | `ImportService.importarLineas()`                                      |
| RF-LIN-IMP-1.7  | Validar fecha, costo≥0, enums estado/tipo_uso/tipo_linea                                                                                                                           | `application/services/import.service.ts`            | `ImportService.importarLineas()` (Zod schema)                         |
| RF-LIN-IMP-1.8  | Reporte: insertados, duplicados (numero+motivo), errores (fila+numero+motivo)                                                                                                      | `application/services/import.service.ts`            | `ImportService.importarLineas()`                                      |
| RF-LIN-IMP-1.9  | Transacción: errores validación → rollback total; duplicados NO bloquean                                                                                                           | `application/services/import.service.ts`            | `ImportService.importarLineas()` (tx savepoint)                       |
| RF-LIN-IMP-1.10 | Límite 10 MB / 50k filas                                                                                                                                                           | `infrastructure/http/routes/import.routes.ts`       | `multipart` config + validación previa                                |
| RF-LIN-EXP-1.1  | GET /api/lineas/export (filtros = listado)                                                                                                                                         | `infrastructure/http/routes/linea.routes.ts`        | `LineaController.exportar()`                                          |
| RF-LIN-EXP-1.2  | Columnas export: numero, numero_original, proveedor, centro_coste_codigo, centro_coste_nombre, fecha_asignacion, costo_mensual, tipo_linea, empleado, estado, tipo_uso, created_at | `application/services/linea.service.ts`             | `LineaService.exportar()` (query con JOIN)                            |
| RF-LIN-EXP-1.3  | Param incluir_bajas=true                                                                                                                                                           | `application/services/linea.service.ts`             | `LineaService.exportar()`                                             |
| RF-LIN-EXP-1.4  | Nombre archivo: lineas_YYYYMMDD_HHMMSS.csv/.xlsx                                                                                                                                   | `infrastructure/http/routes/linea.routes.ts`        | `Content-Disposition` header                                          |
| RF-DASH-1.1     | GET /api/dashboard/kpis (total, activas, personal, geovictoria)                                                                                                                    | `application/services/dashboard.service.ts`         | `DashboardService.obtenerKPIs()`                                      |
| RF-DASH-1.2     | KPIs tiempo real (sin caché persistente)                                                                                                                                           | `application/services/dashboard.service.ts`         | `DashboardService.obtenerKPIs()` (COUNT queries)                      |
| RF-UI-LIN-1.1   | Tabla paginada 20 filas + columnas definidas                                                                                                                                       | `presentation/` (React SPA)                         | `LineasTable` component                                               |
| RF-UI-LIN-1.2   | Filtros por columna (input/select/date/range)                                                                                                                                      | `presentation/` (React SPA)                         | `LineasFilters` component                                             |
| RF-UI-LIN-1.3   | Modal crear línea (validación cliente + servidor)                                                                                                                                  | `presentation/` (React SPA)                         | `LineaFormModal` (create)                                             |
| RF-UI-LIN-1.4   | Modal editar línea (pre-poblado)                                                                                                                                                   | `presentation/` (React SPA)                         | `LineaFormModal` (edit)                                               |
| RF-UI-LIN-1.5   | Botón "Dar de baja" → confirma → PUT estado=baja                                                                                                                                   | `presentation/` (React SPA)                         | `LineaActions` component                                              |
| RF-UI-LIN-1.6   | Selección múltiple + acción masiva "Cambiar estado"                                                                                                                                | `presentation/` (React SPA)                         | `LineasTable` + `BulkActions`                                         |
| RF-UI-LIN-1.7   | Botón "Exportar" → descarga CSV/Excel con filtros                                                                                                                                  | `presentation/` (React SPA)                         | `LineasToolbar` → `GET /api/lineas/export`                            |
| RF-UI-IMP-1.1   | Dos secciones: Importar Centros                                                                                                                                                    | Importar Líneas                                     | `presentation/` (React SPA)                                           | `ImportPage` component |
| RF-UI-IMP-1.2   | Drag & drop / seleccionar archivo CSV/Excel                                                                                                                                        | `presentation/` (React SPA)                         | `FileDropZone` component                                              |
| RF-UI-IMP-1.3   | Progreso + reporte detallado (insertados, duplicados, errores)                                                                                                                     | `presentation/` (React SPA)                         | `ImportProgress` + `ImportReport`                                     |
| RF-UI-IMP-1.4   | Descargar plantilla CSV ejemplo                                                                                                                                                    | `presentation/` (React SPA)                         | `ImportPage` → `GET /api/import/templates`                            |
| RF-VAL-1.1      | normalizePhone(raw) → {normalized, tipo} E.164 chileno                                                                                                                             | `domain/value-objects/PhoneNumber.ts`               | `normalizePhone()`                                                    |
| RF-VAL-1.2      | Inválido → InvalidPhoneNumberError tipado                                                                                                                                          | `domain/value-objects/PhoneNumber.ts`               | `normalizePhone()` throw                                              |
| RF-VAL-1.3      | Solo PhoneNumber.ts transforma números                                                                                                                                             | `domain/value-objects/PhoneNumber.ts`               | Única función pública                                                 |
| RF-CC-EXP-1.1   | GET /api/centros-coste/export (codigo, nombre, formato_nombre, created_at)                                                                                                         | `infrastructure/http/routes/centro-coste.routes.ts` | `CentroCosteController.exportar()`                                    |
| RF-FMT-EXP-1.1  | GET /api/formatos/export (nombre, created_at)                                                                                                                                      | `infrastructure/http/routes/formato.routes.ts`      | `FormatoController.exportar()`                                        |

**Total RFs mapeados**: 56

---

## 2. Migraciones (Orden, Tablas, Índices, Constraints, FKs)

### Migración 001: `0001_initial_schema.sql` (generada por `pnpm db:generate`)

```sql
-- Tabla: formatos
CREATE TABLE formatos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla: centros_coste
CREATE TABLE centros_coste (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    formato_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_centro_formato FOREIGN KEY (formato_id) REFERENCES formatos(id) ON DELETE RESTRICT
);

-- Tabla: lineas_telefonicas
CREATE TABLE lineas_telefonicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(20) NOT NULL, -- E.164 chileno: +569XXXXXXXXX o +56XXXXXXXXXX
    numero_original VARCHAR(50) NOT NULL,
    proveedor VARCHAR(100) NOT NULL DEFAULT '',
    centro_coste_id UUID NOT NULL,
    fecha_asignacion DATE NOT NULL,
    costo_mensual DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (costo_mensual >= 0),
    tipo_linea VARCHAR(10) NOT NULL CHECK (tipo_linea IN ('movil','fijo')),
    empleado VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('activa','baja','pendiente','portabilidad')),
    tipo_uso VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (tipo_uso IN ('personal','geovictoria')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_linea_centro FOREIGN KEY (centro_coste_id) REFERENCES centros_coste(id) ON DELETE RESTRICT
);

-- Índice único parcial: número único solo entre líneas no dadas de baja
CREATE UNIQUE INDEX uq_linea_numero_activa ON lineas_telefonicas (numero) WHERE deleted_at IS NULL;

-- Índices para listados/filtros frecuentes
CREATE INDEX idx_linea_centro_coste ON lineas_telefonicas (centro_coste_id);
CREATE INDEX idx_linea_estado ON lineas_telefonicas (estado);
CREATE INDEX idx_linea_tipo_uso ON lineas_telefonicas (tipo_uso);
CREATE INDEX idx_linea_fecha_asignacion ON lineas_telefonicas (fecha_asignacion);
CREATE INDEX idx_linea_proveedor ON lineas_telefonicas (proveedor);
CREATE INDEX idx_linea_empleado ON lineas_telefonicas (empleado);
CREATE INDEX idx_centro_formato ON centros_coste (formato_id);
```

**Notas**:

- `tipo_uso` y `estado` usan `CHECK` constraint (no enum nativo) para extensibilidad (Q7).
- `deleted_at` para soft delete (baja lógica).
- Índice único parcial evita duplicados solo en líneas activas.

---

## 3. Estructura de Módulos (Rutas, Responsabilidades, Qué NO hace)

```
src/
├── app.ts                                    # Entry point Fastify (ya existe)
├── config/
│   ├── env.ts                                # Zod validation (ya existe)
│   ├── logger.ts                             # Pino logger (ya existe)
│   └── index.ts                              # Barrel export (ya existe)
├── domain/                                   # Reglas puras, sin dependencias externas
│   ├── entities/
│   │   ├── Formato.ts                        # Entity + factory
│   │   ├── CentroCoste.ts                    # Entity + factory
│   │   └── LineaTelefonica.ts                # Entity + factory (incluye soft delete logic)
│   ├── value-objects/
│   │   ├── PhoneNumber.ts                    # normalizePhone(), InvalidPhoneNumberError, tipos fijos válidos
│   │   └── CostoMensual.ts                   # Value object decimal ≥ 0
│   ├── events/
│   │   └── index.ts                          # Domain events (para futuro historial/auditoría)
│   └── errors/
│       └── DomainError.ts                    # Base class + InvalidPhoneNumberError, DuplicateError, NotFoundError, ForeignKeyError
├── application/                              # Casos de uso, puertos (interfaces)
│   ├── ports/
│   │   ├── repositories/
│   │   │   ├── FormatoRepository.ts          # Interface
│   │   │   ├── CentroCosteRepository.ts      # Interface
│   │   │   └── LineaRepository.ts            # Interface
│   │   └── file-parser/
│   │       └── SpreadsheetParser.ts          # Interface (CSV/Excel parsing)
│   ├── services/
│   │   ├── formato.service.ts                # CRUD Formato
│   │   ├── centro-coste.service.ts           # CRUD Centro Coste
│   │   ├── linea.service.ts                  # CRUD Línea + export + bulk estado
│   │   ├── import.service.ts                 # Importación Centros + Líneas (transaccional)
│   │   └── dashboard.service.ts              # KPIs
│   └── dto/
│       ├── formato.dto.ts
│       ├── centro-coste.dto.ts
│       ├── linea.dto.ts
│       ├── import.dto.ts
│       └── dashboard.dto.ts
├── infrastructure/
│   ├── database/
│   │   ├── schema/
│   │   │   ├── formatos.ts                   # Drizzle schema
│   │   │   ├── centros-coste.ts              # Drizzle schema
│   │   │   └── lineas-telefonicas.ts         # Drizzle schema
│   │   ├── repositories/
│   │   │   ├── formato.repository.ts         # Implementa FormatoRepository
│   │   │   ├── centro-coste.repository.ts    # Implementa CentroCosteRepository
│   │   │   └── linea.repository.ts           # Implementa LineaRepository
│   │   ├── connection.ts                     # Drizzle client (postgres)
│   │   └── migrations/                       # Generadas por drizzle-kit
│   ├── http/
│   │   ├── routes/
│   │   │   ├── formato.routes.ts             # GET/POST/DELETE /api/formatos + export
│   │   │   ├── centro-coste.routes.ts        # GET/POST/PUT/DELETE /api/centros-coste + export
│   │   │   ├── linea.routes.ts               # GET/POST/PUT/DELETE /api/lineas + export + bulk
│   │   │   ├── import.routes.ts              # POST /api/import/centros | /lineas + templates
│   │   │   ├── dashboard.routes.ts           # GET /api/dashboard/kpis
│   │   │   └── index.ts                      # Barrel export routes
│   │   ├── schemas/
│   │   │   ├── formato.schemas.ts            # Zod schemas request/response
│   │   │   ├── centro-coste.schemas.ts
│   │   │   ├── linea.schemas.ts
│   │   │   ├── import.schemas.ts
│   │   │   └── dashboard.schemas.ts
│   │   ├── middleware/
│   │   │   ├── error-handler.ts              # Global error handling (DomainError → HTTP)
│   │   │   ├── validation.ts                 # Zod validation hook
│   │   │   └── multipart.ts                  # Config 10MB / 50k rows
│   │   └── controllers/
│   │       ├── formato.controller.ts
│   │       ├── centro-coste.controller.ts
│   │       ├── linea.controller.ts
│   │       ├── import.controller.ts
│   │       └── dashboard.controller.ts
│   └── external/
│       └── spreadsheet/
│           └── xlsx-parser.ts                # Implementa SpreadsheetParser (xlsx library)
└── presentation/                             # React SPA (Vite + React 18 + TS)
    ├── src/
    │   ├── components/
    │   │   ├── layout/                       # Sidebar, Header, Layout
    │   │   ├── lineas/
    │   │   │   ├── LineasTable.tsx
    │   │   │   ├── LineasFilters.tsx
    │   │   │   ├── LineaFormModal.tsx
    │   │   │   ├── LineaActions.tsx
    │   │   │   ├── BulkActions.tsx
    │   │   │   └── LineasToolbar.tsx
    │   │   ├── import/
    │   │   │   ├── ImportPage.tsx
    │   │   │   ├── FileDropZone.tsx
    │   │   │   ├── ImportProgress.tsx
    │   │   │   └── ImportReport.tsx
    │   │   └── common/
    │   │       ├── Button.tsx
    │   │       ├── Input.tsx
    │   │       ├── Select.tsx
    │   │       ├── Modal.tsx
    │   │       ├── Table.tsx
    │   │       └── Pagination.tsx
    │   ├── pages/
    │   │   ├── Dashboard.tsx
    │   │   ├── Lineas.tsx
    │   │   └── Importacion.tsx
    │   ├── hooks/
    │   │   ├── useLineas.ts
    │   │   ├── useCentrosCoste.ts
    │   │   ├── useFormatos.ts
    │   │   └── useImport.ts
    │   ├── services/
    │   │   └── api.ts                        # Fetch wrapper + tipos
    │   ├── utils/
    │   │   ├── date.ts
    │   │   ├── export.ts
    │   │   └── validation.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── vite-env.d.ts
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── tailwind.config.ts                    # (opcional) para UI rápida
```

### Qué NO hace cada capa

| Capa                       | NO hace                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `domain/`                  | No accede a BD, no hace HTTP, no usa Fastify/Drizzle/Zod, no conoce infraestructura |
| `application/`             | No conoce Drizzle ni Fastify; solo usa interfaces (puertos); no renderiza UI        |
| `infrastructure/database/` | No contiene lógica de negocio; solo mapea BD ↔ entidades                            |
| `infrastructure/http/`     | No contiene reglas de negocio; solo serialización, validación entrada, routing      |
| `presentation/`            | No accede a BD directamente; solo llama API HTTP                                    |

---

## 4. Estrategia de Datos (Consultas SQL Concretas)

### 4.1 KPIs Dashboard (`DashboardService.obtenerKPIs()`)

```sql
-- Ejecutadas en paralelo (Promise.all)
SELECT COUNT(*) AS total_lineas FROM lineas_telefonicas WHERE deleted_at IS NULL;
SELECT COUNT(*) AS lineas_activas FROM lineas_telefonicas WHERE estado = 'activa' AND deleted_at IS NULL;
SELECT COUNT(*) AS count_personal FROM lineas_telefonicas WHERE tipo_uso = 'personal' AND deleted_at IS NULL;
SELECT COUNT(*) AS count_geovictoria FROM lineas_telefonicas WHERE tipo_uso = 'geovictoria' AND deleted_at IS NULL;
```

### 4.2 Listado Líneas con Filtros + Paginación Cursor-Based (`LineaRepository.listar()`)

```sql
-- Base query con JOIN para centro de coste
SELECT
    l.id, l.numero, l.numero_original, l.proveedor,
    l.centro_coste_id, c.codigo AS centro_coste_codigo, c.nombre AS centro_coste_nombre,
    l.fecha_asignacion, l.costo_mensual, l.tipo_linea, l.empleado, l.estado, l.tipo_uso,
    l.created_at, l.updated_at
FROM lineas_telefonicas l
INNER JOIN centros_coste c ON l.centro_coste_id = c.id
WHERE l.deleted_at IS NULL
  -- Filtros dinámicos (construidos condicionalmente)
  AND ($1::text IS NULL OR l.numero ILIKE '%' || $1 || '%')
  AND ($2::text IS NULL OR l.proveedor ILIKE '%' || $2 || '%')
  AND ($3::uuid IS NULL OR l.centro_coste_id = $3)
  AND ($4::text IS NULL OR c.codigo ILIKE '%' || $4 || '%')
  AND ($5::text IS NULL OR c.nombre ILIKE '%' || $5 || '%')
  AND ($6::date IS NULL OR l.fecha_asignacion = $6)
  AND ($7::date IS NULL OR l.fecha_asignacion >= $7)
  AND ($8::date IS NULL OR l.fecha_asignacion <= $8)
  AND ($9::numeric IS NULL OR l.costo_mensual >= $9)
  AND ($10::numeric IS NULL OR l.costo_mensual <= $10)
  AND ($11::text IS NULL OR l.tipo_linea = $11)
  AND ($12::text IS NULL OR l.empleado ILIKE '%' || $12 || '%')
  AND ($13::text IS NULL OR l.estado = $13)
  AND ($14::text IS NULL OR l.tipo_uso = $14)
ORDER BY
    CASE WHEN $15 = 'numero' AND $16 = 'asc' THEN l.numero END ASC,
    CASE WHEN $15 = 'numero' AND $16 = 'desc' THEN l.numero END DESC,
    CASE WHEN $15 = 'costo_mensual' AND $16 = 'asc' THEN l.costo_mensual END ASC,
    CASE WHEN $15 = 'costo_mensual' AND $16 = 'desc' THEN l.costo_mensual END DESC,
    CASE WHEN $15 = 'fecha_asignacion' AND $16 = 'asc' THEN l.fecha_asignacion END ASC,
    CASE WHEN $15 = 'fecha_asignacion' AND $16 = 'desc' THEN l.fecha_asignacion END DESC,
    CASE WHEN $15 = 'created_at' AND $16 = 'asc' THEN l.created_at END ASC,
    CASE WHEN $15 = 'created_at' AND $16 = 'desc' THEN l.created_at END DESC,
    l.created_at DESC  -- default tie-breaker
LIMIT $17 + 1  -- +1 para detectar hasNextPage
OFFSET $18;
```

**Parámetros**: 18 params (14 filtros + sortColumn + sortOrder + limit + offset). `limit = pageSize + 1`.

### 4.3 Exportación Líneas (`LineaRepository.exportar()`)

```sql
-- Misma query que listado SIN limit/offset, con filtro incluir_bajas opcional
SELECT
    l.numero, l.numero_original, l.proveedor,
    c.codigo AS centro_coste_codigo, c.nombre AS centro_coste_nombre,
    l.fecha_asignacion, l.costo_mensual, l.tipo_linea, l.empleado, l.estado, l.tipo_uso,
    l.created_at
FROM lineas_telefonicas l
INNER JOIN centros_coste c ON l.centro_coste_id = c.id
WHERE ($1::boolean IS NOT TRUE OR l.deleted_at IS NULL)  -- incluir_bajas=false por defecto
  AND (filtros idénticos a listado)
ORDER BY l.created_at DESC;
```

### 4.4 Importación Transaccional Centros de Coste (`ImportService.importarCentrosCoste()`)

```sql
-- En transacción (BEGIN ... COMMIT/ROLLBACK)
-- 1. Validar formatos existan (una query)
SELECT id, nombre FROM formatos WHERE nombre IN (/* lista única de formato_nombre del archivo */);

-- 2. Verificar códigos duplicados en BD
SELECT codigo FROM centros_coste WHERE codigo IN (/* lista única de codigo del archivo */);

-- 3. Verificar duplicados dentro del archivo (en memoria, JS)

-- 4. Si todo OK: INSERT masivo
INSERT INTO centros_coste (id, codigo, nombre, formato_id, created_at, updated_at)
VALUES
  (gen_random_uuid(), $1, $2, $3, now(), now()),
  (gen_random_uuid(), $4, $5, $6, now(), now()),
  ...
ON CONFLICT (codigo) DO NOTHING;  -- defensa en profundidad (validación previa ya pasó)

-- 5. Retornar conteos
```

### 4.5 Importación Transaccional Líneas (`ImportService.importarLineas()`)

```sql
-- En transacción con SAVEPOINT por fila (o validación previa + batch insert)
-- Estrategia: validar TODO en memoria primero, separar válidos/duplicados/errores,
-- luego INSERT masivo solo los válidos no duplicados.

-- 1. Obtener todos los centro_coste_codigo únicos del archivo → lookup en BD
SELECT id, codigo FROM centros_coste WHERE codigo IN (/* códigos únicos */);

-- 2. Obtener números existentes en BD (no bajas) para detectar duplicados
SELECT numero FROM lineas_telefonicas WHERE deleted_at IS NULL AND numero IN (/* números normalizados únicos */);

-- 3. En memoria (JS): clasificar cada fila
--    - Válido + no duplicado → para insertar
--    - Duplicado (número ya en BD) → reporte duplicados
--    - Error validación (formato, FK, enums, etc.) → reporte errores

-- 4. Si HAY errores de validación (no duplicados): ROLLBACK total, retornar reporte
-- 5. Si SOLO duplicados (o cero errores): INSERT masivo de válidos
INSERT INTO lineas_telefonicas (id, numero, numero_original, proveedor, centro_coste_id, fecha_asignacion, costo_mensual, tipo_linea, empleado, estado, tipo_uso, created_at, updated_at)
VALUES
  (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()),
  ...
ON CONFLICT (numero) WHERE deleted_at IS NULL DO NOTHING;

-- 6. COMMIT, retornar reporte { insertados, duplicados[], errores[] }
```

**Manejo de fallos a mitad**:

- Transacción única por importación completa.
- Validación completa en memoria **antes** de cualquier INSERT.
- Si error de validación → `ROLLBACK`, cero filas insertadas.
- Duplicados se detectan en memoria (query previa) y NO rompen la transacción.
- Logging estructurado: `logger.info({ importId, insertados, duplicados, errores })`.

---

## 5. Estrategia de Pruebas

### 5.1 Cobertura por RF

| Tipo                         | Ubicación                          | RFs Cubiertos                                                                                                                         | Herramientas                                       |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Unitarias Dominio**        | `tests/unit/domain/`               | RF-VAL-1.1, 1.2, 1.3, RF-LIN-1.4 (normalizePhone), RF-LIN-1.8 (soft delete logic)                                                     | Vitest, builders fixtures                          |
| **Unitarias Aplicación**     | `tests/unit/application/services/` | RF-FMT-1.1-1.4, RF-CC-1.1-1.6, RF-LIN-1.1-1.9 (lógica), RF-LIN-IMP-1.1-1.10 (lógica), RF-DASH-1.1, 1.2, RF-CC-EXP-1.1, RF-FMT-EXP-1.1 | Vitest, mocks de puertos (vitest-mock-extended)    |
| **Integración Repositorios** | `tests/integration/database/`      | RF-FMT-1.1-1.4, RF-CC-1.1-1.6, RF-LIN-1.1-1.9, RF-LIN-EXP-1.1-1.4, RF-CC-EXP-1.1, RF-FMT-EXP-1.1                                      | Vitest + Testcontainers (PostgreSQL real), Drizzle |
| **Integración HTTP**         | `tests/integration/http/`          | Todos los RFs de endpoints (validación Zod, códigos HTTP, multipart)                                                                  | Vitest + Fastify inject(), Testcontainers          |
| **E2E UI**                   | `tests/e2e/`                       | RF-UI-LIN-1.1-1.7, RF-UI-IMP-1.1-1.4                                                                                                  | Playwright (Chromium) contra `pnpm dev`            |

### 5.2 Fixtures Necesarias (`tests/fixtures/`)

| Archivo            | Contenido                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatos.ts`      | `createFormato(overrides?)`, `formatoSMU`, `formatoFalabella`                                                                                                                                            |
| `centros-coste.ts` | `createCentroCoste(overrides?)`, `centroCosteValido`, `centroCosteConFormatoSMU`                                                                                                                         |
| `lineas.ts`        | `createLinea(overrides?)`, `lineaMovilActiva`, `lineaFijaPendiente`, `lineaBaja`, `lineaPersonal`, `lineaGeovictoria`                                                                                    |
| `imports.ts`       | `csvCentrosCosteValido`, `csvCentrosCosteDuplicado`, `csvCentrosCosteFormatoInvalido`, `csvLineasValido`, `csvLineasSoloNumero`, `csvLineasDuplicados`, `csvLineasErroresValidacion`, `xlsx equivalents` |
| `phones.ts`        | `rawMovil`, `rawFijoSantiago`, `rawFijoValparaiso`, `rawInvalido`, `expectedNormalized`                                                                                                                  |

### 5.3 Casos Críticos a Probar

| Escenario                                                                            | RF                  | Tipo Test        |
| ------------------------------------------------------------------------------------ | ------------------- | ---------------- |
| `normalizePhone("9 1234 5678")` → `{normalized: "+56912345678", tipo: "movil"}`      | RF-VAL-1.1          | Unit domain      |
| `normalizePhone("1234567")` → throws `InvalidPhoneNumberError`                       | RF-VAL-1.2          | Unit domain      |
| Crear línea con número duplicado activo → 409                                        | RF-LIN-1.2          | Integración HTTP |
| Importar centros con formato inexistente → 0 insertados, errores por fila            | RF-CC-IMP-1.2       | Integración HTTP |
| Importar líneas: 3 duplicados, 2 errores validación → insertan N-5, reporte correcto | RF-LIN-IMP-1.8, 1.9 | Integración HTTP |
| Cambio estado masivo 50 → 48 ok, 2 ya en baja (idempotente)                          | RF-LIN-1.7          | Integración HTTP |
| Dashboard KPIs solo cuentan `deleted_at IS NULL`                                     | RF-DASH-1.1, 1.2    | Integración DB   |
| Exportar líneas con filtros → CSV columnas correctas, nombre timestamp               | RF-LIN-EXP-1.1-1.4  | Integración HTTP |
| UI: tabla paginada 20 filas, filtro por columna funciona                             | RF-UI-LIN-1.1, 1.2  | E2E              |
| UI: importación muestra progreso y reporte final                                     | RF-UI-IMP-1.3       | E2E              |

---

## 6. Orden de Implementación (Justificado por Dependencias)

| Fase                              | Tareas                                                                                     | Dependencias | Justificación                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------- |
| **0. Base**                       | Config DB, esquemas Drizzle, migración inicial, connection                                 | —            | Fundamento; sin BD no hay repositorios                        |
| **1. Dominio**                    | `PhoneNumber.ts` (normalizePhone), `DomainError`, entities, value objects                  | Fase 0       | Lógica pura sin deps externas; base para services             |
| **2. Puertos (Interfaces)**       | Repository interfaces, `SpreadsheetParser` interface                                       | Fase 1       | Contratos antes de implementaciones                           |
| **3. Repositorios Drizzle**       | Implementaciones de `FormatoRepository`, `CentroCosteRepository`, `LineaRepository`        | Fase 0, 2    | Necesitan esquemas BD + interfaces                            |
| **4. Services Aplicación (CRUD)** | `FormatoService`, `CentroCosteService`, `LineaService` (CRUD, listar, export, bulk estado) | Fase 1, 2, 3 | Lógica de negocio usa repositorios                            |
| **5. Import Service**             | `ImportService` (centros + líneas, transaccional, validación)                              | Fase 4       | Usa servicios CRUD + parser                                   |
| **6. Dashboard Service**          | `DashboardService` (KPIs)                                                                  | Fase 3       | Queries directas o vía repository                             |
| **7. HTTP Layer**                 | Controllers, Routes, Zod schemas, Middleware (error, validation, multipart)                | Fase 4, 5, 6 | Expone services vía REST                                      |
| **8. OpenAPI/Swagger**            | Verificar generación automática desde Zod                                                  | Fase 7       | Documentación viva                                            |
| **9. UI (React SPA)**             | Vite + React setup, components, pages, hooks, api client                                   | Fase 7       | Consume API; puede desarrollarse en paralelo tras API estable |
| **10. Tests**                     | Unit → Integración → E2E (en orden)                                                        | Cada fase    | Validar cada capa                                             |

**Tiempo estimado total**: ~40-50 horas (ver `tasks.md` para desglose).

---

## 7. Decisiones Técnicas Clave (Traceabilidad)

| Decisión                                               | Justificación                                                 | Alternativa Descartada                             |
| ------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| Drizzle ORM (no Prisma/TypeORM)                        | Type-safe SQL, performance, migraciones nativas, stack actual | Prisma (bundle size, runtime overhead)             |
| CHECK constraints para enums (no enum nativo PG)       | Extensibilidad `tipo_uso` sin `ALTER TYPE` (Q7)               | Enum nativo PostgreSQL                             |
| Índice único parcial `WHERE deleted_at IS NULL`        | Permite re-usar número tras baja lógica                       | Índice único total (bloquea reuso)                 |
| Validación importación 100% en memoria antes de INSERT | Transaccionalidad real todo-o-nada; performance               | Validar fila a fila en BD (lento, race conditions) |
| Case-insensitive `centro_coste_codigo` en import       | UX real: usuarios mezclan mayúsculas/minúsculas (Q2)          | Case-sensitive estricto                            |
| Soft delete (`deleted_at`) no hard delete              | Trazabilidad, recuperación, FKs RESTRICT                      | Hard delete (rompe integridad referencial)         |
| React SPA (Vite) no SSR/templates                      | Separación clara API/UI; equipo conoce React; spec Q8         | Fastify templates / Astro / Svelte                 |
| `xlsx` library (SheetJS) para parsing                  | Soporta CSV + Excel (.xlsx/.xls) sin dependencias nativas     | `csv-parse` solo CSV + librería separada Excel     |
| Zod para validación HTTP + env                         | Single source of truth; tipos TS inferidos                    | Joi / class-validator / JSON Schema                |

---

## 8. Riesgos y Mitigaciones

| Riesgo                                                        | Probabilidad | Impacto | Mitigación                                                                                                      |
| ------------------------------------------------------------- | ------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| Normalización teléfono chileno compleja (prefijos regionales) | Media        | Alto    | Tests exhaustivos `PhoneNumber.ts` con tabla completa de prefijos; validación temprana                          |
| Importación 50k filas → timeout / memoria                     | Media        | Medio   | Streaming parsing (xlsx `sheet_to_json` con streaming), chunked inserts (batch 1000), `statement_timeout` en BD |
| Duplicados en importación masiva causan race condition        | Baja         | Alto    | Índice único parcial en BD + validación previa en memoria; transacción serializable si necesario                |
| UI React acopla lógica de negocio                             | Media        | Medio   | UI solo llama API; validación cliente = UX, servidor = autoridad                                                |
| Migraciones Drizzle en producción                             | Baja         | Alto    | `pnpm db:migrate` en CI/CD; revisar SQL generado; backup antes de migrar                                        |

---

## 9. Checklist de Aprobación del Plan

- [ ] Mapa RF → componente completo (56 RFs)
- [ ] Migraciones con constraints, FKs, índices nombrados
- [ ] Estructura de módulos con límites claros (qué NO hace cada capa)
- [ ] Consultas SQL concretas para operaciones principales
- [ ] Estrategia de pruebas por tipo + fixtures + casos críticos
- [ ] Orden de implementación justificado por dependencias
- [ ] Manejo de fallos: transacciones, rollback, logging
- [ ] Sin over-engineering: PostgreSQL + Drizzle, no SQLite local
- [ ] Decisiones trazadas con alternativa descartada

---

**Firma / Aprobación**: Aprobado por el usuario **Fecha**: 2026-11-05

> **Nota**: este plan fue aprobado explícitamente antes de ejecutar `/sdd-implement`. La fecha de aprobación se
> registró arriba. El anexo «Plan del delta v1.2» (§D) y sus tareas **T-11…T-19** fueron aprobados por el usuario
> el 2026-11-05, igual que las tareas de corrección **T-20…T-22** (derivadas de la revisión posterior).

---

## Plan del delta v1.2 — Cierre de deuda técnica (2026-11-05)

**Base**: `spec.md` **v1.2, aprobada**. Este anexo **no reescribe** las secciones §1 a §9 del plan original: las completa
con los cuatro puntos del delta (§9.1 y §10 de la spec). **No hay migraciones ni cambios de esquema**: el delta es
orden/cursor de lectura, tests y CI.

### D.1 Objetivo y alcance

- **(a) Formatos** — RF-FMT-1.3 y RF-ORD-1.4: `GET /api/v1/formatos` devuelve los formatos por `nombre` ASC y el cursor
  paginado viaja sobre `nombre` (con `id` como desempate).
- **(b) Líneas** — RF-ORD-1.1 a RF-ORD-1.5: 9 columnas ordenables (todas `NOT NULL`), cursor coherente por columna y
  `empleado` fuera del conjunto.
- **(c) Cobertura** — RF-QUAL-1.1 a RF-QUAL-1.12: las 13 ramas sin test de `validation.md` §6 (la decimotercera, el
  umbral, la cubre el punto (d)).
- **(d) CI** — RF-CI-1.1 a RF-CI-1.3: `pnpm test:coverage`, fallo del pipeline bajo umbral y artefacto del reporte.

**Fuera de alcance**: ordenar por `empleado` (Q4), runner de tests unitarios para la SPA (Q3), `linea_historial`,
migraciones y cualquier cambio del contrato de escritura (`If-Match` sigue siendo opcional).

### D.2 Diseño técnico

#### D.2.1 (a) Formatos: orden por `nombre` y cursor sobre `nombre`

Archivos a tocar:

- `src/infrastructure/database/repositories/cursor.ts`
- `src/infrastructure/database/repositories/formato.repository.ts`
- `src/infrastructure/database/repositories/centro-coste.repository.ts` y `linea.repository.ts` (adaptar las llamadas al
  nuevo sobre de cursor)
- `tests/unit/infrastructure/cursor.test.ts` (nuevo), `tests/integration/database/formato.repository.test.ts`,
  `tests/integration/http/api.test.ts`

**Sobre del cursor (decisión sobre `v`)**. Hoy `CursorPayload` es `{ v, id }` y `v` significa _valor de la columna de
orden_, no versión. Se añade `c: string` (columna) y quedan estas firmas:

- `codificarCursor(valor: string, id: string, columna: string): string` — escribe siempre `{ v, id, c }` en base64url.
- `decodificarCursor(cursor: string, columnaEsperada: string): CursorPayload` — exige `c === columnaEsperada`; si `c`
  falta o no coincide lanza `ValidationError('afterId', …)` → **400 RFC 7807**.

Motivo: al pasar el orden de formatos de `created_at` a `nombre`, un cursor antiguo lleva un ISO timestamp en `v`; si no
hubiera discriminador se compararía como si fuera un `nombre` y la página saldría mal **sin error** (supuesto
silencioso). Además, `c` impide reutilizar un cursor de `numero` con `sort=costo_mensual`, combinación que hoy tampoco
se detecta. Alternativa descartada: no tocar el sobre y aceptar cursores viejos.

**Repositorio de formatos** (`listar()`): `ORDER BY nombre ASC, id ASC` con `ordenKeyset(..., true)`; predicado
`(nombre, id) > ($v::text, $id::uuid)`; `nextCursor = codificarCursor(ultima.nombre, ultima.id, 'nombre')` y
`decodificarCursor(afterId, 'nombre')`. `listarTodos()` (el que usa el export) **no cambia**: ya ordena por `nombre ASC`.

**Sin cambios** en el puerto `FormatoRepository` (el cursor es opaco), ni en `formato.schemas.ts`, `formato.routes.ts` ni
`formato.controller.ts`: `after_id` ya es un string opaco y `limit` ya está validado (1..100).

**Colación**: se ordena con la colación de la base de datos, igual que `listarTodos()`, y el keyset usa la **misma
expresión**, así que la paginación es coherente aunque dos nombres con acentos no queden en orden de diccionario.
Alternativa descartada: `lower(nombre)` en el listado (el export quedaría con un orden distinto).

**Consecuencia asumida**: los cursores emitidos antes del despliegue (de cualquier listado) dejan de ser válidos y
responden 400; ver D.3.

#### D.2.2 (b) Líneas: 9 columnas ordenables con cursor por columna

- `src/application/ports/repositories/LineaRepository.ts:7` — `ColumnaOrdenLinea` pasa a `numero | proveedor | centro_coste_codigo | fecha_asignacion | costo_mensual | tipo_linea | estado | tipo_uso | created_at`.
- `src/infrastructure/database/repositories/linea.repository.ts:74-82` — mapa `COLUMNAS_ORDEN` con la expresión SQL y el
  tipo de cast del cursor:
  - `numero` → `lineas_telefonicas.numero`, cast `text`.
  - `proveedor` → `lineas_telefonicas.proveedor`, cast `text`.
  - `centro_coste_codigo` → `centros_coste.codigo`, cast `text` (columna del `INNER JOIN`; `codigo` es único, el
    desempate por `id` solo actúa entre líneas del mismo centro).
  - `fecha_asignacion` → `lineas_telefonicas.fecha_asignacion`, cast `date`.
  - `costo_mensual` → `lineas_telefonicas.costo_mensual`, cast `numeric` (comparación numérica, no lexicográfica:
    `900 < 1000`).
  - `tipo_linea`, `estado` y `tipo_uso` → sus columnas, cast `text`.
  - `created_at` → `lineas_telefonicas.created_at`, cast `timestamptz`.
- `valorCursor()` (`:477-489`) — casos nuevos leyendo `FilaLinea`, que ya proyecta `proveedor`, `centroCosteCodigo`,
  `tipoLinea`, `estado` y `tipoUso`; `String(fila.costoMensual)` para el numeric y `toISOString()` para `created_at`.
- `listar()` — `decodificarCursor(opciones.afterId, columna)` y `codificarCursor(..., columna)`.
- `src/infrastructure/http/schemas/linea.schemas.ts:93` — enum `sort` con los 9 valores; un valor fuera del conjunto
  responde **400** (RF-ORD-1.3) por la validación de Zod, sin tocar el `error-handler`.
- `src/infrastructure/http/controllers/linea.controller.ts:96-97` — retirar los casts `as 'numero'` / `as 'asc'` y tipar
  con `ColumnaOrdenLinea` / `DireccionOrden`.
- `src/application/services/linea.service.ts` — sin cambios: su `OpcionesListarLineas` reutiliza `ColumnaOrdenLinea`, así
  que el tipo se amplía solo.

**UI (RF-ORD-1.5)**:

- `presentation/src/types/api.ts` — nuevo tipo `ColumnaOrdenLinea` con las **8** columnas que ofrece la UI y
  `FiltrosLineas.sort` tipado con él.
- `presentation/src/components/lineas/LineasTable.tsx:23` — `ORDENABLES` pasa de `Set` a mapa `columna de tabla → columna de API`: `numero`, `proveedor`, `centro_coste → centro_coste_codigo`, `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `estado` y `tipo_uso`. **Fuera** `empleado` (Q4) y `created_at` (no se muestra en la tabla).
- `presentation/src/pages/Lineas.tsx:46-47,81-89` — `sort` tipado y `alternarOrden(columna: ColumnaOrdenLinea)`.
- Por qué un mapa: la columna de la tabla se llama `centro_coste` y muestra `centro_coste_codigo`; enviar
  `sort=centro_coste` produciría 400.

#### D.2.3 (c) Estrategia de tests de los 12 RF-QUAL

**Unitario** (`pnpm test tests/unit/...`):

- **RF-QUAL-1.4** — `tests/unit/application/services/import.service.test.ts`: un caso por prefijo (`=`, `+`, `-`, `@`) en
  cada campo de texto importable. Centros: `codigo`, `nombre` y `formato_nombre` (con `crear_formatos_faltantes: true` se
  asserta el nombre del formato creado, p. ej. `'=PELIGRO`). Líneas: `proveedor` y `empleado`. Se asserta el valor
  **persistido** con apóstrofo y que `numero` y `centro_coste_codigo` **no** se sanitizan (los `+569…` se normalizan).
- **RF-QUAL-1.5** — `tests/unit/domain/PhoneNumber.test.ts`: `"+560 9 1234 5678"` y `"056 9 1234 5678"` →
  `{ normalized: '+56912345678', tipo: 'movil' }`; `"5612345678"` → `{ normalized: '+565612345678', tipo: 'fijo' }`.
  `normalizePhone()` **no** se modifica (Q5).

**Integración de repositorio** (`tests/integration/database/...`):

- **RF-ORD-1.4** — `formato.repository.test.ts`: orden `ALFA → MU → ZETA` y recorrido completo con `limit: 1` sin
  repetir ni saltar ids.
- **RF-ORD-1.1 / RF-ORD-1.2** — `linea.repository.test.ts`: ordenar por las 9 columnas (asc y desc) y paginar con
  `limit: 1` hasta el final comprobando que no se repite ni se salta ningún id; casos específicos de
  `centro_coste_codigo` (dos centros), `costo_mensual` (`900 < 1000`), `estado` y `tipo_uso`.

**HTTP con `app.inject`** (`tests/integration/http/api.test.ts`):

- **RF-QUAL-1.1** — `PUT /api/v1/formatos/:id` con `If-Match: W/"1"` → 200; con `"2"` → 200; con `abc`, `0` o `W/"x"`
  → 400 y versión intacta; con una versión ya superada → 409 (RF-OPT-1.3).
- **RF-QUAL-1.2** — crear línea y darla de baja; `GET /api/v1/lineas/export` (sin parámetro y con
  `incluir_bajas=false`) **no** la incluye; con `incluir_bajas=true` sí.
- **RF-QUAL-1.3** — multipart con un archivo de **más de 10 MB** → **413** (RFC 7807) en `/api/v1/import/centros-coste` y
  `/api/v1/import/lineas`; un único buffer grande reutilizado por ambos casos.
- **RF-QUAL-1.8** — dos `GET /api/v1/dashboard/kpis` consecutivos: el segundo refleja el cambio de estado hecho entre
  ambos.
- **RF-QUAL-1.9** — `format=xlsx` en los tres exports: `content-type` de Excel, nombre
  `^(lineas|centros_coste|formatos)_\d{8}_\d{6}\.xlsx$` y el binario se relee con `XLSX.read` para comprobar la fila de
  cabeceras.
- **RF-QUAL-1.10** — baja → cambio de estado a `activa` → `deleted_at` en `null` y la línea aparece en el listado normal.
- **RF-QUAL-1.11** — masivo con un UUID inexistente: `{ actualizadas: n, ignoradas: 0, fallidas: 1 }` y las líneas
  válidas actualizadas.
- **RF-QUAL-1.12** — import de centros con `formato_nombre` en otra caja (`smu` con `SMU` existente) → inserta.

**E2E (Playwright, puertos 3011/5183)**:

- **RF-QUAL-1.2** — marcar "incluir bajas" en la exportación y comprobar que el CSV descargado contiene el número dado de
  baja.
- **RF-QUAL-1.6** — 21+ líneas: la página 1 muestra 20 filas; "Siguiente ›" muestra un conjunto **disjunto** y no vacío.
- **RF-QUAL-1.7** — formulario vacío → "El número es obligatorio" y "Selecciona un centro de coste"; costo `-1` →
  "El costo no puede ser negativo"; se cuenta que **no** sale ninguna petición `POST /api/v1/lineas`.
- **RF-QUAL-1.10** — dar de baja por API, reactivar por API y comprobar que la línea **vuelve a aparecer** en `/lineas`
  con estado `activa`. La UI no lista bajas (solo la exportación las incluye), así que la reactivación se hace por HTTP y
  el E2E verifica el regreso al listado; alternativa descartada: añadir un filtro "incluir bajas" al listado (fuera del
  delta).
- **RF-QUAL-1.6 (orden)** — cubierto además por el E2E de columnas ordenables (T-13).

#### D.2.4 (d) CI

`.github/workflows/ci.yml`, job `calidad`:

- Sustituir el paso `Tests` (`pnpm test`) por `Tests con cobertura` → `pnpm test:coverage`, con el mismo `DATABASE_URL`
  apuntando al servicio PostgreSQL.
- Añadir `Subir reporte de cobertura` → `actions/upload-artifact@v4` con `name: cobertura`, `path: coverage/`,
  `if: always()` y `retention-days: 7`. `if: always()` es imprescindible: el artefacto interesa **cuando** falla el
  umbral.
- `vitest.config.ts` **no cambia**: los umbrales globales 80 statements / 80 lines / 80 functions / 70 branches ya están
  declarados y `--coverage` los aplica (el proceso falla si no se alcanzan), sobre `src/**` con las exclusiones vigentes.
  La SPA no se mide.
- El job `e2e` **no se toca** ni se le añade cobertura.
- `pnpm test` sigue siendo el comando rápido local (sin cobertura); el CI usa la variante con cobertura.

### D.3 Riesgos y mitigaciones

- **Cursores antiguos (decisión tomada)**: el sobre pasa a `{ v, id, c }` y `c` es obligatorio; un cursor emitido antes
  del despliegue (o de otra columna) responde **400**. Se acepta porque el cursor es opaco y efímero: la SPA lo guarda en
  memoria, lo reinicia al cambiar filtros u orden y no lo persiste; fallar rápido es preferible a paginar en silencio por
  la columna equivocada. Alternativa descartada: aceptar cursores sin `c` (mimetiza el error).
- **`codificarCursor` toca los 3 repositorios**: cambio mecánico guiado por el compilador; los tests de paginación de
  formatos, centros y líneas cubren el recorrido completo.
- **La cobertura global puede estar ya por debajo del umbral**: medir la línea base con `pnpm test:coverage` antes de
  encender el CI (T-18) y cubrir lo que falte **sin bajar el umbral**; registrar el porcentaje en `MEMORY.md`. Si el
  delta creciera demasiado, abrir tarea aparte antes de relajar el umbral.
- **El archivo de 10 MB ralentiza la suite**: un solo buffer de ~10 MB reutilizado por los dos endpoints; no se cambian
  los límites de producción.
- **Columnas `text` y colación**: el `ORDER BY` y el keyset usan la misma expresión, así que la paginación es coherente;
  se prueba paginando, no con una sola página.
- **`centro_coste_codigo` en el keyset**: la expresión vive en el `INNER JOIN`; se prueba el recorrido paginado por esa
  columna.
- **`sort` inválido desde la UI**: el mapa explícito evita enviar `sort=centro_coste`; el E2E asserta el query string.
- **Artefacto de cobertura**: `coverage/` está gitignored y solo existe tras la ejecución; `if: always()` evita perderlo
  justo cuando falla el umbral.

### D.4 Orden de implementación y criterio de hecho

Orden: **T-11** (formatos) → **T-12** (API de líneas) → **T-13** (UI) → **T-14** (unitarios) → **T-15** y **T-16**
(HTTP) → **T-17** (E2E) → **T-18** (CI) → **T-19** (limpieza y `MEMORY.md`). Los cambios de comportamiento van primero
(mueven el cursor y el orden); después la cobertura; el CI al final porque exige la suite verde.

**Hecho cuando** pasan, sin errores: `pnpm test`, `pnpm test:coverage` (global ≥ 80/80/80/70), `pnpm test:e2e`,
`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm --dir presentation typecheck`, `pnpm --dir presentation build`
y `pnpm build`. No se genera ninguna migración (`pnpm db:generate` responde "No schema changes").

**Trazabilidad RF → parte del delta**:

- (a) RF-FMT-1.3, RF-ORD-1.4 → D.2.1.
- (b) RF-ORD-1.1, RF-ORD-1.2, RF-ORD-1.3, RF-ORD-1.5 → D.2.2.
- (c) RF-QUAL-1.1 … RF-QUAL-1.12 → D.2.3.
- (d) RF-CI-1.1, RF-CI-1.2, RF-CI-1.3 → D.2.4.
- RF-VAL-1.4 y RF-VAL-1.5 → D.2.3 (unitarios de T-14).

---

## Plan del delta v1.3 — Paginación de UI en catálogos (2026-11-06)

**Base**: `spec.md` **v1.3, aprobada** («Paginación de la UI en catálogos (Formatos y Centros de Coste)»). Este anexo añade las secciones §E.1 a §E.4 al plan original sin reescribirlas. **No hay migraciones, ni cambios de esquema, ni cambios de contrato de API**: el delta es funcionalidad nueva de SPA sobre endpoints que ya entregan cursor y `limit` 1..100 (T-11/T-12).

### E.1 Objetivo y alcance

- **(a) Formatos** — RF-CAT-1.1, 1.3, 1.8, 1.9: la tabla del panel de Formatos se pagina a **20 filas por página** sobre `nombre ASC, id ASC` (cursor sobre `nombre`, `id` como desempate, coherente con RF-FMT-1.3 y RF-ORD-1.4), con controles «Anterior»/«Siguiente»; «Siguiente» se deshabilita cuando la respuesta no trae `next_cursor` y «Anterior» en la página 1.
- **(b) Centros de Coste** — RF-CAT-1.4, 1.5, 1.8: la tabla del panel de Centros de Coste se pagina a **20 filas por página** con los filtros vigentes (`codigo`, `nombre`, `formato_id`, `busqueda`, coherente con RF-CC-1.6); «Aplicar filtros» y «Limpiar» reinician la paginación a la primera página (sin `after_id`).
- **(c) Hooks** — RF-CAT-1.1, 1.4, 1.6, 1.7: `useFormatos()` paginado (20/página, cursor, reinicio al cambiar orden); nuevo `useFormatosCatalogo()` con `limit=100` sin cursor para los **selects de formato** (formulario de centro de coste, filtro de centros de coste y filtro de líneas), independientes de la página visible de la tabla; `useCentrosCoste(filtros)` paginado (20/página, cursor) con reinicio al cambiar filtros.
- **(d) UI** — RF-CAT-1.6, 1.8, 1.9: al cambiar orden o filtro se reinicia el cursor a la primera página; al solo cambiar de página se avanza el cursor conservando la columna de orden del cursor (`c`); con menos de 20 filas (incluido cero) se muestran solo las disponibles, «Siguiente» deshabilitado y sin «Anterior» en la página 1.
- **Fuera de alcance**: truncado de selects cuando el catálogo supere 100 entradas (pregunta abierta P-1 del delta), interpretación de RF-FMT-1.3 sobre la UI (P-2), y runner de tests unitarios de la SPA (Q3 de v1.2: la SPA se cubre con E2E de Playwright).

### E.2 Diseño técnico

#### E.2.1 Hooks (`presentation/src/hooks/`)

No hay cambios de backend: se reutilizan `GET /api/v1/formatos` (orden `nombre ASC`, cursor sobre `nombre`, T-11) y `GET /api/v1/centros-coste` (cursor sobre `created_at`, T-11; filtros `codigo`/`nombre`/`formato_id`/`busqueda`). El schema HTTP ya limita `limit` a 1..100 y rechaza cursores legacy o de otra columna con 400 (RFC 7807).

- `useFormatos({ limite = 20, orden = 'nombre', direccion = 'asc' } = {})`: devuelve `Pagina<Formato>`; solicita `limit=20` con `after_id` del cursor de la página activa; al cambiar `orden` o `direccion` reinicia `after_id` (vuelve a página 1).
- `useFormatosCatalogo()`: `limit=100`, sin `after_id`, sin cursor; devuelve el catálogo completo para los `select` de formato (RF-CAT-1.7, RF-QUAL-1.15).
- `useCentrosCoste(filtros, { limite = 20 } = {})`: `limit=20` + filtros + `after_id`; como la clave de consulta de TanStack Query incluye los filtros, al cambiar cualquiera (o al limpiar) se consulta la primera página sin `after_id` (RF-CAT-1.5, RF-CAT-1.6). `useBuscarCentrosCoste` se mantiene sin paginación (`limit=20`, buscador de sugerencias).
- `useFormatoMutaciones` / `useCentroCosteMutaciones`: tras crear/editar/eliminar, invalidan ambas claves (paginado y catálogo) para mantener consistencia.

#### E.2.2 Paneles (`presentation/src/components/catalogos/`)

- `FormatosPanel`: tabla paginada con pila de cursores (patrón de `pages/Lineas.tsx`, T-13): array `cursores[]` + `indicePagina`; «Anterior» deshabilitado en `indicePagina === 0`; «Siguiente» deshabilitado cuando la respuesta no trae `next_cursor`; al solo cambiar de página se avanza el cursor conservando la columna de orden (`c`).
- `CentrosCostePanel`: igual, más reinicio de cursores al pulsar «Aplicar filtros» o «Limpiar». El `Select` de formato (filtro de centros y modal de centro de coste) se alimenta con `useFormatosCatalogo()`: catálogo completo, no se vacía ni se trunca al paginar la tabla (RF-CAT-1.7).

#### E.2.3 Consultas SQL y contrato API

No se genera migración ni consulta SQL nueva: se reutilizan `FormatoRepository.listar()` (`ORDER BY nombre ASC, id ASC` con keyset `(nombre, id)`) y `CentroCosteRepository.listar()` (filtros dinámicos + keyset sobre `created_at`, RF-CC-1.6). El cursor viaja siempre con su columna `c`; `decodificarCursor(after_id, columnaEsperada)` exige coincidencia y responde 400 ante un cursor legacy o de otra columna. Alternativa descartada: aceptar cursores sin `c` (oculta el error de paginar por la columna equivocada, decisión D.3 del plan).

#### E.2.4 Estrategia de tests del delta

| Tipo              | Ubicación                                                                          | RFs cubiertos                  |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| Unitarios de hook | `tests/unit/hooks/useFormatos.test.ts`, `tests/unit/hooks/useCentrosCoste.test.ts` | RF-CAT-1.1, 1.4, 1.6, 1.7      |
| E2E UI            | `tests/e2e/formatos-paginacion.spec.ts`, `tests/e2e/centros-paginacion.spec.ts`    | RF-QUAL-1.13, 1.14, 1.15, 1.16 |

Comandos de verificación: `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm --dir presentation typecheck`, `pnpm --dir presentation build`. `pnpm db:generate` debe responder «No schema changes, nothing to migrate».

### E.3 Riesgos y mitigaciones

| Riesgo                                         | Mitigación                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cursor legacy o de otra columna → 400          | El cursor es opaco y efímero (solo memoria de la SPA); se reinicia al cambiar filtros/orden. Fallar rápido es preferible a paginar silenciosamente por la columna equivocada (decisión D.3).                      |
| Selects de formato truncados a 100             | Deuda preexistente (P-1); no se resuelve en este delta. `useFormatosCatalogo()` sigue pidiendo `limit=100`, el máximo del schema HTTP.                                                                            |
| Sin runner de unitarios en la SPA              | Q3 de v1.2: la SPA se cubre con E2E. El test unitario de hook de T-24/T-26 requiere añadir `@testing-library/react` + `jsdom` si el usuario lo aprueba; de lo contrario su conducta queda cubierta por T-27/T-28. |
| Desincronía cursor/orden al cambiar de columna | Reinicio obligatorio de paginación (RF-CAT-1.6); la API rechaza con 400 el cursor de otra columna, por lo que el reinicio evita errores en pantalla.                                                              |

### E.4 Orden de implementación y criterio de hecho

Orden: **T-23** (hooks formatos) → **T-24** (panel formatos + unitario del hook) → **T-25** (hook centros + E2E segunda página) → **T-26** (panel centros + unitario del hook) → **T-27** (E2E formatos) → **T-28** (E2E centros) → **T-29** (formato de specs) → **T-30** (cierre en `MEMORY.md`) → **T-31** (verificación final). Las tareas de comportamiento van primero (hooks y paneles); las de cierre (formato, documentación, verificación completa) van al final.

**Hecho cuando** pasan, sin errores: `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (incluyendo `specs/**` y `MEMORY.md`), `pnpm build`, `pnpm --dir presentation typecheck`, `pnpm --dir presentation build` y `pnpm db:generate` («No schema changes»). No se genera ninguna migración.

**Trazabilidad RF → parte del delta**:

- RF-CAT-1.1 … RF-CAT-1.9 → E.2.1, E.2.2 (T-23…T-26)
- RF-QUAL-1.13 … RF-QUAL-1.16 → E.2.4 (T-27…T-28)

**Aprobación**: pendiente

---

## Plan del delta v1.4 — total_count en paginación por cursor (2026-11-06)

**Base**: `spec.md` **v1.4** (borrador, delta v1.4 sobre v1.3, 104 RF: 94 existentes + RF-PAG-1.1…1.10). Este anexo añade las secciones §F.1 a §F.4 al plan original sin reescribirlas. **No hay migraciones ni cambios de esquema**: el delta extiende el contrato de paginación por cursor con `total_count` y su derivado en la UI (`totalPaginas`).

### F.1 Objetivo y alcance

- **(a) Contrato de dominio** — RF-PAG-1.1: el puerto `PaginaCursor<T>` (`src/application/ports/repositories/paginacion.ts`) añade el campo `totalCount: number` junto a `items`, `next_cursor` y `has_next_page`.
- **(b) Contrato HTTP** — RF-PAG-1.2, RF-PAG-1.3, RF-PAG-1.5: `PaginaResponse<T>` (`src/infrastructure/http/respuestas.ts`) añade `total_count: number`; `toPaginaResponse()` lo incluye; `paginaSchema()` (`src/infrastructure/http/schemas/comunes.ts`) lo valida como entero ≥ 0.
- **(c) Repositorios** — RF-PAG-1.4: `listar()` de los 3 repositorios (formatos, centros de coste, líneas) calcula `totalCount` con una consulta `SELECT COUNT(*)` separada, aplicando los mismos filtros que la consulta de datos (para líneas además `deleted_at IS NULL`), y **no** usa `COUNT(*) OVER()`.
- **(d) SPA** — RF-PAG-1.6, RF-PAG-1.7, RF-PAG-1.8: `Pagina<T>` (`presentation/src/types/api.ts`) añade `totalCount: number`; los 3 paneles (Formatos, Centros de Coste y Líneas) calculan `totalPaginas = Math.ceil(totalCount / límite)` desde `pagina.totalCount` y nunca de `cursores.length`; `totalCount = 0` muestra "0 registros", nunca "Página 1 de 0", y `totalPaginas` está disponible desde el primer render.
- **Fuera de alcance**: no se modifican ni renumeran los 94 RF existentes; no hay nueva migración; no se usa `COUNT(*) OVER()`; no se cambia el orden de paginación ni la columna del cursor.

### F.2 Diseño técnico

#### F.2.1 Arquitectura de capas y ubicación de cada cambio

| Capa                 | Archivo                                                                                                                                                       | Cambio                                                                                                                               | RF                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Dominio / puerto     | `src/application/ports/repositories/paginacion.ts`                                                                                                            | `PaginaCursor<T>` añade `totalCount: number`                                                                                         | RF-PAG-1.1             |
| HTTP — respuestas    | `src/infrastructure/http/respuestas.ts`                                                                                                                       | `PaginaResponse<T>` añade `total_count`; `toPaginaResponse()` lo incluye                                                             | RF-PAG-1.2, RF-PAG-1.5 |
| HTTP — validación    | `src/infrastructure/http/schemas/comunes.ts`                                                                                                                  | `paginaSchema()` valida `total_count` (`z.number().int().nonnegative()`)                                                             | RF-PAG-1.3             |
| Infraestructura DB   | `src/infrastructure/database/repositories/formato.repository.ts`                                                                                              | `listar()`: `SELECT COUNT(*)` con mismos filtros que la consulta de datos                                                            | RF-PAG-1.4             |
| Infraestructura DB   | `src/infrastructure/database/repositories/centro-coste.repository.ts`                                                                                         | `listar()`: `SELECT COUNT(*)` con mismos filtros                                                                                     | RF-PAG-1.4             |
| Infraestructura DB   | `src/infrastructure/database/repositories/linea.repository.ts`                                                                                                | `listar()`: `SELECT COUNT(*)` con `deleted_at IS NULL` + mismos filtros                                                              | RF-PAG-1.4             |
| Presentación / tipos | `presentation/src/types/api.ts`                                                                                                                               | `Pagina<T>` añade `totalCount: number`                                                                                               | RF-PAG-1.6             |
| Presentación / UI    | `presentation/src/pages/Lineas.tsx`, `presentation/src/components/catalogos/FormatosPanel.tsx`, `presentation/src/components/catalogos/CentrosCostePanel.tsx` | `totalPaginas = Math.ceil(totalCount / límite)` desde `pagina.totalCount`; nunca `cursores.length`; `totalCount = 0` → "0 registros" | RF-PAG-1.7, RF-PAG-1.8 |

#### F.2.2 Consulta `COUNT(*)` separada (no `COUNT(*) OVER()`)

Cada repositorio ejecuta dos consultas por listado paginado:

1. La consulta de datos ya existente (cláusulas `WHERE`, `JOIN`, `ORDER BY` por columna de cursor, `LIMIT $n + 1`).
2. Una segunda consulta `SELECT COUNT(*) FROM <tabla> [JOINs] WHERE <misma condición que la de datos>`, con los mismos parámetros y filtros dinámicos, que devuelve exactamente un entero ≥ 0.

Para líneas la condición incluye siempre `l.deleted_at IS NULL`; para formatos y centros de coste no hay soft delete.

Decisión del delta (D-2 de spec §10.3): `SELECT COUNT(*)` separado, nunca `COUNT(*) OVER()`. Justificación: `COUNT(*) OVER()` obliga a materializar el resultset completo antes de aplicar `LIMIT` y acopla el conteo a cualquier `ORDER BY`/`LIMIT`; la consulta separada reutiliza el mismo predicado `WHERE`, puede aprovechar los índices existentes y no altera la query de datos. Alternativa descartada: ventana `COUNT(*) OVER()` (penaliza en listados grandes y complica la query).

El puerto `PaginaCursor<T>` es el contrato entre repositorio y servicio: `totalCount` viaja sin modificar `items`, `next_cursor` ni `has_next_page`.

#### F.2.3 Cálculo de `totalPaginas` en la UI

- `totalPaginas = Math.ceil(totalCount / límite)` donde `límite` es el `limit` que la UI envía al servidor (20 en todos los paneles paginados).
- Nunca se deriva de `cursores.length` (longitud de la página actual, siempre ≤ límite).
- `totalCount = 0` → `items: []`, `next_cursor: null`, `has_next_page: false`; el componente `Pagination` pinta "0 registros" y deshabilita «Siguiente»; nunca "Página 1 de 0".
- `totalPaginas` se calcula desde el primer render usando `pagina.totalCount`; si el backend aún no envía `total_count` (despliegue parcial), `totalPaginas` queda `undefined` y la UI conserva el comportamiento anterior (controles sin total de páginas) — ver F.3.

#### F.2.4 Riesgos y mitigaciones

| Riesgo                                                                   | Mitigación                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendimiento de `COUNT(*)` con filtros sobre tablas grandes               | Reutiliza el mismo `WHERE` (y `JOIN`) de la consulta de datos, por lo que beneficia de los mismos índices (p. ej. `idx_linea_centro_coste`, `idx_linea_estado`); ninguna consulta nueva de escaneo full-table sin filtro.                                                       |
| Consistencia entre conteo y página (datos cambian entre ambas consultas) | Las dos consultas van de forma secuencial inmediata; una pequeña inconsistencia transitoria es aceptable (la paginación por cursor no promete consistencia estricta entre conteo y páginas). Se documenta en el servicio.                                                       |
| `totalCount = 0` en UI                                                   | `totalPaginas = Math.ceil(0 / 20) = 0`; `Pagination` muestra "0 registros" y deshabilita «Anterior» y «Siguiente»; nunca "Página 1 de 0" (RF-PAG-1.8).                                                                                                                          |
| `totalPaginas` undefined si el backend no envía `total_count` aún        | La UI lee `pagina?.totalCount` y solo calcula `totalPaginas` cuando el valor existe; si es `undefined`, conserva el comportamiento anterior basado en `cursores.length`/`next_cursor`. Se activa `totalPaginas` una vez el backend despliegue `total_count` en los 3 endpoints. |
| Regresión en los 94 RF existentes                                        | El cambio es aditivo: `total_count` viaja en la respuesta junto a los campos existentes; los tests de paginación existentes siguen verdes sin modificación (RF-PAG-1.9, AC-5).                                                                                                  |

### F.3 Orden de implementación y criterio de hecho por tarea

Orden: **T-32** (puerto de dominio) → **T-33** (respuestas HTTP) → **T-34** (schema Zod) → **T-35** (repositorio formatos) → **T-36** (repositorio centros de coste) → **T-37** (repositorio líneas) → **T-38** (tipo frontend) → **T-39** (UI paneles) → **T-40** (tests HTTP + verificación final). Los cambios de backend van primero (puerto, respuestas, schema, 3 repositorios); el frontend consume el nuevo campo una vez el backend lo entrega; los tests cierran el delta.

**Hecho cuando** pasan, sin errores: `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (incluyendo `specs/**` y `MEMORY.md`), `pnpm build`, `pnpm --dir presentation typecheck`, `pnpm --dir presentation build` y `pnpm db:generate` («No schema changes»). Cada tarea deja `pnpm test` en verde antes de pasar a la siguiente.

### F.4 Trazabilidad RF → tarea

| RF          | Tarea            | Qué cubre                                                                             |
| ----------- | ---------------- | ------------------------------------------------------------------------------------- |
| RF-PAG-1.1  | T-32             | `PaginaCursor<T>` con `totalCount: number`                                            |
| RF-PAG-1.2  | T-33             | `PaginaResponse<T>` con `total_count`                                                 |
| RF-PAG-1.3  | T-34             | `paginaSchema()` valida `total_count` entero ≥ 0                                      |
| RF-PAG-1.4  | T-35, T-36, T-37 | `SELECT COUNT(*)` separado en formatos, centros de coste y líneas                     |
| RF-PAG-1.5  | T-33             | `toPaginaResponse()` incluye `total_count`                                            |
| RF-PAG-1.6  | T-38             | `Pagina<T>` de la SPA con `totalCount: number`                                        |
| RF-PAG-1.7  | T-39             | `totalPaginas = Math.ceil(totalCount / límite)` en los 3 paneles                      |
| RF-PAG-1.8  | T-39             | `totalCount = 0` → "0 registros", `totalPaginas` desde el primer render               |
| RF-PAG-1.9  | T-40             | No regresión: los 94 RF de v1.3 siguen CUMPLE                                         |
| RF-PAG-1.10 | T-40             | Pruebas HTTP de `total_count` en `GET /formatos`, `GET /centros-coste`, `GET /lineas` |

---

**Aprobación**: pendiente

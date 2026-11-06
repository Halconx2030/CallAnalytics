# MEMORY.md — Registro de Decisiones del Proyecto TELEFONO 2

## Inicialización del Proyecto (2026-11-04)

**Decisión**: Adaptar la configuración del proyecto "Control de Líneas Telefónicas" a "TELEFONO 2" con stack Node.js/TypeScript/Vitest/pnpm.

**Cambios realizados**:

- Nueva constitución en `docs/constitution.md` para stack TypeScript
- `package.json` raíz con pnpm, vitest, typescript, eslint, prettier
- `AGENTS.md` actualizado con comandos reales (pnpm test, pnpm lint, pnpm build)
- 4 agents actualizados (.opencode/agents/*.md): nombre proyecto + comandos test
- 10 commands actualizados (.opencode/commands/*.md): referencias a TELEFONO 2
- Skill SDD actualizada (.opencode/skills/sdd/SKILL.md): descripción proyecto

**Stack confirmado**:

- Node.js 20+ LTS
- TypeScript 5.x
- pnpm 9.x
- Fastify 4.x
- PostgreSQL 16 + Drizzle ORM
- Zod 3.x
- Vitest 2.x + Playwright
- ESLint 9 + Prettier 3

## Próximos Pasos Pendientes

- [x] Crear ADRs en `docs/adr/` para cada decisión de stack (resuelto en T-10: 8 ADRs, `docs/adr/001-stack.md` … `008-ui-spa-react.md`)
- [x] Configurar `tsconfig.json` estricto
- [x] Configurar `vitest.config.ts` con coverage
- [x] Configurar `eslint.config.js` flat config
- [x] Configurar `.prettierrc`
- [x] Configurar `drizzle.config.ts`
- [x] Dockerfile multi-stage (resuelto en T-10: `Dockerfile`, `.dockerignore` y `docker-compose.yml`)
- [x] CI/CD pipeline (GitHub Actions) (resuelto en T-10: `.github/workflows/ci.yml` con jobs `calidad` y `e2e`)
- [x] Escribir primera spec con `/sdd-spec` (001-gestion-lineas-telefonicas, aprobada)
- [x] Formatear `docs/constitution.md`, `specs/001-*.md` y `migrations/meta/*.json` (resuelto en T-06: Prettier aplicado a los `.md` y `.prettierignore` creado para `pnpm-lock.yaml` y `migrations/meta/`; `pnpm format:check` global queda en verde)
- [x] Corregir `z.coerce.boolean()` de `DATABASE_SSL` en `src/config/env.ts` (resuelto en T-10 con `booleanoEnv` propio)
- [x] Validación de la spec 001 (2026-11-04, veredicto APROBADO; informe en `specs/001-gestion-lineas-telefonicas/validation.md`)

## T-01 completada — Esquemas Drizzle + Migración Inicial (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/infrastructure/database/schema/formatos.ts`
- `src/infrastructure/database/schema/centros-coste.ts`
- `src/infrastructure/database/schema/lineas-telefonicas.ts`
- `src/infrastructure/database/schema/index.ts` (re-exporta tablas y tipos `*Row` / `New*`)
- `src/infrastructure/database/connection.ts` (`db`, `sqlClient`, `closeDatabase()` con postgres.js + drizzle)
- `src/infrastructure/database/migrations/0000_initial_schema.sql` + `meta/` (generados)
- `.env`, `.env.example` (ya existía), `.gitignore`

**Migración aplicada**: `0000_initial_schema.sql` generada con `pnpm db:generate --name initial_schema` y aplicada con `pnpm db:migrate` sobre el PostgreSQL 16 local existente en `localhost:5432` (base `telefono2`, usuario `postgres`). No hay Docker instalado en la máquina, así que se usó el servidor local. Verificado en BD: 3 tablas, 2 FKs `ON DELETE RESTRICT` (`fk_centro_formato`, `fk_linea_centro`), índice único parcial `uq_linea_numero_activa ... WHERE deleted_at IS NULL`, 4 CHECK, 7 índices normales y columna `version` en las 3 tablas.

**Ajustes y desviaciones del plan**:

1. `drizzle.config.ts`: parche de resolución `./x.js` → `./x.ts`. drizzle-kit 0.24.2 compila el schema a CJS con `esbuild-register` y lo carga con `require()`, que no aplica la sustitución de extensiones que exige `moduleResolution: NodeNext`; sin el parche, `db:generate` y `db:migrate` fallan con `Cannot find module './x.js'`.
2. drizzle-kit 0.24.2 **no serializa constraints `CHECK`** (no aparecen en el SQL ni en el snapshot). Se añadieron a mano en `0000_initial_schema.sql` los 4 CHECK (`ck_linea_costo_mensual`, `ck_linea_tipo_linea`, `ck_linea_estado`, `ck_linea_tipo_uso`), manteniendo las definiciones `check()` en el schema para cuando se actualice drizzle-kit. Tras ello `pnpm db:generate` responde "No schema changes, nothing to migrate".
3. Los nombres exactos de FK requieren `foreignKey({ name })` a nivel de tabla: drizzle-orm 0.33 no acepta `name` dentro de `.references()`.

**Pendiente detectado (fuera de alcance de T-01)**: `src/config/env.ts` usa `z.coerce.boolean()` para `DATABASE_SSL`, por lo que `DATABASE_SSL=false` se evalúa como `true` (`Boolean('false')`). Revisar antes de usar `.env` con el cliente de `connection.ts`.

## T-02 completada — Dominio: PhoneNumber, Errores, Entidades y Value Objects (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/domain/errors/DomainError.ts` (`DomainError` + `InvalidPhoneNumberError`, `InvalidCostoError`, `DuplicateError`, `NotFoundError`, `ForeignKeyError`, `ValidationError`)
- `src/domain/value-objects/PhoneNumber.ts` (`normalizePhone`, `TipoLinea`, `PREFIJO_FIJO_SANTIAGO`, `PREFIJOS_FIJOS_REGIONES`, `PREFIJOS_FIJOS_CHILE`)
- `src/domain/value-objects/CostoMensual.ts`
- `src/domain/entities/Formato.ts`
- `src/domain/entities/CentroCoste.ts`
- `src/domain/entities/LineaTelefonica.ts`
- `tests/unit/domain/PhoneNumber.test.ts` (116 tests), `LineaTelefonica.test.ts` (40), `CentroCoste.test.ts` (14), `Formato.test.ts` (14), `CostoMensual.test.ts` (13), `DomainError.test.ts` (13)

**Decisiones de diseño**:

1. **`deletedAt` al reactivar**: `cambiarEstado()` limpia `deletedAt = null` al salir de `baja` (y `actualizar()` con `estado != 'baja'` también), para no dejar `estado='activa'` con soft delete. No hay requisito explícito; se eligió la opción consistente con "`deleted_at IS NULL` = línea vigente". `darDeBaja()` es idempotente: si ya está en `baja` devuelve la misma instancia y conserva el `deletedAt` original.
2. **Contrato de `id`**: las factories de creación (`crearFormato`, `crearCentroCoste`, `crearLineaTelefonica`) devuelven `id: null`; `conId(id)` devuelve una copia con el id que asigna la BD. Las 3 entidades son inmutables (`Object.freeze` + campos `readonly`): `renombrar`, `cambiarFormato`, `conId`, `cambiarEstado`, `darDeBaja` y `actualizar` devuelven instancias nuevas. `version` la administra la persistencia: las factories la leen en `reconstituir*` pero los métodos de dominio no la incrementan.
3. **`fechaAsignacion`**: se modela como string `YYYY-MM-DD` (modo por defecto de `date()` en drizzle) y `hoy` se calcula en UTC desde `ahora`.
4. **`numeroOriginal`**: se guarda crudo (sin trim) al crear/actualizar; solo se valida no vacío y ≤ 50 caracteres.
5. **`CostoMensual`**: inmutable, redondeo half-up a 2 decimales con desplazamiento decimal vía string (`Number("10.005e2")`) para evitar el error binario de `* 100`; rango `0.00`–`99999999.99`.
6. **Errores extra**: `InvalidCostoError` (`INVALID_COSTO`) y `ValidationError` (`VALIDATION_ERROR`) además de los pedidos; ambos en `DomainError.ts` para que la capa HTTP los mapee en T-06.

**Desviaciones**:

1. `CentroCoste.nombre`: la tarea indicaba ≤ 255, pero `centros_coste.nombre` es `varchar(200)` en el esquema; el dominio valida 200 para no aceptar datos que la BD rechazaría.
2. `pnpm format:check` global sigue fallando por archivos preexistentes fuera del alcance de T-02 (`docs/constitution.md`, `specs/001-*.md`, `src/infrastructure/database/migrations/meta/*.json`). Los archivos creados/modificados en T-02 sí pasan Prettier (`prettier --check "src/domain/**/*.ts" "tests/unit/domain/**/*.ts"`); no se reformatearon migraciones ni documentación para no generar ruido fuera de alcance.

**Comandos verificados**: `pnpm test tests/unit/domain/` → 210 tests OK; `pnpm test` → 212 tests OK; `pnpm typecheck` OK; `pnpm lint` OK (0 errores, 0 warnings).

## T-03 completada — Puertos + Repositorios Drizzle + Parser de planillas (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/application/ports/repositories/paginacion.ts` (`PaginacionCursor`, `PaginaCursor<T>`, `normalizarLimit`, límite por defecto 20 / máximo 100)
- `src/application/ports/repositories/FormatoRepository.ts`
- `src/application/ports/repositories/CentroCosteRepository.ts` (`FiltrosCentroCoste`, `OpcionesListadoCentroCoste`, `CentroCosteConFormato`)
- `src/application/ports/repositories/LineaRepository.ts` (`FiltrosLinea` con los 14 filtros, `OpcionesListadoLineas`, `LineaListado`, `LineaExportRow`, `ResultadoCambioEstadoMasivo`)
- `src/application/ports/file-parser/SpreadsheetParser.ts`
- `src/infrastructure/database/repositories/cursor.ts` (codificar/decodificar cursor, predicado keyset, `ORDER BY` estable, `ILIKE` con `ESCAPE`)
- `src/infrastructure/database/repositories/errors.ts` (mapea 23505 → `DuplicateError`, 23503 → `ForeignKeyError`, 23514 → `ValidationError`)
- `src/infrastructure/database/repositories/{formato,centro-coste,linea}.repository.ts`
- `src/infrastructure/external/spreadsheet/xlsx-parser.ts`
- `tests/integration/database/test-db.ts`, `formato.repository.test.ts`, `centro-coste.repository.test.ts`, `linea.repository.test.ts`
- `tests/unit/infrastructure/xlsx-parser.test.ts`

**Decisiones y desviaciones**:

1. **Paginación cursor-based (keyset)** en vez del `LIMIT/OFFSET` que muestra el plan: la constitución (regla 11) y T-03 exigen cursor. El cursor es un string base64url opaco con `{v, id}` (valor de la columna de orden + id como desempate); se compara por tupla `(columna, id)` para no repetir ni saltar filas. Orden por defecto `created_at DESC, id DESC`; columnas ordenables `numero`, `costo_mensual`, `fecha_asignacion`, `created_at`. `nextCursor` es `null` en la última página.
2. **Sin Docker**: los tests de integración usan el PostgreSQL local. `tests/integration/database/test-db.ts` crea la base `telefono2_test` (si no existe), aplica `0000_initial_schema.sql` partida por `--> statement-breakpoint` y hace `TRUNCATE` entre tests. La base de desarrollo `telefono2` no se toca.
3. **Fake timers eliminados** de `tests/setup.ts`: los timers falsos globales colgaban las conexiones a PostgreSQL. Ningún test existente los usaba.
4. **Dependencia `xlsx`**: se instaló la versión oficial **0.20.3** desde el CDN de SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) en lugar de la 0.18.5 de npm, que tiene avisos de seguridad conocidos (CVE-2023-30533 / CVE-2024-22363).
5. **Cabeceras normalizadas** por el parser: minúsculas, sin BOM y con espacios convertidos en `_` (`Centro de Coste` → `centro_de_coste`); los duplicados se resuelven con sufijo (`numero`, `numero_2`). Los valores de las celdas se devuelven como texto recortado.
6. **Filtros con comodines escapados**: el `ILIKE` de los filtros de texto escapa `%` y `_` del valor buscado (`ESCAPE '\'`).
7. Los repositorios reciben la instancia de base de datos por constructor (`PostgresJsDatabase<typeof schema>`), lo que permite que los tests apunten a la base de pruebas sin tocar `src/config/env.ts`.
8. `actualizar*` usa _optimistic locking_: `UPDATE ... WHERE id = $id AND version = $versionEsperada`; devuelve `null` si no coincide (la capa HTTP lo mapeará a 409 en T-06).

**Comandos verificados**: `pnpm test tests/integration/database/` → 30 tests OK; `pnpm test` → **248 tests OK** (11 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores, 0 warnings); `prettier --check` OK en `src/application`, `src/infrastructure` y `tests`.

## T-04 completada — Services CRUD + Dashboard + DTOs (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/application/dto/formato.dto.ts`, `centro-coste.dto.ts`, `linea.dto.ts`, `dashboard.dto.ts` (DTOs planos + funciones `toXDto`)
- `src/application/services/formato.service.ts`, `centro-coste.service.ts`, `linea.service.ts`, `dashboard.service.ts`
- `src/application/ports/repositories/DashboardRepository.ts` (puerto de KPIs)
- `src/infrastructure/database/repositories/dashboard.repository.ts` (4 `COUNT` en `Promise.all`)
- `tests/unit/application/services/{formato,centro-coste,linea,dashboard}.service.test.ts`
- `tests/integration/database/dashboard.repository.test.ts`

**Archivos modificados**:

- `src/domain/errors/DomainError.ts`: nuevo `ConflictError` (código `CONFLICT`) para 409 (eliminación bloqueada y _optimistic locking_).
- `src/application/ports/repositories/LineaRepository.ts` + `src/infrastructure/database/repositories/linea.repository.ts`: nuevo `contarPorCentroCoste(centroCosteId)` (cuenta líneas de baja también, porque la FK `RESTRICT` impide borrar el centro).

**Decisiones y desviaciones**:

1. Los services dependen **solo de puertos** (no de Drizzle ni Fastify). `FormatoService` usa `CentroCosteRepository.contarPorFormato` y `CentroCosteService` usa `LineaRepository.contarPorCentroCoste` para devolver 409 al eliminar con dependencias (RF-FMT-1.4, RF-CC-1.5).
2. **Reglas de error en services**: `DuplicateError` → 409 (nombre/código/número duplicados), `ForeignKeyError` → 400 (formato o centro de coste inexistente), `NotFoundError` → 404, `ValidationError`/`InvalidPhoneNumberError` → 400, `ConflictError` → 409 (versión desactualizada o borrado bloqueado).
3. **Optimistic locking**: los services aceptan `versionEsperada` opcional; si no coincide con la versión leída se responde `ConflictError`, y si el `UPDATE ... WHERE version` no afecta filas también.
4. `cambiarEstado` es **idempotente**: si la línea ya está en el estado pedido no se escribe en la base de datos. `cambiarEstadoMasivo` mapea el resultado del repositorio a `{actualizadas, ignoradas, fallidas}` (ignorar = ya estaba en ese estado; fallidas = ids inexistentes).
5. `crear` de línea normaliza el número **antes** de consultar duplicados, para comparar siempre el valor E.164.
6. **DTOs en camelCase**; la capa HTTP (T-06) expone los KPIs con los nombres `snake_case` de la spec (`total_lineas`, `lineas_activas`, `count_personal`, `count_geovictoria`).
7. `DashboardService` delega en el puerto; los 4 `COUNT` se ejecutan en paralelo en la implementación Drizzle, sin caché (RF-DASH-1.2).

**Comandos verificados**: `pnpm test` → **289 tests OK** (16 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores, 0 warnings); `prettier --write` aplicado en los archivos nuevos.

## T-05 completada — Import Service (Centros + Líneas, Transaccional) (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/application/dto/import.dto.ts` (`ImportarArchivoDto`, `MAX_BYTES_ARCHIVO` = 10 MB, `MAX_FILAS_ARCHIVO` = 50.000, `ReporteImportacionCentrosDto`, `ReporteImportacionLineasDto`, `ErrorImportacion*Dto`, `DuplicadoImportacionLineaDto`)
- `src/application/services/import.service.ts` (`ImportService.importarCentrosCoste()`, `ImportService.importarLineas()`)
- `tests/unit/application/services/import.service.test.ts` (16 tests, mocks de parser + repositorios)
- `tests/integration/database/import.service.test.ts` (8 tests, PostgreSQL local + CSV/XLSX reales)

**Archivos modificados**:

- `src/application/ports/repositories/FormatoRepository.ts`: nuevo `buscarPorNombres(nombres)` (case-insensitive).
- `src/application/ports/repositories/CentroCosteRepository.ts`: nuevos `buscarPorCodigos(codigos)` (case-insensitive) y `crearMuchos(centros)` (transaccional, todo-o-nada).
- `src/application/ports/repositories/LineaRepository.ts`: nuevo `buscarPorNumeros(numeros)` (solo líneas vigentes).
- `src/infrastructure/database/repositories/{formato,centro-coste,linea}.repository.ts`: implementación de los métodos anteriores. Se usa `inArray(sql`lower(columna)`, valores)`; la variante con `sql.join` genera parámetros sin enlazar (`error de sintaxis en o cerca de «$1»`).

**Decisiones y desviaciones**:

1. **Importación de centros de coste = todo-o-nada** (RF-CC-IMP-1.2/1.3): si alguna fila falla (formato inexistente, código repetido en la BD o dentro del archivo) no se inserta ninguna. El reporte mantiene `duplicados` como número (RF-CC-IMP-1.4) y el detalle de cada problema (incluidos los duplicados) va en `errores`.
2. **Importación de líneas**: los duplicados (en la BD o dentro del archivo) se reportan en `duplicados` y **no bloquean** (RF-LIN-IMP-1.9); cualquier error de validación cancela toda la importación. En `duplicados` se incluye además `fila` (la spec solo exige `numero` y `motivo`) para que la UI pueda señalar la fila.
3. **Un error por fila**: la validación se detiene en el primer campo inválido de cada fila (mensaje con el campo específico: `tipo_linea`, `estado`, `tipo_uso`, `costo_mensual`, `fecha_asignacion`).
4. **Sanitización de fórmulas** (regla de la constitución): solo en los campos de texto (`codigo`, `nombre`, `formato_nombre`, `proveedor`, `empleado`); si el valor empieza por `=`, `+`, `-` o `@` se antepone un apóstrofo. No se sanitizan `numero`, `centro_coste_codigo`, fechas ni costos para no romper la normalización ni la validación numérica.
5. **Fechas tolerantes**: se acepta `YYYY-MM-DD` y el formato chileno `DD/MM/YYYY` (y `DD-MM-YYYY`), porque Excel devuelve la fecha con el formato de la celda.
6. **Decimales tolerantes**: se aceptan `1234.56`, `1234,56`, `1.234,56` y `1,234.56`.
7. **Resolución del centro de coste en la importación de líneas**: por `centro_coste_codigo` (case-insensitive, Q4) o, si el archivo trae `centro_coste_id`, por id; si falta ambos, la fila es un error (RF-LIN-IMP-1.6).
8. La tarea proponía `tests/integration/http/import.test.ts`; la capa HTTP todavía no existe (T-06), por lo que la prueba de integración se hizo en `tests/integration/database/import.service.test.ts` con el parser real (CSV y XLSX) contra la base de pruebas.

**Comandos verificados**: `pnpm test` → **313 tests OK** (18 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores, 0 warnings); `prettier --write` aplicado en `src/` y `tests/`.

## T-06 completada � Capa HTTP: Controllers, Routes, Zod, Middleware (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `src/infrastructure/http/schemas/{comunes,formato.schemas,centro-coste.schemas,linea.schemas,import.schemas,dashboard.schemas}.ts`
- `src/infrastructure/http/respuestas.ts` (mappers DTO de aplicaci�n -> snake_case)
- `src/infrastructure/http/middleware/error-handler.ts` (RFC 7807 + `setNotFoundHandler`)
- `src/infrastructure/http/plugins/correlation-id.ts`
- `src/infrastructure/http/if-match.ts`
- `src/infrastructure/http/export.ts` (CSV con BOM, XLSX, plantillas, `Content-Disposition`)
- `src/infrastructure/http/controllers/{formato,centro-coste,linea,import,dashboard}.controller.ts`
- `src/infrastructure/http/container.ts` (`crearContenedor(db)`)
- `src/infrastructure/http/routes/{formato,centro-coste,linea,import,dashboard,index}.routes.ts`
- `src/app.ts` reescrito: `buildApp({ db?, silencioso? })` con helmet, cors, multipart (10 MB), swagger + UI en `/docs`, `/openapi.json`, `/health`
- `tests/integration/http/api.test.ts` (21 tests con `app.inject`)

**Decisiones y desviaciones**:

1. **snake_case en la API** (peticiones y respuestas), coherente con las cabeceras CSV y la regla `after_id` de la constitucion. Los DTOs de aplicacion siguen en camelCase y la capa HTTP traduce con mappers.
2. `fastify-type-provider-zod@2.1.0` (la 3+ exige Fastify 5), `@fastify/multipart@8.3.1` y `zod-to-json-schema@3.25.2` instalados.
3. **`If-Match` opcional**: si viene, se usa como `versionEsperada`; si no, la operacion se ejecuta sin verificar version (desviacion consciente de RF-CONC-1.1).
4. Sin `z.coerce.boolean()` en las queries (bug conocido de `DATABASE_SSL`): se creo `booleanoQuerySchema` con literales + `.transform()`.
5. `.prettierrc`: se removio `prettier-plugin-organize-imports` porque peleaba con la regla `import/order` de ESLint; ahora ESLint es el unico responsable del orden de imports.
6. `vitest.config.ts`: `testTimeout: 20000`, `hookTimeout: 30000` y `fileParallelism: false` (los tests de integracion comparten la base `telefono2_test`).
7. El plugin de rutas debe ser asincrono o declarar `done`: un callback plano sin `done()` produce "Plugin did not start in time" en avvio. Se uso la forma con `done()` para eliminar el warning `require-await`.

**Comandos verificados**: `pnpm test` -> **334 tests OK** (19 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores, 0 warnings); `prettier --check "src/**/*.ts" "tests/**/*.ts"` OK.

## T-07 completada � UI Base: Vite + React + Router + Layout + API Client (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Estructura**: la SPA vive en `presentation/` como paquete propio del workspace de pnpm (`pnpm-workspace.yaml` con `packages: [presentation]`), con React 18, React Router 6, TanStack Query 5 y Vite 5.

**Archivos creados**:

- `presentation/package.json`, `presentation/tsconfig.json`, `presentation/vite.config.ts` (puerto 5173 + proxy `/api` -> `http://localhost:3000`), `presentation/index.html`
- `presentation/src/main.tsx`, `App.tsx` (rutas `/`, `/lineas`, `/importacion`), `vite-env.d.ts`, `styles.css`
- `presentation/src/components/layout/{Layout,Sidebar,Header}.tsx`
- `presentation/src/components/base/{Button,Input,Select,Modal,Table,Pagination,FileDropZone}.tsx`
- `presentation/src/services/api.ts` (fetch tipado, `ApiError` con problema RFC 7807, `construirQuery`, `postArchivo`, `descargar`)
- `presentation/src/hooks/{useFormatos,useCentrosCoste,useLineas,useImport}.ts` (TanStack Query)
- `presentation/src/utils/{date,export}.ts`, `presentation/src/types/api.ts` (tipos de la API en snake_case)
- `presentation/src/pages/{Dashboard,Lineas,Importacion}.tsx` (base; T-08 y T-09 los completan)

**Bugs y desviaciones encontrados**:

1. **`src/app.ts` no arrancaba en Windows**: el guard `import.meta.url === `file://${process.argv[1]}`` fallaba por las barras invertidas de Windows, asi que `pnpm dev` no escuchaba en el puerto 3000. Corregido con `pathToFileURL(process.argv[1]).href`.
2. **`pnpm build` estaba roto desde T-05**: `tsdown` con `dts: true` exige `isolatedDeclarations` y fallaba con TS9010/TS9008; ademas los imports relativos con extension `.js` (exigidos por `moduleResolution: NodeNext`) se trataban como dependencias externas, dejando el bundle sin resolver. Solucion: plugin propio `resolverExtensionJs` en `tsdown.config.ts` y `dts: false` (el proyecto es una aplicacion, no una libreria).
3. ESLint del root ignora `presentation/**` (la SPA tiene su propio `tsconfig` y stack de React); los scripts `format`/`format:check` del root ahora incluyen `tsx`.
4. `CORS_ORIGIN` cambio de `*` a `http://localhost:5173` en `.env` y `.env.example` (la SPA se sirve en ese puerto).

**Verificacion**: `pnpm test` -> **334 tests OK** (19 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm build` OK y `node dist/app.js` responde `/health` 200; `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK; prueba de humo con API en 3000 y Vite en 5173 (proxy `/api/v1/dashboard/kpis` -> 200).

**Siguiente paso (esperando aprobaci�n del usuario)**: **T-08 � UI M�dulo L�neas** � `pages/Lineas.tsx` + `components/lineas/{LineasTable,LineasFilters,LineaFormModal,LineaActions,BulkActions,LineasToolbar}.tsx`: tabla de 20 filas, 14 filtros, modales de alta/edici�n, baja, selecci�n m�ltiple con cambio de estado masivo y exportaci�n con filtros.

## T-08 completada � UI Modulo Lineas (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados** (`presentation/src/components/lineas/`):

- `LineasFilters.tsx` � borrador local de los 14 filtros (numero, proveedor, centro_coste_codigo, centro_coste_nombre, centro_coste_id, fecha_asignacion, fecha_desde, fecha_hasta, costo_min, costo_max, tipo_linea, empleado, estado, tipo_uso) con botones "Aplicar filtros" y "Limpiar".
- `LineasTable.tsx` � tabla con seleccion multiple, columnas ordenables (numero, costo_mensual, fecha_asignacion, created_at), badge de estado y columna de acciones.
- `LineaActions.tsx` � editar, cambiar estado y "Dar de baja" (deshabilitado si ya esta en baja).
- `LineaFormModal.tsx` � alta/edicion con validacion cliente (numero obligatorio solo al crear, centro de coste obligatorio, costo >= 0); envia solo los campos modificados.
- `BulkActions.tsx` � barra de acciones masivas con reporte `actualizadas/ignoradas/fallidas`.
- `LineasToolbar.tsx` � nueva linea, recargar, exportar CSV/Excel e incluir bajas en la exportacion.

**Archivos modificados**:

- `presentation/src/pages/Lineas.tsx` � reescrito con paginacion por cursor (pila de cursores + indice de pagina, 20 filas por pagina), filtros, orden, seleccion multiple, modales, cambio de estado individual y masivo, exportacion con los filtros aplicados y `window.confirm` para la baja logica.
- `presentation/src/hooks/useLineas.ts` � **correccion de endpoints**: `PATCH /lineas/:id/estado` y `POST /lineas/estado/masivo` (coinciden con las rutas del backend; antes se usaban `PUT` y `/lineas/estado-masivo`). Nueva mutacion `useDarDeBajaLinea`.
- `presentation/src/services/api.ts` � nuevo `api.patch`.
- `presentation/src/components/base/Table.tsx` � nueva prop `renderCabecera` para cabeceras ordenables.
- `presentation/src/types/api.ts` � nuevo tipo `DatosLinea` (campos mutables en snake_case).
- `presentation/src/styles.css` � estilos de toolbar, filtros, barra de acciones masivas, badges de estado y ordenamiento de columnas.
- `package.json` � `format` y `format:check` ahora incluyen `css`.

**Comandos verificados**: `pnpm test` -> **334 tests OK** (19 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK (102 modulos).

**Pendiente propuesto (no estaba en el plan)**: falta una pantalla de **Formatos y Centros de Coste** (CRUD). La importacion de centros exige que existan los formatos (SMU, FALABELLA) y la UI actual solo tiene Dashboard, Lineas e Importacion, por lo que hoy no se pueden crear formatos ni centros de coste desde la interfaz.

## T-08b completada � UI Formatos y Centros de Coste (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (tarea extra aprobada por el usuario, no estaba en el plan original).

**Motivo**: la importacion de centros de coste exige que existan los formatos (SMU, FALABELLA) y la UI solo tenia Dashboard, Lineas e Importacion, por lo que no se podian crear formatos ni centros desde la interfaz.

**Archivos creados**:

- `presentation/src/components/catalogos/FormatosPanel.tsx` � tabla de formatos con alta, renombrado y borrado (confirma con `window.confirm`; muestra el 409 si tiene centros asociados).
- `presentation/src/components/catalogos/CentrosCostePanel.tsx` � filtros (codigo, nombre, formato) aplicados con "Aplicar filtros"/"Limpiar", tabla con codigo, nombre, formato y acciones.
- `presentation/src/components/catalogos/FormatoFormModal.tsx` � alta/edicion con validacion de nombre (1..100).
- `presentation/src/components/catalogos/CentroCosteFormModal.tsx` � alta/edicion con validacion de codigo (1..50, inmutable al editar), nombre (1..200) y formato obligatorio.
- `presentation/src/pages/FormatosCentros.tsx` � pagina con los dos paneles.

**Archivos modificados**: `App.tsx` (ruta `/catalogos`), `Sidebar.tsx` (enlace "Formatos y centros"), `Header.tsx` (titulo de la ruta), `styles.css` (`.formulario`, `.panel + .panel`).

**API reutilizada**: `GET/POST /formatos`, `PUT/DELETE /formatos/:id`, `GET/POST /centros-coste`, `PUT/DELETE /centros-coste/:id` (los hooks `useFormatos` y `useCentrosCoste` ya cubrian el CRUD).

**Comandos verificados**: `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK (108 modulos); `pnpm format:check` OK; prueba de humo: `GET /api/v1/formatos` y `GET /api/v1/centros-coste` -> 200.

## T-09 completada � UI Modulo Importacion (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `presentation/src/components/import/ImportProgress.tsx` � spinner + archivo + tama�o (KB). La API es sincrona, asi que no hay progreso por fila.
- `presentation/src/components/import/ImportReport.tsx` � reporte con 3 pestanas (Insertados / Duplicados / Errores). El reporte de centros trae `duplicados` como numero y el de lineas como array.
- `presentation/src/components/import/ImportPage.tsx` � seccion reutilizable (`tipo: 'centros' | 'lineas'`): plantilla, dropzone, boton importar, progreso y reporte.
- `presentation/src/pages/Importacion.tsx` � reescrito con las dos secciones (Centros | Lineas).

**Archivos modificados**:

- `presentation/src/components/import/FileDropZone.tsx` � muestra el archivo seleccionado y acepta error externo; valida extension (.csv/.xlsx/.xls).
- `presentation/src/hooks/useImport.ts` � `useDescargarPlantilla` corregido: antes usaba `fetch` con URL hardcodeada `/api/v1/...` y devolvia el header `content-disposition` completo; ahora usa `api.descargar('/import/templates?tipo=...')` y extrae el nombre del archivo.
- `presentation/src/styles.css` � estilos de pagina, panel, progreso, reporte y pestanas.

**Bug real del backend corregido**: `src/infrastructure/http/middleware/error-handler.ts` devolvia **500** ante un JSON malformado (el `SyntaxError` de Fastify trae `statusCode: 400` pero no caia en ninguna rama). Se anadio una rama que mapea cualquier error con `statusCode` 400-499 a `type: .../invalid-request` con el status correcto. Test nuevo en `tests/integration/http/api.test.ts`.

**Pruebas de humo (API + Vite reales)**: alta de formatos SMU y FALABELLA (201); importacion de centros con los datos reales del Excel (`510 RENDIC ... CURICO` y `C059102801 FALABELLA TOTTUS ...`) -> `{"insertados":2,"duplicados":0,"errores":[]}`; importacion de lineas -> `{"insertados":2,...}`; KPIs -> `{"total_lineas":2,"lineas_activas":1,"count_personal":1,"count_geovictoria":1}`; plantilla CSV con `content-disposition`; JSON malformado -> 400; Vite `/` y `/importacion` -> 200 y proxy de KPIs -> 200. Los datos de humo se eliminaron de la BD de desarrollo al terminar.

**Comandos verificados**: `pnpm test` -> **335 tests OK** (19 archivos); `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK (113 modulos); `prettier --write` en `presentation/src/**`.

## T-10 completada � E2E Playwright + Cobertura + CI (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md`.

**Archivos creados**:

- `playwright.config.ts` � dos `webServer` (API en 3000 con `DATABASE_URL` -> base `telefono2_test`; SPA Vite en 5173), `baseURL: http://localhost:5173`, `workers: 1`, `globalSetup: tests/e2e/global-setup.ts`.
- `tests/e2e/db.ts` � `asegurarBaseDePruebas()`, `aplicarMigracion()` (idempotente con `IF NOT EXISTS`), `limpiarTablas()`, `prepararBaseDePruebas()`, `vaciarBaseDePruebas()`.
- `tests/e2e/global-setup.ts`, `tests/e2e/helpers.ts` (crear formato/centro/linea por API + generadores de CSV).
- `tests/e2e/dashboard.spec.ts`, `lineas-crud.spec.ts`, `import.spec.ts`, `formatos-centros.spec.ts` � **14 tests E2E, todos en verde**.

**Bugs reales encontrados y corregidos durante los E2E**:

1. `presentation/src/components/base/Table.tsx` renderizaba `String(fila)` en vez del valor de la columna: todas las celdas sin `render` mostraban `[object Object]`. Ahora usa `String(fila[columna.clave] ?? '')`.
2. `FormatosPanel.tsx` usaba la clave `creado`, que no existe en `Formato` (es `created_at`); ahora la columna formatea la fecha.
3. `Input.tsx` y `Select.tsx` generaban `id = id ?? name`; como los mismos `name` se repiten entre filtros y modal, el `label for` apuntaba al input equivocado (el modal quedaba sin etiqueta). Ahora usan `useId()` de React.
4. `BulkActions.tsx` se desmontaba al vaciar la selecci�n, ocultando el resultado del cambio masivo. Ahora el resultado sigue visible.
5. `useFormatos` y `useCentrosCoste` pedian `limit: 200` y el schema HTTP limita a 100: la API devolvia 400 y los desplegables quedaban vacios. Corregido a `limit: 100`.
6. `src/config/env.ts` nunca cargaba el `.env` (faltaba `import 'dotenv/config'`) y usaba `z.coerce.boolean()` (que evalua `"false"` como `true`). Corregido con `booleanoEnv` propio.
7. El CSV de prueba de centros de coste traia solo 2 valores por fila con 3 cabeceras (`nombre` vacio), por lo que la importacion todo-o-nada insertaba 0. Corregido el helper.

**Extras incluidos en T-10**:

- **ADRs** en `docs/adr/`: `001-stack.md`, `002-fastify.md`, `003-postgresql.md`, `004-drizzle-zod.md`, `005-vitest-playwright.md`, `006-eslint-prettier.md`, `007-docker.md`, `008-ui-spa-react.md` (este ultimo documenta que la SPA React sustituye a los templates Handlebars/eta de la constitucion).
- `Dockerfile` multi-stage (`node:20-alpine`), `.dockerignore` y `docker-compose.yml` (Postgres 16 + app).
- `.github/workflows/ci.yml` con jobs `calidad` (typecheck, lint, format:check, test, build backend, typecheck/build SPA) y `e2e` (Playwright con Chromium), ambos con servicio Postgres 16.
- `docs/constitution.md`: la fila del stack paso de `Templates | Handlebars / eta` a `Interfaz web | React 18 + Vite 5 (ADR-008)`.
- `AGENTS.md` actualizado con los comandos de la SPA, la arquitectura real y los quirks (env sin `z.coerce.boolean()`, sin Docker -> PG local, paginacion por cursor con `limit` max 100).

**Comandos verificados**: `pnpm test` -> **335 tests OK** (19 archivos); `pnpm test:e2e` -> **14 tests E2E OK**; `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm build` OK; `pnpm --dir presentation build` OK.

**Nota**: la validacion formal de la spec con el subagente `reviewer` no fue posible (limite de uso de subagentes en esta sesion); la revision se hizo de forma manual contra la spec y el plan.

## Fix post-T-10: `Content-Type` en DELETE desde la SPA (2026-11-04)

**Bug**: `presentation/src/services/api.ts` anadia siempre `Content-Type: application/json`, incluso en peticiones sin cuerpo (`DELETE /formatos/:id`, `DELETE /centros-coste/:id`, `DELETE /lineas/:id`). Fastify respondia **400 `FST_ERR_CTP_EMPTY_JSON_BODY`** ("Body cannot be empty when content-type is set to 'application/json'"), mientras la misma llamada sin esa cabecera devolvia 204. En la UI el borrado fallaba siempre.

**Correccion**: en `request()`, `Content-Type: application/json` solo se envia si hay cuerpo (`init.body` no es `undefined`/`null`) y no es `FormData` (en ese caso lo pone el navegador con el boundary). Cubre tambien `api.post(path)` sin cuerpo (no hay ningun endpoint de la SPA que lo use hoy, pero la regla ya lo contempla).

**Test de regresion**: `tests/e2e/formatos-centros.spec.ts` -> nuevo test `elimina un centro de coste y un formato sin dependencias desde la interfaz` (crea centro `E2E-TMP-001` y formato `E2E-FMT-TMP`, acepta el `window.confirm`, comprueba que la fila desaparece y que no hay `.estado--error`). Verificado que **falla** si se revierte el fix y **pasa** con el fix. Suite E2E: **15 tests OK**.

**Nota de ejecucion E2E (resuelta)**: `playwright.config.ts` usaba `reuseExistingServer: false` en los `webServer` de 3000/5173, asi que `pnpm test:e2e` fallaba si los servidores de desarrollo ya estaban levantados en esos puertos ("http://localhost:3000/health is already used"). Ademas la API de desarrollo apunta a la base `telefono2` (no a `telefono2_test`), por lo que **no se debe reutilizar**. **Resuelto** con la seccion "Ports parametrizados para E2E" que sigue.

**Comandos verificados**: `pnpm test` -> **336 tests OK** (19 archivos); `pnpm typecheck` OK; `pnpm lint` OK; `prettier --check` OK en los archivos tocados; `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK (114 modulos); E2E -> **15 tests OK**.

## Ports parametrizados para E2E (2026-11-04)

**Problema**: `pnpm test:e2e` fallaba ("http://localhost:3000/health is already used") si el dev server (API en 3000, SPA en 5173) ya estaba levantado, porque `playwright.config.ts` usaba `reuseExistingServer: false` sobre los puertos del dev server. La unica forma de correr la suite era detener el dev server o usar una config temporal (la que se menciona en la nota de T-10).

**Decision**: Playwright levanta **sus propios servidores en puertos alternativos**, distintos de los del dev server:

| Servidor      | Puerto por defecto | Variable de entorno | Variables del `webServer`      |
| ------------- | ------------------ | ------------------- | ------------------------------ |
| API (Fastify) | `3011`             | `E2E_API_PORT`      | `PORT`                         |
| SPA (Vite)    | `5183`             | `E2E_SPA_PORT`      | `VITE_PORT`, `VITE_API_TARGET` |

- `pnpm test:e2e` ya **no necesita que se detenga el dev server**: se puede ejecutar con la API en 3000 y la SPA en 5173 levantadas.
- `reuseExistingServer: false` se mantiene: Playwright siempre levanta sus propios servidores, de modo que **nunca** se reutiliza la API de desarrollo (que apunta a la base `telefono2`).
- La API de E2E sigue apuntando a la base de pruebas `telefono2_test` (misma construccion que `tests/e2e/db.ts`: se parte de `DATABASE_URL` y se reemplaza el path por `/telefono2_test`), con `DATABASE_SSL=false`, `NODE_ENV=test` y `LOG_LEVEL=warn`.
- El proxy `/api` de la SPA de E2E apunta a la API de E2E via `VITE_API_TARGET=http://localhost:3011`; `CORS_ORIGIN` de la API de E2E es `http://localhost:5183`.

**Archivos modificados**:

- `playwright.config.ts`: `baseURL` -> `http://localhost:5183`; `webServer` de la API en 3011 (`PORT=3011`) y de la SPA en 5183 (`VITE_PORT=5183`, `VITE_API_TARGET=http://localhost:3011`); puertos parametrizados por `E2E_API_PORT` / `E2E_SPA_PORT`.
- `presentation/vite.config.ts`: `server.port` ahora se lee de `process.env.VITE_PORT` (default `5173`), manteniendo `strictPort: true`; el proxy `/api` sigue usando `VITE_API_TARGET` (default `http://localhost:3000`).
- `src/app.ts` y `src/config/env.ts`: **sin cambios**. `PORT` ya estaba en el schema de Zod (`z.coerce.number().default(3000)`) y `app.listen` ya usaba `env.PORT`.

**Nota**: `src/config/env.ts` carga `.env` con `dotenv/config`, que **no** sobreescribe variables ya presentes en `process.env`; por eso el `env` del `webServer` de Playwright gana sobre el `.env` de desarrollo.

**Comandos verificados**: `pnpm test:e2e` -> **15 tests OK** con el dev server corriendo en 3000/5173; suite repetida con `E2E_API_PORT=3012 E2E_SPA_PORT=5184` -> **15 tests OK** (override verificado); `pnpm test` -> **336 tests OK** (19 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK (114 modulos). Al terminar, los puertos 3011/5183 quedaron libres y el dev server (3000/5173) sigue respondiendo 200.

**Observacion (preexistente, no introducida aqui)**: `tests/unit/application/services/centro-coste.service.test.ts` -> "devuelve las filas con el nombre del formato" es **flaky**: `centroPersistido()` usa `new Date()` en cada llamada, asi que `createdAt` puede caer en un milisegundo distinto entre el mock y la asercion. Fallo 1 vez de 3 ejecuciones. No se toco en este cambio. **Resuelto el 2026-11-04** (ver la sección "Fix del test flaky de centro-coste.service.test.ts").

## Validación de la spec 001 (2026-11-04)

**Veredicto**: **APROBADO** (revisión formal realizada por el subagente `reviewer` / QA).

**Resumen**: 56 RF en total → **54 CUMPLE**, **2 PARCIAL**, 0 NO CUMPLE, 0 no verificables. Sin hallazgos bloqueantes.

**Informe completo**: `specs/001-gestion-lineas-telefonicas/validation.md`.

**Hallazgos menores (2, no bloquean)**:

1. **RF-LIN-1.9** — el ordenamiento del listado de líneas está limitado a 4 columnas (`numero`, `costo_mensual`,
   `fecha_asignacion`, `created_at`) mientras la spec dice "ordenamiento por cualquier columna"; los 14 filtros sí están
   completos.
2. **RF-FMT-1.3** — el listado de formatos no viene ordenado por `nombre` (`GET /api/v1/formatos` usa `ORDER BY
created_at DESC`); impacto cosmético.

**Desviaciones aceptadas (6)**: (1) paginación cursor-based `after_id` (keyset), sin `OFFSET`; (2) `If-Match` opcional;
(3) UI = SPA React + Vite (`presentation/`, paquete pnpm propio que no importa `src/`); (4) API HTTP en snake_case con
DTOs de aplicación en camelCase; (5) `linea_historial` (auditoría) no implementada en esta spec (postergada explícitamente
en la sección 3 de la spec); (6) sin Docker → integración/E2E sobre PostgreSQL local con base `telefono2_test`. Los
exports viven en `/api/v1/.../export` (la spec los escribía sin versión; la constitución obliga a `/api/v1/`).

**Comandos de verificación (en verde)**: `pnpm test` → 19 archivos / 336 tests OK; `pnpm test:e2e` → 15 tests OK;
`pnpm typecheck` OK; `pnpm lint` OK; `pnpm --dir presentation typecheck` OK.

**Pendientes nuevos**:

- (a) ordenar el listado de formatos por nombre (RF-FMT-1.3).
- (b) ampliar el ordenamiento del listado de líneas al resto de columnas (RF-LIN-1.9).
- (c) 13 ramas sin test (resumidas en el informe) — candidato a spec/tarea de calidad.
- (d) enforcement del umbral de cobertura en CI (la constitución lo exige).
- (e) `linea_historial` (auditoría) pendiente para una spec posterior.
- (f) ~~test unitario flaky preexistente en `tests/unit/application/services/centro-coste.service.test.ts` ("devuelve las
  filas con el nombre del formato") por `new Date()` en el factory: inyectar un `Date` fijo.~~ **RESUELTO** (2026-11-04):
  se inyecta una fecha fija en el factory y se reutiliza una sola instancia de la entidad en el mock y en la aserción
  (ver la sección "Fix del test flaky de centro-coste.service.test.ts").

## T-10b completada — Importación de Centros: Creación Automática de Formatos (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (tarea extra aprobada por el usuario).

**Motivo**: el CSV real de centros de coste (756 filas, delimitador `;`) usa 9 formatos (SMU 331, CORPORATIVO 192,
FALABELLA 98, WALMART 86, ADMINISTRACION 35, INACAP 7, EDUCACION 5, CENCOSUD 1, OTROS 1) y la base de datos solo
tenía 6: faltaban **ADMINISTRACION, EDUCACION y OTROS** (41 filas). Como la importación de centros es todo-o-nada
(RF-CC-IMP-1.2), fallaba entera con 41 errores `el formato "ADMINISTRACION" no existe` y se insertaban 0 filas.

**Decisión**: añadir una opción **opt-in** `crear_formatos_faltantes` (por defecto `false` → el comportamiento de
RF-CC-IMP-1.2 no cambia). Cuando está activa, los formatos que faltan se crean **en la misma transacción** que la
inserción de los centros de coste y se informan en el reporte (`formatos_creados`).

**Archivos creados**:

- `src/application/ports/repositories/UnidadDeTrabajo.ts` — puerto de unidad de trabajo (repositorios _scoped_ a la transacción).
- `src/infrastructure/database/repositories/unidad-de-trabajo.repository.ts` — `DrizzleUnidadDeTrabajo` (abre la transacción).
- `src/infrastructure/database/repositories/tipos.ts` — `ClienteDrizzle` / `TransaccionDrizzle` / `FuenteDrizzle`.

**Archivos modificados**:

- `src/application/dto/import.dto.ts`: `ImportarArchivoDto.crearFormatosFaltantes`, nuevo `OpcionesImportacionCentros` y
  `ReporteImportacionCentrosDto.formatosCreados` (opcional, `[]` por defecto).
- `src/application/services/import.service.ts`: `importarCentrosCoste(dto, opciones)`; el servicio crea los formatos que
  faltan (trim + comparación _case-insensitive_, se guarda el nombre del archivo recortado) y los centros en una sola
  transacción; la validación completa ocurre **antes** de cualquier escritura (id provisional `__formato_provisional__`
  para validar la entidad antes de crear el formato). Mensaje de error accionable:
  `el formato "X" no existe; créalo en "Formatos y centros" o activa la creación automática`.
- `src/infrastructure/database/repositories/{formato,centro-coste}.repository.ts`: el constructor acepta la conexión o una
  transacción en curso (`FuenteDrizzle`).
- `src/infrastructure/http/routes/import.routes.ts`: lectura del multipart con `request.parts()`; el campo
  `crear_formatos_faltantes` se interpreta como texto (`'true'`/`'false'`), **sin** `z.coerce.boolean()`.
- `src/infrastructure/http/controllers/import.controller.ts`, `schemas/import.schemas.ts`, `respuestas.ts`: la respuesta
  expone `formatos_creados: string[]` (snake_case) y el controlador traduce el DTO.
- `src/infrastructure/http/container.ts`: inyecta `DrizzleUnidadDeTrabajo` en el `ImportService`.
- `presentation/src/hooks/useImport.ts`: envía `crear_formatos_faltantes` en el `FormData`.
- `presentation/src/components/import/ImportPage.tsx`: checkbox **"Crear automáticamente los formatos que no existan"**
  (marcado por defecto, solo en la sección de centros de coste).
- `presentation/src/components/import/ImportReport.tsx`: línea "Formatos creados: ..." en el resumen (las 3 pestañas y los
  `role="tab"` se mantienen).
- `presentation/src/services/api.ts`: `postArchivo` acepta campos extra; `presentation/src/types/api.ts`:
  `ReporteImportacionCentros.formatos_creados`; `presentation/src/styles.css`: estilos `.opcion` y `.reporte__dato--destacado`.

**Tests**:

- `tests/unit/application/services/import.service.test.ts` (21 tests): crea los formatos que faltan, no crea formatos si
  la importación falla, recorta el nombre, nombre inválido y uso de la unidad de trabajo.
- `tests/integration/database/import.service.test.ts` (10 tests): contra PostgreSQL local, crea el formato y guarda los
  centros; no crea el formato si la importación falla.
- `tests/integration/http/api.test.ts` (25 tests): multipart con `crear_formatos_faltantes=true` (200 + `formatos_creados`)
  y `=false` (errores por fila, sin formatos).
- `tests/e2e/import.spec.ts` (16 tests E2E): sube un CSV con un formato inexistente con el checkbox marcado y comprueba el
  reporte, el formato creado y el centro insertado.

**Comandos verificados**: `pnpm test` → **345 tests OK** (19 archivos); `pnpm test:e2e` → **16 tests E2E OK**;
`pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK;
`pnpm --dir presentation build` OK (114 módulos).

**Notas**:

1. La unidad de trabajo es **opcional** en el constructor del `ImportService`: si no se inyecta, los formatos se crean
   antes de insertar los centros (sin atomicidad garantizada). El contenedor de producción siempre la inyecta.
2. Dentro de la transacción, `centros_coste.crearMuchos` abre un SAVEPOINT anidado (Drizzle/postgres.js); si falla, el
   rollback deshace también los formatos creados (verificado con el test de integración "no crea el formato si la importación falla").
3. Verificado con un CSV de 372 filas y delimitador `;` (incluido `"OTROS "` con espacio final): se crean ADMINISTRACION,
   EDUCACION y OTROS (recortado) y se insertan las 372 filas.

## T-10c completada — Buscador de centros de coste (combobox con búsqueda por texto) (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (tarea extra aprobada por el usuario).

**Motivo**: el usuario importó 756 centros de coste reales. El filtro "Centro de coste" de la UI de líneas era un
`<select>` nativo alimentado con `useCentrosCoste({ limit: 100 })` → solo mostraba los primeros 100 y no había forma
de buscar. Petición: poder escribir el nombre o el código y que aparecieran **todos** los centros que contuvieran ese
texto.

**Decisiones**:

1. **Búsqueda _server-side_**: nuevo parámetro de query `busqueda` en `GET /api/v1/centros-coste`. Se aplica en el
   repositorio como `(lower(c.codigo) ILIKE … OR lower(c.nombre) ILIKE …)`, reutilizando el helper `ilikeSeguro`
   (`ESCAPE '\'`, escapa `%` y `_`). El filtro va en el `WHERE` y es combinable con `codigo`, `nombre`, `formato_id` y
   con la paginación por cursor (`after_id`); el cursor no cambia. La búsqueda también se aplica a la exportación
   (`listarTodos`).
2. **El desplegable ya no se limita a 100**: la UI pide como máximo **20 sugerencias** (`limit=20`) y solo se busca a
   partir de **2 caracteres** (`enabled: texto.trim().length >= 2`), con `staleTime` de 15 s.
3. **Debounce de 250 ms** en el componente antes de consultar al servidor (evita una petición por tecla).
4. **El buscador es un componente nuevo** `presentation/src/components/lineas/CentroCosteCombobox.tsx` (no se modificó
   el `Select` base, que se sigue usando en otros sitios). Cada opción se rotula `código · nombre` (igual que el
   `select` anterior). Estados: "Buscando…", "Sin resultados" y "Escribe al menos 2 caracteres". Navegación con
   teclado (↑ ↓ Enter Escape), clic para seleccionar, botón "×" para limpiar y cierre al hacer clic fuera.
   `Escape` hace `stopPropagation` para no cerrar el modal donde está incrustado.
5. **El callback entrega `{ id, texto }` o `null`** (al limpiar o al escribir texto nuevo, que invalida la selección
   anterior). El componente guarda la etiqueta seleccionada, así que **muestra el valor ya seleccionado aunque no
   esté entre los resultados actuales**.
6. **Se usa en dos sitios**: el filtro "Centro de coste" de `LineasFilters.tsx` (sigue el modelo de borrador: la
   selección fija el filtro `centro_coste_id` y se aplica con "Aplicar filtros") y el campo obligatorio
   "Centro de coste *" de `LineaFormModal.tsx` (la validación "Selecciona un centro de coste" se mantiene). Al
   editar una línea, la etiqueta se arma con `centro_coste_codigo`/`centro_coste_nombre` de la línea.
7. **`pages/Lineas.tsx` ya no carga `useCentrosCoste()`** (el `select` con los 100 primeros dejó de hacer falta):
   el filtro y el modal no reciben la lista de centros. La página `/catalogos` sigue usando el listado normal.

**Archivos creados**:

- `presentation/src/components/lineas/CentroCosteCombobox.tsx`
- `tests/e2e/centros-busqueda.spec.ts` (2 tests E2E)

**Archivos modificados**:

- `src/application/ports/repositories/CentroCosteRepository.ts` (`busqueda` en `FiltrosCentroCoste`).
- `src/infrastructure/database/repositories/centro-coste.repository.ts` (`condicionBusqueda()` en `listar` y
  `listarTodos`).
- `src/infrastructure/http/schemas/centro-coste.schemas.ts` (`busqueda`: string, trim, máx. 100).
- `src/infrastructure/http/controllers/centro-coste.controller.ts` (mapeo snake_case → `busqueda`; texto vacío se
  descarta).
- `presentation/src/hooks/useCentrosCoste.ts` (`useBuscarCentrosCoste`).
- `presentation/src/components/lineas/LineasFilters.tsx`, `LineaFormModal.tsx`, `presentation/src/pages/Lineas.tsx`.
- `presentation/src/styles.css` (`.combobox`, `.combobox__lista`, `.combobox__opcion`, `.combobox__opcion--activa`,
  `.combobox__estado`, `.combobox__limpiar`).
- `tests/unit/application/services/centro-coste.service.test.ts`, `tests/integration/database/centro-coste.repository.test.ts`,
  `tests/integration/http/api.test.ts`, `tests/e2e/lineas-crud.spec.ts` (el `selectOption` del modal se sustituyó
  por `fill` + clic en la opción).
- `specs/001-gestion-lineas-telefonicas/spec.md` (nota junto a RF-UI-LIN-1.2), `specs/.../tasks.md` (T-10c).

**Tests**: unitario del service (el filtro `busqueda` se pasa al repositorio); integración del repositorio (búsqueda
por fragmento de código, por fragmento de nombre, combinada con `formato_id` y con paginación por cursor); HTTP
(`GET /api/v1/centros-coste?busqueda=...` devuelve solo los que coinciden y un texto de 101 caracteres → 400); E2E
(busca un centro con texto único, comprueba que el desplegable se filtra, selecciona y la tabla queda filtrada;
"Sin resultados" y botón de limpiar).

**Comandos verificados**: `pnpm test` → **351 tests OK** (19 archivos); `pnpm test:e2e` → **18 tests E2E OK**;
`pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK;
`pnpm --dir presentation build` OK (115 módulos).

**Prueba de humo con los datos reales** (base `telefono2`, 756 centros): `GET /api/v1/centros-coste?busqueda=falabella`
devuelve **38** centros (antes solo era visible el subconjunto dentro de los primeros 100) y
`?busqueda=C05910` devuelve los que coinciden por código.

## T-10d completada — Unificar el filtro de centro de coste (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (tarea extra aprobada por el usuario).

**Motivo**: tras T-10c el panel de filtros de líneas tenía **3 controles de centro de coste** redundantes: el
combobox "Centro de coste" (nuevo) + los inputs de texto "Centro de coste (código)" y "Centro de coste (nombre)"
(antiguos). El usuario preguntó por qué había 2/3 y pidió dejar **un solo** control.

**Decisiones**:

1. **Un único control**: el combobox "Centro de coste" (búsqueda server-side por código **o** nombre) es el único
   filtro de centro de coste del panel. Se retiraron los dos inputs de texto.
2. **Solo la UI de líneas cambia**: el backend **no** se tocó. Los parámetros `centro_coste_codigo` y
   `centro_coste_nombre` de `GET /api/v1/lineas` y `GET /api/v1/lineas/export` se conservan (siguen siendo parte de
   la API); solo deja de usarlos la SPA. Tampoco se tocó la pantalla `/catalogos`, que conserva sus filtros
   propios por código, nombre y formato.
3. **Limpieza en la SPA**: `FiltrosLineas` (`presentation/src/types/api.ts`) ya no declara `centro_coste_codigo` ni
   `centro_coste_nombre`; como el estado, la query del listado y la exportación de `pages/Lineas.tsx` se construyen
   a partir de ese tipo, los tres usos desaparecen de una sola vez. El filtro `centro_coste_id` (el que fija el
   combobox) se mantiene.
4. **Los demás filtros no cambian**: número, proveedor, fechas, rango de costo, tipo de línea, empleado, estado y
   tipo de uso. El panel queda con **12 filtros** (antes 14).

**Archivos modificados**:

- `presentation/src/components/lineas/LineasFilters.tsx` (retirados los dos `Input`; comentario actualizado).
- `presentation/src/types/api.ts` (`FiltrosLineas` sin los dos campos; doc actualizado).
- `presentation/src/hooks/useLineas.ts` (comentario "12 filtros").
- `presentation/src/pages/Lineas.tsx` (comentario que documenta el filtro único `centro_coste_id`).
- `tests/e2e/centros-busqueda.spec.ts` (test nuevo: "el panel de filtros expone un único control de centro de
  coste" → 1 `input[role="combobox"]` y 0 inputs `centro_coste_codigo` / `centro_coste_nombre`).
- `specs/001-gestion-lineas-telefonicas/spec.md` (nota junto a RF-UI-LIN-1.2), `specs/.../tasks.md` (T-10d).

**Nota**: la entrada de la sección "T-08 completada" que describe `LineasFilters.tsx` con los 14 filtros es el
estado histórico de esa tarea; el estado actual es el de T-10d (12 filtros, buscador único).

**Tests**: no había ningún test E2E que usara los inputs "Centro de coste (código)/(nombre)" en la página de
líneas (el de T-10c ya usaba el combobox), así que no hubo que adaptar ninguno; se **añadió** uno que fija el
comportamiento nuevo. Los tests de `/catalogos` no se tocaron.

**Comandos verificados**: `pnpm test` → **351 tests OK** (19 archivos); `pnpm test:e2e` → **19 tests E2E OK**;
`pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK;
`pnpm --dir presentation build` OK.

**Filtros sin cubrir en la UI**: ninguno de los 12 del panel de líneas. Los parámetros de API
`centro_coste_codigo` / `centro_coste_nombre` quedan disponibles para clientes que los usen, pero la UI de líneas
solo filtra por `centro_coste_id`.

## T-10e completada — Buscador de centro de coste: uno específico o todos los que coincidan (2026-11-04)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (tarea extra aprobada por el usuario).

**Motivo**: petición textual del usuario _"LO MEJOR SIERIA QUE PUDIERAN SER AMBOS SI BUSCAN UNO EN ESPECIFICO O
VARIOS DEL MISMO DEL TIPO"_: al escribir en el buscador de centro de coste hay que poder elegir **un centro
concreto** o **todos los centros que coincidan** con ese texto (p. ej. escribir "FALABELLA" y quedarse con las
38 líneas de los centros FALABELLA).

**Decisiones**:

1. **Nuevo parámetro de API** `centro_coste_busqueda` (`GET /api/v1/lineas` y `GET /api/v1/lineas/export`):
   string, trim, máx. 100 (un texto de 101 caracteres → 400). Se aplica en el repositorio con semántica **OR**
   sobre el centro de coste: `(lower(c.codigo) ILIKE … OR lower(c.nombre) ILIKE …)`, reutilizando `ilikeSeguro`
   (`ESCAPE '\'`). Va en el `WHERE`, por lo que es combinable con los demás filtros y funciona con la paginación
   por cursor (el cursor no cambia) y con la exportación. El servicio no necesitó cambios: `OpcionesListarLineas`
   y `exportar()` ya heredan de `FiltrosLinea`.
2. **Los dos modos son excluyentes en la UI**: elegir una coincidencia concreta fija `centro_coste_id` y limpia
   `centro_coste_busqueda`; elegir "todos los que coincidan" fija `centro_coste_busqueda` y limpia
   `centro_coste_id`. Si ambos llegaran al backend se aplicarían con AND (no se hizo nada especial).
3. **La opción múltiple es la primera del desplegable** y solo aparece si se entrega el prop opcional
   `onSeleccionMultiple` y el texto tiene ≥ 2 caracteres (`MINIMO_BUSQUEDA_CENTROS`). Etiqueta:
   `Todos los centros que coincidan con «{texto}»`. Se elige con clic o con Enter cuando es la opción activa
   (navegación ↑ ↓). Es importante porque el desplegable solo muestra **20 sugerencias**: el modo múltiple da
   acceso a los centros que quedan fuera de ese TOP 20.
4. **El formulario de alta/edición NO ofrece el modo múltiple** (el campo "Centro de coste *" exige un centro
   único): `LineaFormModal` no entrega `onSeleccionMultiple`.
5. **Estado vacío conservado**: si no hay coincidencias individuales sigue apareciendo "Sin resultados" (y la
   opción múltiple sigue disponible, porque puede haber centros que no estén entre las 20 sugerencias).
6. **Sincronización del input**: el combobox guarda en una `ref` la última selección que notificó al padre, para
   distinguir los cambios externos de los propios. Sin eso, al elegir el modo múltiple el padre descartaba la
   selección por id y el input se vaciaba, perdiendo el texto aplicado.
7. **El botón "Limpiar" del panel remonta el buscador** (`key` con un contador) para que no conserve el texto
   escrito ni la selección anterior.

**Ejemplo de uso (modo múltiple)**: escribir "FALABELLA" → el desplegable muestra
"Todos los centros que coincidan con «FALABELLA»" + las coincidencias individuales → se elige la opción especial
→ "Aplicar filtros" → la tabla muestra las líneas de los 38 centros FALABELLA
(`GET /api/v1/lineas?centro_coste_busqueda=FALABELLA`).

**Ejemplo de uso (modo exacto)**: escribir "ZZTEST-A" → se elige la coincidencia "ZZTEST-A · CENTRO ZZTEST ALFA"
→ "Aplicar filtros" → la tabla muestra solo las líneas de ese centro
(`GET /api/v1/lineas?centro_coste_id=<uuid>`).

**Archivos creados**: ninguno.

**Archivos modificados**:

- `src/application/ports/repositories/LineaRepository.ts` (`centroCosteBusqueda` en `FiltrosLinea`).
- `src/infrastructure/database/repositories/linea.repository.ts` (`condicionBusquedaCentroCoste()`).
- `src/infrastructure/http/schemas/linea.schemas.ts` (`centro_coste_busqueda`).
- `src/infrastructure/http/controllers/linea.controller.ts` (mapeo y `normalizarBusqueda()`).
- `presentation/src/components/lineas/CentroCosteCombobox.tsx` (prop `onSeleccionMultiple`, opción múltiple,
  sincronización del input).
- `presentation/src/components/lineas/LineasFilters.tsx` (los dos modos, remonte al limpiar).
- `presentation/src/components/lineas/LineaFormModal.tsx` (comentario: sin modo múltiple).
- `presentation/src/types/api.ts` (`centro_coste_busqueda` en `FiltrosLineas`), `presentation/src/hooks/useLineas.ts`
  (comentario), `presentation/src/pages/Lineas.tsx` (comentario), `presentation/src/styles.css`
  (`.combobox__opcion--multiple`).
- `tests/integration/database/linea.repository.test.ts`, `tests/unit/application/services/linea.service.test.ts`,
  `tests/integration/http/api.test.ts`, `tests/e2e/centros-busqueda.spec.ts`.
- `specs/001-gestion-lineas-telefonicas/spec.md` (nota junto a RF-UI-LIN-1.2), `specs/.../tasks.md` (T-10e).

**Tests**: integración del repositorio (fragmento de nombre, fragmento de código, centro concreto, combinado con
otro filtro, sin coincidencias, exportación y paginación por cursor); unitario del service (el filtro llega al
repositorio en `listar` y en `exportar`); HTTP (el listado devuelve solo las líneas que coinciden, combinado con
otros filtros, la exportación con el mismo filtro y 400 con un texto de 101 caracteres); E2E (el modo múltiple
muestra las dos líneas de dos centros que comparten fragmento y el modo exacto muestra una sola; el formulario no
ofrece el modo múltiple). Los tests E2E de T-10c/T-10d se **adaptaron** a la nueva opción (ahora el desplegable
tiene una opción más): los que contaban `.combobox__opcion` ahora cuentan
`.combobox__opcion:not(.combobox__opcion--multiple)`.

**Comandos verificados**: `pnpm test` → **356 tests OK** (19 archivos); `pnpm test:e2e` → **21 tests E2E OK**;
`pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK; `pnpm --dir presentation typecheck` OK;
`pnpm --dir presentation build` OK (115 módulos).

## Fix del test flaky de centro-coste.service.test.ts (2026-11-04)

**Motivo**: queda pendiente (f) de la validación de la spec 001: el test "devuelve las filas con el nombre del formato"
(`describe('exportar')`) de `tests/unit/application/services/centro-coste.service.test.ts` fallaba de forma
intermitente (~1 de cada 5 ejecuciones de la suite).

**Causa raíz**: el test invocaba dos veces la factory `centroPersistido()` —una para el mock de
`centrosCoste.listarTodos` y otra dentro de la aserción `toEqual`—. La factory crea la entidad con
`CentroCoste.crearCentroCoste(...)`, que asigna `createdAt = new Date()` por defecto, así que las dos instancias
podían caer en milisegundos distintos y el `toEqual` fallaba.

**Solución aplicada** (solo tests; no se tocó `src/`):

1. La factory `centroPersistido()` (y también `formatoPersistido()`) ahora inyecta una **fecha fija** `AHORA`
   (`new Date('2026-11-04T12:00:00.000Z')`) mediante el parámetro `ahora` que ya ofrecen las factories del dominio
   (`CentroCoste.crearCentroCoste(input, ahora)` y `Formato.crearFormato(input, ahora)`), de modo que el test ya no
   depende del reloj.
2. En el test de `exportar` se crea **una sola instancia** de la entidad (`const centro = centroPersistido();`) y se
   reutiliza tanto en el mock (`{ centro, formatoNombre: 'SMU' }`) como en la aserción (`createdAt: centro.createdAt.toISOString()`).

**Revisión del mismo patrón en otros tests**: se revisaron `formato.service.test.ts`, `linea.service.test.ts` y
`dashboard.service.test.ts` (y el resto de `tests/unit/`). **No existe** el patrón "factory con `new Date()` llamada
dos veces en la misma aserción" en ninguno de ellos: en `formato.service.test.ts` las aserciones de `createdAt`/
`updatedAt` ya usan una única instancia (`const persistido = formatoPersistido('SMU')`); en `linea.service.test.ts` y
`dashboard.service.test.ts` no se comparan timestamps. No requirieron cambios.

**Archivos modificados**:

- `tests/unit/application/services/centro-coste.service.test.ts` (fecha fija en las factories + reutilización de una
  sola instancia en el test de `exportar`).
- `MEMORY.md` (esta sección + pendiente (f) marcado como resuelto).

**Comandos verificados**: `pnpm test` → **356 tests OK** (19 archivos), ejecutado **10 veces seguidas** en bucle
(0 fallos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` OK;
`pnpm exec prettier --write` sobre el archivo tocado (sin cambios pendientes).

## T-11 completada — Formatos por nombre + cursor con columna (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2, `plan.md` §D.2.1).
**RFs**: RF-FMT-1.3 y RF-ORD-1.4.

**Cambios**:

1. **Sobre del cursor `{ v, id, c }`** (`cursor.ts`): `codificarCursor(valor, id, columna)` escribe siempre la columna
   de orden y `decodificarCursor(cursor, columnaEsperada)` la exige (`c === columnaEsperada`). Un cursor de otra columna
   o legado (sin `c`) lanza `ValidationError` → **400 RFC 7807**. Decisión D.3 del plan: los cursores emitidos antes del
   despliegue dejan de ser válidos; el cursor es opaco y efímero y fallar rápido evita paginar en silencio por la
   columna equivocada.
2. **Formatos** (`formato.repository.ts`): `listar()` pasa a `ORDER BY nombre ASC, id ASC` con keyset
   `(nombre, id) > ($v::text, $id::uuid)` y cursor `codificarCursor(nombre, id, 'nombre')`. `listarTodos()` no cambia
   (el export ya ordenaba por `nombre ASC`).
3. **Centros de coste y líneas**: solo se adapta la llamada al nuevo sobre — centros usa `'created_at'` y líneas pasa su
   columna de orden actual (`numero`, `costo_mensual`, `fecha_asignacion` o `created_at`). Sin cambios de comportamiento.

**Archivos creados**:

- `tests/unit/infrastructure/cursor.test.ts` (5 tests).

**Archivos modificados**:

- `src/infrastructure/database/repositories/cursor.ts`
- `src/infrastructure/database/repositories/formato.repository.ts`
- `src/infrastructure/database/repositories/centro-coste.repository.ts`
- `src/infrastructure/database/repositories/linea.repository.ts`
- `tests/integration/database/formato.repository.test.ts` (2 tests nuevos)
- `tests/integration/http/api.test.ts` (4 tests nuevos)
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-11 `[x]`), `specs/.../plan.md` (aprobación del delta v1.2),
  `MEMORY.md` (esta sección).

**Tests nuevos (11)**: unitario del cursor (ida y vuelta con columna, sobre `{v,id,c}`, rechazo de otra columna, rechazo
de cursor legado, rechazo de base64url inválido); repositorio (orden `ALFA → MU → ZETA` paginando con `limit: 1` sin
repetir ni saltar + cursor `{ v: 'ALFA', c: 'nombre' }`; rechazo con cursor de otra columna); HTTP
(`GET /api/v1/formatos?limit=2` devuelve `ALFA, MU` y el `next_cursor` continúa con `ZETA`; 400 con cursor de otra
columna y con cursor legado; el export sigue ordenado por nombre).

**Desviaciones**: la aserción HTTP del cursor inválido comprueba `detail` (el `ValidationError` de dominio no emite
`errors[]`, que solo añaden los errores de Zod/AJV); el resto, igual al plan.

**Comandos verificados**: `pnpm test` → **367 tests OK** (20 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre los 7 archivos tocados.

## T-12 completada — Líneas: 9 columnas ordenables (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2, `plan.md` §D.2.2).
**RFs**: RF-ORD-1.1, RF-ORD-1.2 y RF-ORD-1.3.

**Decisiones**:

1. **Conjunto cerrado de 9 columnas** en `ColumnaOrdenLinea`: `numero`, `proveedor`, `centro_coste_codigo`,
   `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `estado`, `tipo_uso` y `created_at`. El servicio no cambió: su
   `OpcionesListarLineas` reutiliza el tipo del puerto.
2. **Mapa `COLUMNAS_ORDEN` con cast por columna**: `text` para las de texto, `date` para `fecha_asignacion`, `numeric`
   para `costo_mensual` (así `900 < 1000`, no orden lexicográfico) y `timestamptz` para `created_at`. El cursor sigue
   guardando `String(fila.costoMensual)` (p. ej. `'900.00'`) y el `toISOString()` de `created_at`.
3. **`centro_coste_codigo` sobre el JOIN**: la expresión es `centros_coste.codigo` (cast `text`), la misma que usa el
   `ORDER BY`; el keyset `(centros_coste.codigo, lineas_telefonicas.id)` pagina correctamente aunque la columna no
   pertenezca a `lineas_telefonicas`. `codigo` es único, así que el desempate por `id` solo actúa entre líneas del
   mismo centro (probado con dos líneas del mismo centro).
4. **`empleado` queda FUERA** (decisión Q4): es `NULL`-able y rompería el keyset. Retirar la capacidad de ordenar no
   toca el filtro `empleado`, que sigue funcionando. `sort=empleado` y cualquier valor inventado responden **400** por
   el enum de Zod (`errors[]` en el RFC 7807), sin tocar el `error-handler`.
5. **Controlador sin casts**: `QueryLinea.sort`/`order` se tipan con `ColumnaOrdenLinea`/`DireccionOrden` y se pasan
   directamente al servicio. El enum de `lineaQuerySchema` (del que hereda el de exportación) se amplió a los 9 valores.
6. **Exportación sin cambios**: `GET /api/v1/lineas/export` nunca respetó `sort` (su repositorio ordena por
   `created_at DESC, id DESC`); se mantiene igual, como pedía la tarea ("si ya lo hacía").

**Archivos modificados**:

- `src/application/ports/repositories/LineaRepository.ts` (`ColumnaOrdenLinea` con 9 columnas).
- `src/infrastructure/database/repositories/linea.repository.ts` (`COLUMNAS_ORDEN` y `valorCursor()` con los 9 casos).
- `src/infrastructure/http/schemas/linea.schemas.ts` (enum `sort` con los 9 valores).
- `src/infrastructure/http/controllers/linea.controller.ts` (`sort`/`order` tipados, sin casts).
- `tests/integration/database/linea.repository.test.ts` (+1 test).
- `tests/integration/http/api.test.ts` (+1 test).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-12 `[x]`), `MEMORY.md` (esta sección).

**Tests nuevos (2)**:

- Repositorio: 3 líneas de 2 centros con valores distintos y fechas de creación fijas; para cada una de las 9 columnas
  se recorre el listado con `limit: 1` en `asc` y `desc` (18 recorridos) comprobando 3 páginas, ids únicos y el orden
  exacto (con desempate por id en `centro_coste_codigo`, `tipo_linea` y `tipo_uso`, y `900 < 1000` en `costo_mensual`).
- HTTP: `sort=proveedor&order=asc` ordenado; `sort=centro_coste_codigo` devuelve 200 y su `next_cursor` continúa en el
  segundo código; `sort=tipo_uso` devuelve 200; `sort=empleado` y `sort=inventado` responden 400 RFC 7807 con `errors[]`.

**Desviaciones**: ninguna funcional. En el test de repositorio, la primera redacción fallaba `pnpm typecheck` por
`noUncheckedIndexedAccess` al desestructurar `[idB, idC].sort()`; se sustituyó por accesos indexados con `?? ''`
(solo test). Nota: `tasks.md`/`plan.md` siguen con las 2 líneas no formateadas preexistentes que reformateará T-19.

**Comandos verificados**: `pnpm test` → **369 tests OK** (20 archivos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre los 6 archivos de código tocados.

**Prueba de no vacuidad del test de repositorio**: se comprobó que el test de las 9 columnas **detecta** una regresión
real — cambiando temporalmente el cast del cursor de `costo_mensual` de `numeric` a `text` (orden lexicográfico), el
test "ordena y pagina por las 9 columnas en ambos sentidos" **falla** (1 de 13). El cambio se revirtió y la suite
volvió a verde. El test no es vacuoso.

## T-13 completada — UI: columnas ordenables de la tabla de líneas (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2, `plan.md` §D.2.2 → «UI (RF-ORD-1.5)»).
**RFs**: RF-ORD-1.5.
**Alcance**: solo la SPA (`presentation/`). **No** se tocó `src/` (el backend de T-12 ya acepta las 9 columnas y
responde 400 fuera del conjunto).

**Decisiones**:

1. **Mapa tabla → API** (`ORDENABLES` en `LineasTable.tsx`): la clave de la tabla y la columna de la API **no
   coinciden** en un caso (`centro_coste` → `centro_coste_codigo`). Enviar `sort=centro_coste` haría que la API
   respondiera 400, así que el mapa es la fuente de verdad de ambas cosas.

   | clave de la tabla  | columna de la API     |
   | ------------------ | --------------------- |
   | `numero`           | `numero`              |
   | `proveedor`        | `proveedor`           |
   | `centro_coste`     | `centro_coste_codigo` |
   | `fecha_asignacion` | `fecha_asignacion`    |
   | `costo_mensual`    | `costo_mensual`       |
   | `tipo_linea`       | `tipo_linea`          |
   | `estado`           | `estado`              |
   | `tipo_uso`         | `tipo_uso`            |

   Son **8**: las 9 columnas visibles de la tabla menos `empleado` (Q4: admite `NULL` y rompería el cursor _keyset_).
   `created_at` **no** se ofrece (no es una columna visible de la tabla), aunque la API sí la admita: el conjunto de la
   UI es un **subconjunto** del de la API, como exige RF-ORD-1.5.

2. **El estado `sort` guarda la columna de la API** (`centro_coste_codigo`), no la clave de la tabla. La flecha activa
   se calcula **mapeando la clave de la tabla** (`ORDENABLES[columna.clave]`), de modo que el resaltado y el query
   string coinciden siempre. `onOrden` recibe la columna de la API.
3. **Reinicio de la paginación al cambiar el orden** (`Lineas.tsx` → `alternarOrden` llama a `reiniciarPaginacion()`).
   Es una **consecuencia directa de T-11/T-12**: el cursor viaja con la columna de orden (`c`) y la API rechaza con 400
   un cursor de otra columna. Sin el reinicio, cambiar de columna estando en la página 2 dejaría la tabla en error.
   Se reinicia también al invertir la dirección (`asc` ↔ `desc`), porque la comparación _keyset_ cambia de sentido.
4. **Tipos nuevos en `presentation/src/types/api.ts`**: `ColumnaOrdenLinea` (las 8 columnas de la UI) y
   `FiltrosLineas.sort`/`order` tipados con ese tipo y con `'asc' | 'desc'` (antes eran `string`).
5. **El export no cambia**: la exportación usa `filtros` (sin `sort`), como antes. La API tampoco respetaba `sort` en
   el export (ver T-12), así que no hay regresión.

**Archivos creados**:

- `tests/e2e/lineas-orden.spec.ts` (4 tests E2E).

**Archivos modificados**:

- `presentation/src/types/api.ts` (`ColumnaOrdenLinea`, `FiltrosLineas.sort`/`order`).
- `presentation/src/components/lineas/LineasTable.tsx` (mapa `ORDENABLES`, props tipadas, flecha activa por mapa).
- `presentation/src/pages/Lineas.tsx` (`sort`/`order` tipados, `alternarOrden` con reinicio de paginación).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-13 `[x]`), `MEMORY.md` (esta sección).

**Tests nuevos (4, todos E2E)**:

1. Orden por proveedor: la petición lleva `sort=proveedor&order=asc` y las filas quedan ordenadas por proveedor
   (Alfa, Medio, Zeta), en un orden distinto del por defecto (`created_at DESC`).
2. Orden por centro de coste: la petición lleva `sort=centro_coste_codigo` (no `centro_coste`) y las filas quedan
   ordenadas por código.
3. Las 8 cabeceras ordenables son `button` con los títulos esperados y "Empleado" **no** es un `button` (pero sigue
   siendo una columna visible).
4. Al cambiar de columna de orden **se reinicia la paginación**: con 21 líneas, tras pasar a la página 2 (que viaja con
   `after_id`), el siguiente cambio de orden vuelve a la página 1 **sin** `after_id`.

**Defecto real encontrado y corregido**: sin el reinicio de la paginación, cambiar de columna de orden en la página 2
enviaría un cursor emitido para otra columna (`c: 'created_at'`), que la API rechaza con **400**. Detectado al escribir
el E2E nº 4.

**Prueba de no vacuidad**: se comprobó que el E2E nº 4 **detecta** la regresión — comentando temporalmente la llamada a
`reiniciarPaginacion()`, el test falla con `after_id` presente (el cursor `{"v":"2026-11-05T21:14:21.158Z","id":…,
"c":"created_at"}`). Se revirtió y la suite volvió a verde.

**Desviaciones**: ninguna funcional respecto del plan. El plan pedía "crear dos líneas"; se crean **tres** con
proveedores y centros distintos para que el orden pedido sea distinguible del orden por defecto (`created_at DESC`) en
las mismas aserciones.

**Comandos verificados**: `pnpm test:e2e` → **25 tests E2E OK** (21 previos + 4 nuevos); `pnpm test` → **369 tests OK**
(20 archivos, sin cambios: la suite unitaria no cubre la SPA); `pnpm --dir presentation typecheck` OK;
`pnpm --dir presentation build` OK (115 módulos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre los 4 archivos tocados.

## T-14 completada — Unitarios de sanitización y normalización (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2).
**RFs**: RF-VAL-1.4 (sanitización de fórmulas) y RF-VAL-1.5 (casos límite de `normalizePhone`), verificados por
RF-QUAL-1.4 y RF-QUAL-1.5.

**Resultado: los tests nuevos pasan SIN modificar `src/`.** No se encontró ningún defecto: la sanitización **ya existe**
y está en el lugar esperado (el servicio de importación), y `normalizePhone()` ya resuelve los tres casos límite de
RF-VAL-1.5.

### Hallazgo: dónde está implementada la sanitización

La sanitización vive en **`src/application/services/import.service.ts`** (no en el repositorio ni en el dominio), en la
función privada `sanitizar()` (`:634`), que aplica el regex `PREFIJOS_PELIGROSOS = /^[=+\-@]/` (`:40`):

| celda                          | línea  | se sanitiza                         |
| ------------------------------ | ------ | ----------------------------------- |
| `codigo` (centros)             | `:133` | sí                                  |
| `nombre` (centros)             | `:134` | sí                                  |
| `formato_nombre` (centros)     | `:135` | sí                                  |
| `empleado` (líneas)            | `:493` | sí                                  |
| `proveedor` (líneas)           | `:504` | sí                                  |
| `numero` (líneas)              | `:353` | **no** (usa `obtenerCelda` directo) |
| `centro_coste_codigo` (líneas) | `:373` | **no** (usa `obtenerCelda` directo) |

Consecuencia útil: el `formato_nombre` sanitizado es el nombre con el que **se crea el formato** en la ruta de
creación automática (`formatosFaltantes` → `Formato.crearFormato({ nombre })`, `:298`), así que el formato creado
queda con el apóstrofo (`'=PELIGRO'`).

### Archivos modificados (solo tests)

- `tests/unit/application/services/import.service.test.ts` (+22 tests).
- `tests/unit/domain/PhoneNumber.test.ts` (+4 tests).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-14 `[x]`), `MEMORY.md` (esta sección).

**Ningún archivo de `src/` fue modificado** (verificado: `import.service.ts` y `PhoneNumber.ts` quedaron idénticos al
estado inicial).

### Tests nuevos (26)

**Sanitización (RF-VAL-1.4) — 22 tests** en el nuevo `describe('sanitización de fórmulas (RF-VAL-1.4)')`:

- Centros de coste: `codigo` ×4 prefijos (`=`, `+`, `-`, `@`), `nombre` ×4 y `formato_nombre` ×4 (con
  `crearFormatosFaltantes: true`, comprobando que el formato creado y `reporte.formatosCreados` quedan con el
  apóstrofo).
- Líneas: `proveedor` ×4 y `empleado` ×4.
- Campos que **NO** se sanitizan (2): `numero` (el `+` es prefijo peligroso: si se sanitizara, la normalización fallaría
  y la fila sería un error → se comprueba `insertados === 1` y `numero === '+56912345678'`) y `centro_coste_codigo`
  (el mock de `buscarPorCodigos` **se comporta como el repositorio real** y solo devuelve el centro cuyo código
  coincide; si el código se sanitizara, la búsqueda sería por `'=PELIGRO'` y no habría coincidencia → además se
  comprueba que se pidió `['=peligro']`).

**Normalización (RF-VAL-1.5) — 4 tests** en el nuevo `describe('normalizePhone — casos límite de RF-VAL-1.5')`:
`"+560 9 1234 5678"` y `"056 9 1234 5678"` → `{ normalized: '+56912345678', tipo: 'movil' }`;
`"5612345678"` → `{ normalized: '+565612345678', tipo: 'fijo' }` (decisión Q5: fijo regional de área 56, no prefijo de
país mal escrito), más un test explícito del mismo caso.

### Pruebas de no vacuidad (3 mutaciones temporales, revertidas)

1. `PREFIJOS_PELIGROSOS` reducido a `/^=/` → **fallan 15 tests** (los de los prefijos `+`, `-` y `@` en los 5 campos).
2. `numero` pasado por `sanitizar()` → **falla** el test "no sanitiza el número de teléfono".
3. `centro_coste_codigo` pasado por `sanitizar()` → **falla** el test "no sanitiza el código de centro de coste".
4. `normalizePhone`: se restringió el largo con prefijo de país y la lista de prefijos fijos regionales → **fallan** los
   tests de `"056 9 1234 5678"` y de `"5612345678"`.

Las tres mutaciones de `src/` se revirtieron y se comprobó con `Select-String` que no quedó ninguna marca `TEMP` en el
código de producción.

### Desviaciones

Ninguna funcional. El plan no especificaba cuántos casos por campo; se hizo la matriz completa **4 prefijos × 5
campos sanitizables** = 20 casos, más los 2 casos de "no se sanitiza", tal como pide RF-QUAL-1.4 ("un caso por prefijo
y por campo de texto importable").

### Comandos verificados

`pnpm test` → **395 tests OK** (20 archivos; 369 previos + 26 nuevos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre los 2 archivos de test tocados.

## T-15 completada — HTTP: If-Match, incluir_bajas, 413, masivo y reactivación (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2).
**RFs**: RF-QUAL-1.1, RF-QUAL-1.2 (parte HTTP), RF-QUAL-1.3, RF-QUAL-1.10 (parte HTTP) y RF-QUAL-1.11.

**Resultado: los cinco grupos pasan SIN modificar `src/`.** No se detectó ningún defecto real: todo el comportamiento
exigido ya estaba implementado.

### Archivos modificados (solo tests)

- `tests/integration/http/api.test.ts` (+6 tests, nuevo `describe('calidad (RF-QUAL)')`).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-15 `[x]`), `MEMORY.md` (esta sección).

**Ningún archivo de `src/` fue modificado** (verificado tras las 4 mutaciones temporales de la prueba de no vacuidad:
`if-match.ts`, `linea.repository.ts`, `linea.service.ts` y `LineaTelefonica.ts` quedaron idénticos al estado inicial).

### Tests nuevos por grupo (6)

1. **If-Match (RF-QUAL-1.1)** — 1 test: `PUT /api/v1/formatos/:id` con `W/"1"` → 200 y `version: 2`; con `"2"` → 200 y
   `version: 3`; con `abc`, `0` y `W/"x"` → **400** RFC 7807 (en bucle, con mensaje en el `expect`); con `"1"` (versión ya
   superada) → **409** y el recurso **no cambia** (se comprueba con un `GET` posterior: sigue con el nombre anterior y
   `version: 3`).
2. **incluir_bajas (RF-QUAL-1.2)** — 1 test: se crean **dos** líneas (una vigente y otra dada de baja) para que el export
   nunca esté vacío y la ausencia de la línea de baja sea concluyente. Sin el parámetro y con `incluir_bajas=false` el
   CSV contiene la vigente y **no** la de baja; con `incluir_bajas=true` contiene **las dos**.
3. **413 (RF-QUAL-1.3)** — 2 tests (uno por endpoint, como pide el riesgo de la tarea): un **único** buffer de
   `MAX_BYTES_ARCHIVO + 1024` bytes, compartido por los dos, envuelto en multipart → **413** con
   `type: https://telefono2.local/errors/payload-too-large` y
   `detail: "El archivo supera el tamaño máximo permitido (10 MB)."` en `/api/v1/import/centros-coste` y en
   `/api/v1/import/lineas`.
4. **Masivo (RF-QUAL-1.11)** — 1 test: 2 ids válidos + 1 UUID inexistente → `{ actualizadas: 2, ignoradas: 0,
fallidas: 1 }` (comparación exacta del objeto) y las 2 líneas quedan en `activa` (verificado con un `GET` por id).
5. **Reactivación (RF-QUAL-1.10)** — 1 test: `PATCH /api/v1/lineas/:id/estado` a `baja` → 200; a `activa` → 200;
   `GET /api/v1/lineas` vuelve a listar la línea (1 item) con `deleted_at: null`.

### Pruebas de no vacuidad (4 mutaciones temporales de `src/`, revertidas)

| mutación                                                               | resultado                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `versionEsperadaDe()` devuelve siempre `undefined` (ignora `If-Match`) | **falla** el test de If-Match (`If-Match: abc: expected 200 to be 400`) |
| `exportar()` ignora `incluir_bajas` y siempre excluye las bajas        | **falla** el test de `incluir_bajas`                                    |
| `cambiarEstadoMasivo()` devuelve siempre `fallidas: 0`                 | **falla** el test del masivo                                            |
| `cambiarEstado()` no limpia `deletedAt` al salir de `baja`             | **falla** el test de reactivación                                       |

Las cuatro se revirtieron y se comprobó con `Select-String` que no quedó ninguna marca `TEMP` en el código de
producción.

### Comportamiento verificado (dónde está implementado)

- **`If-Match`**: `src/infrastructure/http/if-match.ts` (`versionEsperadaDe`) parsea `W/"n"`, `"n"` y rechaza con
  `ValidationError` (→ 400) lo que no sea un entero ≥ 1; el `ConflictError` del servicio (→ 409) está en
  `formato.service.ts:80`.
- **413**: el límite `fileSize: MAX_BYTES_ARCHIVO` de `@fastify/multipart` (`src/app.ts:63`) hace que `toBuffer()` lance
  `FST_REQ_FILE_TOO_LARGE`, que el `error-handler` mapea a la rama `payload-too-large` (413). El `bodyLimit` global de
  Fastify (1 MB) **no** aplica a los parsers custom, así que el 413 proviene del límite de archivo y no del cuerpo.
- **`incluir_bajas`**: `linea.repository.ts:335` (`exportar`) aplica el filtro `deleted_at IS NULL` cuando el parámetro
  es `false` u omitido.
- **`fallidas`**: `linea.service.ts:199` mapea `resultado.noEncontrados` (calculado en `actualizarEstadoMasivo`) a
  `fallidas`.
- **Reactivación**: `LineaTelefonica.cambiarEstado()` (`src/domain/entities/LineaTelefonica.ts:239`) limpia `deletedAt`
  al salir de `baja`.

### Desviaciones

Ninguna funcional respecto del plan. En el grupo de `incluir_bajas` se crea una segunda línea vigente (el plan solo
mencionaba "crear una línea y darla de baja"): sin ella, la aserción `not.toContain` pasaría también con un export
siempre vacío, es decir, el test sería vacuo.

### Comandos verificados

`pnpm test` → **401 tests OK** (20 archivos; 395 previos + 6 nuevos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre el archivo de test tocado.

## T-16 completada — HTTP: KPIs sin caché, export .xlsx e import case-insensitive (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2).
**RFs**: RF-QUAL-1.8, RF-QUAL-1.9 y RF-QUAL-1.12.

**Resultado: los tres grupos pasan SIN modificar `src/`.** No se detectó ningún defecto real: los tres comportamientos ya
estaban implementados.

**Dependencias**: `xlsx` **ya estaba** en `dependencies` (`xlsx@0.20.3` desde el CDN de SheetJS, instalado en T-05), así que
**no se añadió ninguna dependencia** a `package.json`.

### Archivos modificados (solo tests)

- `tests/integration/http/api.test.ts` (+5 tests; nuevo `import * as XLSX from 'xlsx'` y los helpers `esArchivoXlsx()` y
  `primeraFilaXlsx()`).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-16 `[x]`), `MEMORY.md` (esta sección).

**Ningún archivo de `src/` fue modificado** (verificado tras las 5 mutaciones temporales de la prueba de no vacuidad:
`dashboard.repository.ts`, `export.ts`, `centro-coste.controller.ts` e `import.service.ts` quedaron idénticos al estado
inicial).

### Tests nuevos por grupo (5)

1. **KPIs sin caché (RF-QUAL-1.8)** — 1 test: se crea una línea (nace en `pendiente`) → `GET /api/v1/dashboard/kpis`
   → `total_lineas: 1, lineas_activas: 0`; `PATCH /api/v1/lineas/:id/estado` a `activa` → 200; segundo
   `GET /api/v1/dashboard/kpis` → `lineas_activas: 1`.
2. **Exportación `.xlsx` (RF-QUAL-1.9)** — 3 tests (uno por recurso): líneas, centros de coste y formatos. Cada uno
   comprueba el `content-type` de Excel
   (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), el nombre de archivo extraído del
   `content-disposition` contra `^(lineas|centros_coste|formatos)_\d{8}_\d{6}\.xlsx$`, que el contenido **sea realmente
   un `.xlsx`** (firma ZIP `PK\x03\x04`) y que la primera fila del libro sea la lista de cabeceras de
   `COLUMNAS_EXPORT_LINEAS` / `COLUMNAS_EXPORT_CENTROS` / `COLUMNAS_EXPORT_FORMATOS`.
   Las cabeceras esperadas están **escritas a mano** en el test (no importadas de `export.ts`), para que el test no sea
   tautológico.
3. **Importación case-insensitive (RF-QUAL-1.12)** — 1 test: formato `SMU` existente + CSV con `formato_nombre: smu` →
   200, `insertados: 1`, `errores: []`; el centro creado apunta al `formato_id` de `SMU` y **no** se creó ningún formato
   nuevo (el listado de formatos sigue teniendo solo `SMU`).

### Hallazgo importante: los tests `.xlsx` eran vacuous tal como los escribió la tarea

La primera redacción del grupo `.xlsx` releía `respuesta.rawPayload` con `XLSX.read(...)` y comprobaba la primera fila,
**sin** verificar el formato real del archivo. Al mutar `construirArchivo()` para que siempre devolviera un CSV, **los
tres tests siguieron pasando**: `XLSX.read` **detecta el formato automáticamente** y también lee un CSV, de modo que un
CSV con nombre `.xlsx` y `content-type` de Excel pasaba el test.

**Corrección**: se añadió el helper `esArchivoXlsx()`, que comprueba la **firma ZIP `PK\x03\x04`** (un `.xlsx` es un
contenedor OOXML). Con esa aserción, la misma mutación hace fallar los tres tests. Es un recordatorio de que "releer con
`XLSX.read`" **no** prueba que el archivo sea un `.xlsx`.

### Pruebas de no vacuidad (5 mutaciones temporales de `src/`, revertidas)

| mutación                                                          | resultado                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DrizzleDashboardRepository` cachea los KPIs en una instancia     | **falla** el test de KPIs (la 2ª llamada devuelve el valor cacheado)     |
| `construirArchivo()` ignora el formato y siempre devuelve CSV     | **fallan los 3** tests de `.xlsx` (solo tras añadir la firma ZIP)        |
| `nombreArchivoExport('centros_coste')` → `'centros'`              | **falla** el test de centros de coste (el riesgo señalado por la tarea)  |
| La clave del formato deja de normalizarse a minúsculas (2 sitios) | **fallan 2** tests (el de import case-insensitive y otro de importación) |

Las cinco se revirtieron y se comprobó con `Select-String` que no quedó ninguna marca `TEMP` en el código de producción.

### Comportamiento verificado (dónde está implementado)

- **KPIs sin caché**: `src/infrastructure/database/repositories/dashboard.repository.ts` ejecuta los 4 `COUNT` en
  `Promise.all` en cada llamada, sin caché; la ruta (`dashboard.routes.ts`) no declara ninguna cabecera de caché.
- **Export `.xlsx`**: `src/infrastructure/http/export.ts` (`construirXlsx` con `XLSX.write`) y `formatoExportacionQuerySchema`
  (`format: z.enum(['csv','xlsx'])`); los tres prefijos de nombre son `lineas`, `centros_coste` y `formatos`.
- **Import case-insensitive**: `import.service.ts` normaliza la clave del formato a minúsculas (`:163` y `:239`) y
  `formato.repository.ts:buscarPorNombres` busca con `lower(nombre)`.

### Desviaciones

Ninguna funcional respecto del plan. Se añadieron a los tests `.xlsx` dos comprobaciones que la tarea no pedía de forma
explícita pero que son necesarias para que el test **no sea vacuo**: la firma ZIP del archivo y las cabeceras esperadas
escritas a mano en lugar de importadas de `COLUMNAS_EXPORT_*`.

### Comandos verificados

`pnpm test` → **406 tests OK** (20 archivos; 401 previos + 5 nuevos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre el archivo de test tocado.

## T-17 completada — E2E: segunda página, validación cliente, bajas y reactivación (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2).
**RFs**: RF-QUAL-1.6, RF-QUAL-1.7, RF-QUAL-1.2 (parte E2E) y RF-QUAL-1.10 (parte E2E).

**Resultado: los cuatro escenarios pasan SIN modificar `src/` ni `presentation/`.** No se detectó ningún defecto real: los
cuatro comportamientos ya estaban implementados.

### Archivos

**Creados**:

- `tests/e2e/lineas-paginacion.spec.ts` (1 test E2E).
- `tests/e2e/lineas-validacion.spec.ts` (1 test E2E).

**Modificados**:

- `tests/e2e/lineas-crud.spec.ts` (+2 tests E2E y el helper `contenidoDe(descarga)`).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-17 `[x]`), `MEMORY.md` (esta sección).

**Ningún archivo de `src/` ni de `presentation/src/` fue modificado** (verificado tras las 4 mutaciones temporales de la
prueba de no vacuidad: `presentation/src/pages/Lineas.tsx`, `presentation/src/components/lineas/LineaFormModal.tsx` y
`src/domain/entities/LineaTelefonica.ts` quedaron idénticos al estado inicial).

### Tests E2E nuevos por escenario (4)

1. **Segunda página (RF-QUAL-1.6)** — `lineas-paginacion.spec.ts`: se crea un centro y se preparan **21 líneas con una
   sola** importación CSV (`POST /api/v1/import/lineas` en multipart, con `request.post(..., { multipart: {...} })`);
   `/lineas` muestra 20 filas (con 20 números distintos); tras "Siguiente ›" la segunda página muestra 1 fila y **ningún**
   número repetido respecto de la primera.
2. **Validación cliente (RF-QUAL-1.7)** — `lineas-validacion.spec.ts`: "Nueva línea" → "Crear línea" sin datos →
   visibles "El número es obligatorio" y "Selecciona un centro de coste"; con número y centro válidos y costo `-1` →
   "El costo no puede ser negativo" (y los otros dos errores desaparecen). Se cuenta con `page.on('request')` que **no
   sale ninguna** petición `POST /api/v1/lineas` (se compara el `pathname` exacto para no contar
   `/api/v1/lineas/estado/masivo`).
3. **incluir bajas (RF-QUAL-1.2)** — `lineas-crud.spec.ts`: línea creada y dada de baja por API; sin marcar la opción el
   CSV descargado **no** contiene el número; al marcar "Incluir líneas dadas de baja en la exportación" el CSV **sí** lo
   contiene. El CSV se lee del **evento de descarga** de Playwright (`page.waitForEvent('download')` +
   `descarga.createReadStream()`), sin tocar el sistema de ficheros.
4. **Reactivación (RF-QUAL-1.10)** — `lineas-crud.spec.ts`: línea creada y dada de baja por API (la UI no lista las
   bajas, así que no se puede reactivar desde la tabla); se reactiva por API
   (`PATCH /api/v1/lineas/:id/estado` con `activa`); tras recargar `/lineas` la fila reaparece y su `select` de estado
   (`Estado de +56912345678`) tiene valor `activa`.

### Pruebas de no vacuidad (4 mutaciones temporales, revertidas)

| mutación                                                                    | resultado                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `LIMITE_PAGINA` de 20 a 100 (SPA)                                           | **falla** el test de paginación (`Expected: 20, Received: 21`)          |
| `LineaFormModal.validar()` devuelve siempre `true` (sin validar)            | **falla** el test de validación (no aparece "El número es obligatorio") |
| El export ignora `incluirBajas` y siempre manda `incluir_bajas=false` (SPA) | **falla** el test de `incluir bajas`                                    |
| `LineaTelefonica.cambiarEstado()` no limpia `deletedAt` al salir de `baja`  | **falla** el test de reactivación (la fila no vuelve al listado)        |

Las cuatro se revirtieron y se comprobó con `Select-String` que no quedó ninguna marca `TEMP` en el código de
producción (los únicos matches restantes son falsos positivos de "templates"/"temporizador"/"empleado").

### Comportamiento verificado (dónde está implementado)

- **Paginación por cursor**: `presentation/src/pages/Lineas.tsx` (`LIMITE_PAGINA = 20`, pila de cursores e
  `indicePagina`); el keyset del backend con desempate por `id` (`src/infrastructure/database/repositories/cursor.ts`).
  Las 21 líneas de la importación comparten `created_at` (misma transacción), pero el desempate por `id` mantiene la
  paginación determinista y sin repeticiones.
- **Validación en cliente**: `presentation/src/components/lineas/LineaFormModal.tsx` (`validar()`), con los tres mensajes
  exactos de la spec; `Error` y `campo__error` los renderiza `Input` / `CentroCosteCombobox`.
- **Opción "incluir bajas"**: `LineasToolbar.tsx` (casilla) y `pages/Lineas.tsx` (`exportar()` envía
  `incluir_bajas` al endpoint `/lineas/export`).
- **Reactivación**: `src/domain/entities/LineaTelefonica.ts:239` (`cambiarEstado()` limpia `deletedAt` al salir de
  `baja`); el listado normal filtra por `deleted_at IS NULL`.

### Desviaciones

Ninguna funcional respecto del plan. En el escenario de `incluir bajas` se añadió la comprobación negativa (sin marcar la
opción el CSV **no** contiene el número) para que la aserción positiva sea concluyente.

### Comandos verificados

`pnpm test:e2e` → **29 tests E2E OK** (25 previos + 4 nuevos); `pnpm test` → **406 tests OK** (20 archivos, sin cambios:
la suite unitaria no cubre la SPA ni los E2E); `pnpm --dir presentation typecheck` OK; `pnpm --dir presentation build` OK
(115 módulos); `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm exec prettier --check` OK sobre los 3 archivos de
`tests/e2e/` tocados.

## T-18 completada — CI: cobertura obligatoria y artefacto (2026-11-05)

**Estado**: `[x]` en `specs/001-gestion-lineas-telefonicas/tasks.md` (delta v1.2).
**RFs**: RF-CI-1.1, RF-CI-1.2 y RF-CI-1.3.

### Línea base de cobertura (medida con `pnpm test:coverage`)

| Métrica    | Antes       | Después     | Umbral | Margen final |
| ---------- | ----------- | ----------- | ------ | ------------ |
| Statements | **81.41 %** | **83.56 %** | 80     | +3.56        |
| Lines      | **81.41 %** | **83.56 %** | 80     | +3.56        |
| Functions  | **93.29 %** | **95.36 %** | 80     | +15.36       |
| Branches   | **85.20 %** | **87.77 %** | 70     | +17.77       |

La línea base **ya alcanzaba** los umbrales (código de salida 0), pero con un margen de solo **1.41 puntos** sobre
statements/lines: demasiado estrecho para una puerta de CI. Por eso se añadieron tests (ver abajo) y la cobertura quedó
con ~3.6 puntos de margen.

**Ningún umbral se bajó** y **no se cambió el alcance de la medición**: `vitest.config.ts` quedó intacto (80/80/80/70
globales, `src/**` con las exclusiones vigentes `src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**`).
La SPA sigue fuera de la medición (decisión del usuario).

### Tests añadidos (19) para ampliar el margen

Todos en `src/infrastructure/http/**` y `src/application/**` (las dos áreas prioritarias de la tarea). Se encontró que
**3 endpoints HTTP no tenían ninguna prueba** (cobertura 0 de su controlador):

- `tests/unit/infrastructure/if-match.test.ts` (**nuevo**, 5 tests): el parser de la cabecera `If-Match` (etiqueta fuerte
  y débil, cabecera repetida, valores inválidos y cabecera repetida vacía). `if-match.ts` pasó de 85.7 % a **100 %**.
- `tests/integration/http/api.test.ts` (+3 tests):
  - `GET`/`PUT`/`DELETE /api/v1/centros-coste/:id` (el endpoint de obtener, el de actualizar y el de eliminar **no tenían
    prueba**): `centro-coste.controller.ts` pasó de 75.6 % a **100 %** y `centro-coste.routes.ts` de 94.7 % a **100 %**.
  - `DELETE /api/v1/centros-coste/:id` con líneas asociadas → 409.
  - `PUT /api/v1/lineas/:id` (tampoco tenía prueba) y su conflicto por `If-Match` desactualizado → 409.
    `linea.controller.ts` pasó de 82.3 % a **99.2 %** y `linea.routes.ts` de 99 % a **100 %**.
- `tests/unit/application/services/linea.service.test.ts` (+5 tests): `actualizar` y `cambiarEstado` con id inexistente
  (`NotFoundError`), conflicto de escritura concurrente (`ConflictError`) y traslado a otro centro de coste existente.
- `tests/unit/application/services/centro-coste.service.test.ts` (+3 tests): `actualizar`/`eliminar` con id inexistente y
  conflicto de escritura concurrente.
- `tests/unit/application/services/formato.service.test.ts` (+2 tests): `actualizar`/`eliminar` con id inexistente y
  eliminación que no afecta ninguna fila.

### Hallazgo: el porcentaje global está topado por archivos de solo tipos

7 archivos de `src/application/ports/**` y `src/application/dto/dashboard.dto.ts` **solo contienen interfaces y tipos**
(383 statements) y el provider `v8` los reporta al **0 %**: nunca podrán cubrirse con tests. El mayor es
`src/application/ports/repositories/LineaRepository.ts` (163 statements al 0 %). Están dentro del alcance `src/**` que
mide `vitest.config.ts` y **no** se pueden excluir sin cambiar la configuración (prohibido en esta tarea). Es el motivo
de que el global se quede en el 83 % aunque `src/infrastructure/http/**` esté prácticamente al 100 %.

### Hallazgo importante: el job `calidad` del CI está rojo por el paso `Format check` (preexistente)

`pnpm format:check` falla hoy por **21 archivos, todos de `specs/001-gestion-lineas-telefonicas/`**
(`_memoria-delta.md`, `_perm_probe*.md`, `plan.md`, `spec.md`, `tasks.md`). Como el paso "Format check" del job
`calidad` se ejecuta **antes** que "Tests con cobertura", el job quedaría **rojo antes de llegar a la puerta de
cobertura**. Es un problema **preexistente y ajeno a T-18** (ya estaba en el CI desde T-10) que **T-19** resuelve: su
paso 4 ejecuta `prettier --write` sobre `MEMORY.md`, `plan.md` y `tasks.md`, y su paso 3 borra los temporales
`_memoria-delta.md` y `_perm_probe*.md`. **T-19 es un prerrequisito para que el CI quede verde.**
Ningún archivo fuera de `specs/` tiene problemas de formato (verificado).

### Cambios en `.github/workflows/ci.yml`

Solo en el job `calidad`; el job `e2e` queda **idéntico** (no se tocó ninguna de sus líneas).

```diff
-      - name: Tests
+      - name: Tests con cobertura
         env:
           DATABASE_URL: postgresql://postgres:postgres@localhost:5432/telefono2_test
-        run: pnpm test
+        run: pnpm test:coverage
+
+      # El reporte se sube incluso si el paso anterior falla por el umbral:
+      # el artefacto interesa justo cuando la cobertura no llega al mínimo.
+      - name: Subir reporte de cobertura
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: cobertura
+          path: coverage/
+          retention-days: 7
```

El paso "Subir reporte de cobertura" va **justo después** de los tests y lleva `if: always()`, de modo que el artefacto se
sube aunque el umbral falle (que es justo cuando más interesa). `coverage/` ya estaba en `.gitignore`.

### Archivos

- `.github/workflows/ci.yml` (modificado): paso de cobertura + artefacto.
- `tests/unit/infrastructure/if-match.test.ts` (**nuevo**).
- `tests/integration/http/api.test.ts` (modificado, +3 tests).
- `tests/unit/application/services/{linea,centro-coste,formato}.service.test.ts` (modificados, +10 tests).
- `specs/001-gestion-lineas-telefonicas/tasks.md` (T-18 `[x]`), `MEMORY.md` (esta sección).

**Ningún archivo de `src/` ni de `presentation/` fue modificado**, ni `vitest.config.ts`, ni `package.json`.

### Desviaciones

Ninguna funcional. La tarea solo pedía cambiar el workflow si la línea base no alcanzaba los umbrales; como **sí** los
alcanzaba, añadir los tests fue opcional, pero se hizo porque el margen de 1.41 puntos era demasiado frágil para una
puerta de CI.

### Comandos verificados

`pnpm test:coverage` → **código de salida 0** (425 tests OK, 21 archivos; `All files: 83.56 % stmts / 87.77 % branch /
95.36 % funcs / 83.56 % lines`); `pnpm test` → **425 tests OK**; `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm exec prettier --check` OK sobre los 6 archivos tocados (`.github/workflows/ci.yml` + 5 de test).

## Actualización de la spec 001 — cierre de deuda técnica (2026-11-05)

**Contexto**: el usuario aprobó cerrar la deuda técnica que la validación dejó abierta **como tareas dentro de la spec 001**
(no como spec nueva). Los 4 puntos: (a) orden del listado de formatos, (b) ordenamiento del listado de líneas, (c) 13 ramas
sin cobertura de tests, (d) enforcement del umbral de cobertura en CI.

**Fase (spec)**: se actualizó `specs/001-gestion-lineas-telefonicas/spec.md` (v1.0 → **v1.1** → **v1.2**) sin tocar
código. En la fase siguiente se escribieron el plan del delta (§D) y las tareas **T-11…T-19** en `plan.md` y `tasks.md`,
también sin tocar código.

**Decisión de fondo (delta, no reescritura)**: el delta **no cambia comportamiento ya implementado** ni reescribe secciones
existentes. Los puntos (a) y (b) **ya estaban exigidos** por la spec (RF-FMT-1.3 y RF-LIN-1.9) → son **trabajo de
cumplimiento**; el delta solo **precisa** su alcance con RFs nuevos. Los puntos (c) y (d) exigían **redacción nueva**.

### RFs añadidos (25)

| Grupo | IDs                        | Qué fija                                                                                                                                                                                                                                                          |
| ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORD   | RF-ORD-1.1 … RF-ORD-1.5    | Conjunto cerrado de **9** columnas ordenables del listado de líneas, coherencia del cursor con la columna de orden, 400 por `sort` inválido, cursor de formatos coherente con el orden por `nombre`, paridad de columnas ordenables en la UI (excepto `empleado`) |
| OPT   | RF-OPT-1.1 … RF-OPT-1.3    | Parseo de `If-Match` (`W/"3"` y `"3"`), 400 por valor inválido, 409 por versión desactualizada                                                                                                                                                                    |
| QUAL  | RF-QUAL-1.1 … RF-QUAL-1.12 | Cobertura de las 13 ramas sin test de `validation.md` §6, una por una                                                                                                                                                                                             |
| CI    | RF-CI-1.1 … RF-CI-1.3      | El CI ejecuta la suite con cobertura y falla si no alcanza el umbral, umbrales **globales** 80% statements / 80% lines / 80% functions / 70% branches sobre `src/**`, y adjunto del reporte como artefacto                                                        |
| VAL   | RF-VAL-1.4, RF-VAL-1.5     | Sanitización de fórmulas (regla 12 de la constitución, que no tenía RF asociado) y casos límite de `normalizePhone`                                                                                                                                               |

**Conteo final**: 56 RF originales (sin cambios) + 25 nuevos = **81 RF**. v1.2 no añade ni elimina RFs.

### Qué se decidió que YA estaba cubierto (no se duplicó ningún RF)

- **(a) RF-FMT-1.3** ya exigía "listar todos los Formatos ordenados por `nombre`". La implementación usa `listar()`
  (`ORDER BY created_at DESC`) en `GET /api/v1/formatos`, mientras `listarTodos()` (`ORDER BY nombre ASC`) solo lo usa el
  export (`src/infrastructure/database/repositories/formato.repository.ts:113` vs `:165-172`). → **Trabajo de cumplimiento**,
  no requisito nuevo. Se añadió solo la **consecuencia técnica** (RF-ORD-1.4): como el listado de formatos es paginado por
  cursor y el cursor viaja hoy sobre `created_at`, cambiar el orden a `nombre` **obliga** a mover también el cursor a
  `nombre` (con `id` como desempate) o la paginación repetiría/saltaría filas.
- **(b) RF-LIN-1.9** ya exigía "ordenamiento por cualquier columna". La implementación admite solo 4 (`numero`,
  `costo_mensual`, `fecha_asignacion`, `created_at`): enum en `src/infrastructure/http/schemas/linea.schemas.ts:93`, tipo
  `ColumnaOrdenLinea` en `src/application/ports/repositories/LineaRepository.ts:7`, mapa `COLUMNAS_ORDEN` en
  `src/infrastructure/database/repositories/linea.repository.ts:74-82` (y `valorCursor()` en `:477-489`). → **Trabajo de
  cumplimiento**; el delta **precisa** el conjunto exacto en RF-ORD-1.2 y añade la coherencia del cursor (RF-ORD-1.1), que
  no estaba redactada.
- Los **14 filtros** de RF-LIN-1.9 ya estaban completos; no se tocaron.
- `If-Match` **sigue siendo opcional** (desviación consciente de la regla 10 de la constitución, ya aceptada en
  `validation.md` §4). El delta **no la cambia**: solo fija la semántica de parseo y de conflicto.

### Las 5 decisiones del usuario (v1.1 → v1.2)

| #   | Decisión                                                                                                                                                                                                                             | Impacto                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Alcance de la medición: mantener `src/**`** con las exclusiones vigentes en `vitest.config.ts` (`src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**`, `*.test.ts`, `*.spec.ts`). No se cambia el `include`. | Fija RF-CI-1.2. Es **más estricto** que el mínimo de la constitución §8 (que solo menciona `src/domain/` + `src/application/`): medir un superconjunto no la contradice. El pipeline puede quedar en rojo si algún archivo nuevo no llega al mínimo. |
| Q2  | **umbrales GLOBALES** (agregado del conjunto medido). **No** `perFile: true`.                                                                                                                                                        | Fija RF-CI-1.2. Valores: `lines: 80`, `functions: 80`, `branches: 70`, `statements: 80` (los ya declarados en `vitest.config.ts`).                                                                                                                   |
| Q3  | **El umbral NO aplica a `presentation/`.** No se añade Vitest a la SPA en este delta.                                                                                                                                                | La SPA se cubre con Playwright E2E. **Deuda futura**: dotar a `presentation/` de runner de tests unitarios y su propio umbral. Fuera del alcance de esta spec.                                                                                       |
| Q4  | **`empleado` se EXCLUYE** del conjunto de columnas ordenables.                                                                                                                                                                       | Fija RF-ORD-1.2 (9 columnas, todas `NOT NULL`) y RF-ORD-1.5. Motivo: la comparación _keyset_ del cursor no es fiable con `NULL` (una tupla con `NULL` nunca es "mayor" que otra). `empleado` **sigue siendo** columna visible y filtro de texto.     |
| Q5  | **`"5612345678"` → se CONFIRMA el comportamiento actual**: `+565612345678`, tipo `fijo` (fijo regional, código de área 56).                                                                                                          | Fija RF-VAL-1.5. `normalizePhone()` **no se modifica**; solo se añade el test que fija la resolución (RF-QUAL-1.5). No requiere cambios en la tabla 4.3.                                                                                             |

**Estado**: **no quedan preguntas abiertas ni bloqueantes.** La spec 001 v1.2 puede pasar a la fase **Plan**.

### Criterio de diseño para RF-ORD-1.2 (columnas ordenables, ya aplicado)

Columnas de la tabla de líneas de la UI (`RF-UI-LIN-1.1`) + `created_at` (orden por defecto ya implementado), **menos
`empleado`** (Q4): `numero`, `proveedor`, `centro_coste_codigo`, `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `estado`,
`tipo_uso`, `created_at`. **Fuera**: `id`, `numero_original`, `version`, `updated_at`, `deleted_at` (técnicas o no mostradas)
y `empleado` (nullable).

### Archivos modificados

- `specs/001-gestion-lineas-telefonicas/spec.md` — v1.2: cabecera (versión/fecha), fila nueva en la tabla de la sección 2,
  RF-VAL-1.4 y RF-VAL-1.5 en §5.7, nueva **§5.9 Capability: Cierre de deuda técnica (CIERRE)** con §5.9.1 (ORD), §5.9.2
  (OPT), §5.9.3 (QUAL), §5.9.4 (CI), **§9.1** (delta v1.1/v1.2) y **§10 Decisiones tomadas en el delta v1.1/v1.2**.
- `specs/001-gestion-lineas-telefonicas/plan.md` — anexo «Plan del delta v1.2» (§D.1 alcance, §D.2 diseño técnico,
  §D.3 riesgos, §D.4 orden y criterio de hecho).
- `specs/001-gestion-lineas-telefonicas/tasks.md` — delta con **T-11…T-19** (una tarea por llamada del implementer).
- `MEMORY.md` — esta sección (pendiente de pegar: el subagente `planner` solo puede escribir en `specs/`).

### Notas de limpieza

Quedaron archivos residuales en `specs/001-gestion-lineas-telefonicas/` porque el subagente `planner` no tiene
herramienta de borrado ni permiso de escritura fuera de `specs/`:

- `_perm_probe*.md` — 21 archivos de sondeo de permisos de escritura (el original y variantes con sufijo). **No** están
  vacíos: contienen líneas de regla de 100 columnas. **Borrar todos**.
- `_memoria-delta.md` — esta sección, lista para pegar en `MEMORY.md`. **Borrar** tras pegarla.

### Comandos

No se ejecutaron comandos de build/test en esta fase (cambio exclusivo de documentación). `pnpm exec prettier --check
"specs/**/*.md"` debe quedar en verde; el implementer debe verificarlo también tras aplicar `pnpm format`.

## Delta v1.2 completado — Cierre de deuda técnica (2026-11-05)

**Estado**: el delta v1.2 de la spec 001 queda **cerrado**: las tareas **T-11…T-19** están completadas y en verde.

### Tareas del delta

| Tarea    | Contenido                                                      | RFs                               | Resultado       |
| -------- | -------------------------------------------------------------- | --------------------------------- | --------------- |
| **T-11** | Formatos: listado por `nombre` y cursor con columna            | RF-FMT-1.3, RF-ORD-1.4            | 5 tests nuevos  |
| **T-12** | Líneas: 9 columnas ordenables y cursor por columna             | RF-ORD-1.1, 1.2, 1.3              | 2 tests nuevos  |
| **T-13** | UI: columnas ordenables (8, sin `empleado`)                    | RF-ORD-1.5                        | 4 tests E2E     |
| **T-14** | Unitarios de sanitización y normalización                      | RF-QUAL-1.4, 1.5                  | 26 tests nuevos |
| **T-15** | HTTP: `If-Match`, `incluir_bajas`, 413, masivo y reactivación  | RF-QUAL-1.1, 1.2, 1.3, 1.10, 1.11 | 6 tests nuevos  |
| **T-16** | HTTP: KPIs sin caché, export `.xlsx` e import case-insensitive | RF-QUAL-1.8, 1.9, 1.12            | 5 tests nuevos  |
| **T-17** | E2E: segunda página, validación cliente, bajas y reactivación  | RF-QUAL-1.6, 1.7, 1.2, 1.10       | 4 tests E2E     |
| **T-18** | CI: cobertura obligatoria y artefacto                          | RF-CI-1.1, 1.2, 1.3               | 19 tests nuevos |
| **T-19** | Limpieza de artefactos y cierre documental                     | (sin RF)                          | este cierre     |

**Suite final**: **425 tests OK** (21 archivos) y **29 tests E2E OK**.

### Cobertura medida (T-18)

| Métrica    | Valor       | Umbral |
| ---------- | ----------- | ------ |
| Statements | **83,56 %** | 80     |
| Lines      | **83,56 %** | 80     |
| Functions  | **95,36 %** | 80     |
| Branches   | **87,77 %** | 70     |

Umbrales **globales** (sin `perFile`) sobre `src/**`, con las exclusiones vigentes de `vitest.config.ts`
(`src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**`). **No se bajó ningún umbral** ni se
cambió el alcance de la medición. La SPA (`presentation/`) queda **fuera** de la medición (decisión Q3) y se cubre con
Playwright E2E.

### Decisión sobre los cursores

El cursor de paginación viaja en un sobre **`{ v, id, c }`**:

- `v`: el valor de la columna de orden de la última fila entregada.
- `id`: el id de esa fila, usado como desempate (compara la **tupla** `(columna, id)`, de modo que nunca se repiten ni se
  saltan filas).
- `c`: **la columna de orden** a la que pertenece `v`. Es **obligatoria**.

Un cursor **legado** (sin `c`) o emitido **para otra columna** se rechaza con **400** (RFC 7807). Es una decisión
consciente del plan (D.3): el cursor es opaco y efímero (la SPA lo guarda solo en memoria y lo reinicia al cambiar los
filtros o el orden), y fallar rápido es preferible a paginar en silencio por la columna equivocada. Los cursores emitidos
antes del despliegue dejan de ser válidos.

### Archivos tocados en el delta

- **Backend (`src/`)**: `application/ports/repositories/LineaRepository.ts`,
  `application/services/{linea,import}.service.ts`, `infrastructure/database/repositories/{cursor,formato,linea}.repository.ts`,
  `infrastructure/http/{if-match,export,respuestas}.ts`,
  `infrastructure/http/{controllers,schemas,routes,middleware}/**`, `infrastructure/http/controllers/linea.controller.ts`,
  `infrastructure/http/schemas/linea.schemas.ts`, `infrastructure/http/routes/linea.routes.ts`, `app.ts`.
- **SPA (`presentation/`)**: `src/types/api.ts`, `src/components/lineas/LineasTable.tsx`, `src/pages/Lineas.tsx`.
- **Tests**: `tests/unit/infrastructure/{cursor,if-match}.test.ts` (nuevo),
  `tests/unit/application/services/{linea,centro-coste,formato,import}.service.test.ts`,
  `tests/unit/domain/PhoneNumber.test.ts`, `tests/integration/database/linea.repository.test.ts`,
  `tests/integration/http/api.test.ts`, `tests/e2e/{lineas-orden,lineas-paginacion,lineas-validacion}.spec.ts` (nuevos),
  `tests/e2e/lineas-crud.spec.ts`.
- **CI**: `.github/workflows/ci.yml` (paso `pnpm test:coverage` + artefacto `cobertura`).
- **Documentación**: `specs/001-gestion-lineas-telefonicas/{spec,plan,tasks}.md`, `MEMORY.md`.

### Comandos verificados

`pnpm test` → **425 tests OK** (21 archivos); `pnpm test:coverage` → **código de salida 0** (83,56 % / 83,56 % / 95,36 % /
87,77 %); `pnpm test:e2e` → **29 tests E2E OK**; `pnpm typecheck` OK; `pnpm lint` OK (0 errores);
`pnpm --dir presentation typecheck` y `pnpm --dir presentation build` OK; `pnpm format:check` **en verde**;
`pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"` OK.

### Cierre

- Se **borraron** los temporales de `specs/001-gestion-lineas-telefonicas/`: `_memoria-delta.md` y los
  **21** ficheros `_perm_probe*.md` (la tarea los contabilizaba como 22; en reality hay 21 sondeos más
  `_memoria-delta.md`, es decir, **22 ficheros que empiezan por `_`**).
- `specs/001-gestion-lineas-telefonicas/` queda con **`spec.md`, `plan.md`, `tasks.md` y `validation.md`**.
- Con el reformateo de `specs/**` y `MEMORY.md` (Prettier), el paso "Format check" del job `calidad` del CI pasa a
  estar **en verde**: era el último punto rojo del pipeline.
- El **CI queda en verde** con la puerta de cobertura activa (umbral 80/80/80/70) y el reporte de cobertura subido como
  artefacto `cobertura` incluso cuando el umbral falla.

## Correcciones tras la validación — `If-Match` en `DELETE`, parseo estricto y cierre documental (2026-11-05)

**Estado**: cerrado. Tareas **T-20**, **T-21** y **T-22** en `specs/001-gestion-lineas-telefonicas/tasks.md` (todas `[x]`).

**Contexto**: el subagente `reviewer` devolvió **CAMBIOS NECESARIOS** con **5 hallazgos** sobre el estado anterior
al delta. El usuario aprobó: (a) resolver el hallazgo **nº1 por vía código** (implementar `If-Match` en los `DELETE`)
y (b) aplicar también los hallazgos **nº3**, **nº4** y **nº5**. El hallazgo **nº2** es **documental** (lo hace el
implementador, no el planner).

### Decisiones del usuario

| #   | Decisión                                                                   | Impacto                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | **El hallazgo nº1 se resuelve por código**, no documentando la desviación. | Los tres `DELETE` leen `If-Match` y hacen el borrado **condicional por versión**. Se mantiene que `If-Match` es **opcional** (desviación ya aceptada en `validation.md` §4). |
| D-2 | El **nº2** (documentación) lo hace el implementador.                       | Se actualizan `spec.md` §9 y `validation.md` **sin reescribir requisitos**: son informes de estado.                                                                          |
| D-3 | En las cabeceras de `plan.md`/`tasks.md` **no se inventan nombres**.       | Se usa la fórmula neutra «Aprobado por: usuario (2026-11-05)».                                                                                                               |

### Hallazgo nº1 — `If-Match` se ignoraba en los `DELETE` (RF-OPT-1.1 a RF-OPT-1.3)

**Defecto**: la cabecera `If-Match` solo se leía en las rutas `PUT`. En los tres `DELETE`, un `If-Match: "999"`
borraba sin 409 y un `If-Match: "abc"` borraba sin 400.

**Qué cambió**:

1. **Las tres rutas `DELETE` leen la cabecera** con el **mismo mecanismo que el `PUT`**
   (`versionEsperadaDe(request)`, en `src/infrastructure/http/routes/{linea,formato,centro-coste}.routes.ts`) y la
   propagan: ruta → controlador → servicio → repositorio. El **400** por valor inválido se produce **antes de tocar
   la fila** (mismo camino que en `PUT`).
2. **El borrado es condicional por versión**:
   - `FormatoRepository.eliminar(id, versionEsperada?)` y `CentroCosteRepository.eliminar(id, versionEsperada?)` →
     `DELETE ... WHERE id = $1 AND version = $2` (con Drizzle: `and(eq(id), eq(version))`).
   - El `DELETE` de **líneas** es una **baja lógica** (`UPDATE`, no `DELETE` físico): la condición de versión la
     aplica el `UPDATE ... WHERE id = $id AND version = $versionEsperada` que ya usa el `actualizar()` del
     repositorio (`RF-LIN-1.8`).
   - Si el borrado condicional **no afecta filas** por desajuste de versión → `ConflictError` (**409**) y **no** se
     aplica el cambio.
3. **404 y 409 no se mezclan**: el `NotFoundError` (recurso inexistente) se decide **leyendo** el recurso; el
   `ConflictError` (existe con otra versión) se decide por la comparación de versiones. Un `DELETE` con `If-Match`
   sobre un id inexistente responde **404**, no 409.
4. **`If-Match` sigue siendo opcional**: sin la cabecera, el borrado se comporta como antes (sin verificación de
   versión).

**Tests nuevos (21)**:

- `tests/unit/infrastructure/if-match.test.ts` (+1): rechazo de los valores que solo empiezan por un entero.
- `tests/unit/application/services/{formato,centro-coste}.service.test.ts` (+3 cada uno): borrado con la versión
  esperada, `ConflictError` por versión desactualizada **sin** escribir, y `ConflictError` cuando el borrado
  condicional no afecta filas.
- `tests/unit/application/services/linea.service.test.ts` (+5): nuevo `describe('eliminar')` (baja lógica, versión
  esperada, `ConflictError` sin dar de baja, `NotFoundError`, conflicto de escritura concurrente).
- `tests/integration/http/api.test.ts` (+6): `DELETE` con `If-Match` en los **3** recursos (409 con versión
  desactualizada y el recurso intacto, 400 con valor inválido y el recurso intacto, borrado efectivo con la versión
  correcta) + la distinción **404 vs 409**; y los **2** casos de cursor de `/api/v1/lineas` (§nº5).
- `tests/integration/database/{formato,centro-coste}.repository.test.ts` (+1 cada uno): el borrado condicional en la
  base de datos.
- `tests/integration/database/import.service.test.ts` (+1): la sanitización verificada en la **BD** (§nº5).

### Hallazgo nº3 — Parseo laxo de `If-Match`

**Defecto**: `src/infrastructure/http/if-match.ts` usaba `Number.parseInt` + `Number.isInteger` (comprobación
vacua): `"3abc"` y `"3.5"` se aceptaban como versión 3, contra RF-OPT-1.2 («400 si no es un entero mayor o igual a 1»).

**Qué cambió**: el parseo es **estricto**. El valor (tras quitar el prefijo `W/` y las comillas) debe casar con
`^\d+$` y se convierte con `Number(...)` (no `parseInt`), comprobando además que sea un entero seguro ≥ 1. Se mantienen
el soporte de `"3"`, `W/"3"` y `3` (entero sin comillas). Los valores `'3abc'`, `'3.5'`, `'1e3'`, `'"3abc"'` y
`'W/"3.5"'` se rechazan con `ValidationError` → **400**. Los valores inválidos se añadieron **tanto al test unitario
como al test HTTP, para `PUT` y para `DELETE`**.

### Hallazgo nº4 — Cabeceras en borrador

`plan.md` decía «Estado: borrador (pendiente aprobación)», «Fecha de aprobación del plan: _pendiente_» y tenía la
línea de firma en blanco; `tasks.md` dejaba «Fecha de aprobación del plan» y «Aprobado por» sin rellenar.

**Qué cambió**: ambos ficheros reflejan la realidad (plan, tareas originales T-01…T-10e y anexo del delta §D
**aprobados por el usuario el 2026-11-05**). Se usa la fórmula neutra «Aprobado por: usuario (2026-11-05)», **sin
inventar nombres**.

### Hallazgo nº5 — 2 tests que faltaban

1. **Cursor a nivel HTTP en `/api/v1/lineas`** (`tests/integration/http/api.test.ts`): cursor **sin `c`** (legado) y
   cursor **emitido para `created_at` usado con `sort=proveedor`** → ambos **400** RFC 7807. Son los casos simétricos
   a los que ya existían en `/api/v1/formatos`.
2. **Sanitización verificada en la base de datos** (`tests/integration/database/import.service.test.ts`): importación
   **real** de un CSV con `=PELIGRO` en `proveedor` y `@PELIGRO` en `empleado` y comprobación del **valor persistido**
   en la tabla `lineas_telefonicas` (se lee la fila cruda con Drizzle, sin pasar por la entidad): ambos empiezan por
   `'` (apóstrofo).

### Hallazgo nº2 — Documentación del estado de verificación

- `spec.md` §9: el estado real es **81 RF** (56 originales + 25 del delta v1.2) → **81 CUMPLE**, 0 PARCIAL.
  **RF-LIN-1.9** y **RF-FMT-1.3** (los 2 que estaban en PARCIAL) están **cerrados**. Remite a la sección de cierre de
  este `MEMORY.md`.
- `validation.md`: §1 (resumen + tabla de cierre), §2 (tabla de capacidades con ORD/OPT/QUAL/CI), §3.1 y §3.2
  (hallazgos **cerrados** con su evidencia), §4 (la desviación «`If-Match` opcional» se mantiene y se anota que su
  semántica ya está cerrada por RF-OPT), §6 (las **13 ramas** marcadas como **cubiertas**, con el fichero de test de
  cada una) y §7/§8 (comandos y conclusión).
- **No se reescriben requisitos**: `validation.md` es el informe de validación y `spec.md` §9 es el resumen de
  verificación; el texto de los RFs queda intacto.

### Archivos tocados

- **Backend (`src/`)**: `infrastructure/http/if-match.ts`,
  `infrastructure/http/routes/{linea,formato,centro-coste}.routes.ts`,
  `infrastructure/http/controllers/{linea,formato,centro-coste}.controller.ts`,
  `application/services/{linea,formato,centro-coste}.service.ts`,
  `application/ports/repositories/{Formato,CentroCoste}Repository.ts`,
  `infrastructure/database/repositories/{formato,centro-coste}.repository.ts`.
- **Tests**: `tests/unit/infrastructure/if-match.test.ts`,
  `tests/unit/application/services/{linea,formato,centro-coste}.service.test.ts`,
  `tests/integration/http/api.test.ts`,
  `tests/integration/database/{formato,centro-coste}.repository.test.ts`,
  `tests/integration/database/import.service.test.ts`.
- **Documentación**: `specs/001-gestion-lineas-telefonicas/{spec,plan,tasks,validation}.md`, `MEMORY.md`.

### Pruebas de no vacuidad (5 mutaciones temporales de `src/`, revertidas)

| mutación                                                                    | resultado                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `if-match.ts` vuelve al parseo laxo (`parseInt` + comillas indiscriminadas) | **fallan 5** tests (1 unitario + 4 HTTP: `PUT`/`DELETE` con `3abc`, `3.5`, `1e3`) |
| Los tres `DELETE` dejan de leer `If-Match`                                  | **fallan 3** tests HTTP (los 3 recursos)                                          |
| El `DELETE` del repositorio ignora la versión (borrado sin condición)       | **fallan 2** tests de repositorio (formato y centro de coste)                     |
| `LineaService.eliminar` ignora la versión esperada                          | **fallan 2** tests (1 unitario + 1 HTTP)                                          |
| `decodificarCursor` deja de exigir `c === columnaEsperada`                  | **fallan 4** tests HTTP (los 2 de `/formatos` y los **2 nuevos** de `/lineas`)    |

Las cinco se revirtieron y se comprobó que no quedó ninguna marca `TEMP` en el código de producción.

### Comandos verificados

`pnpm test` → **446 tests OK** (21 archivos; 425 previos + 21 nuevos); `pnpm test:coverage` → **código de salida 0**
(**83,46 %** st / **88,33 %** br / **95,38 %** fn / **83,46 %** lines; umbrales 80/80/80/70); `pnpm test:e2e` → **29 tests
E2E OK**; `pnpm typecheck` OK; `pnpm lint` OK (0 errores); `pnpm format:check` **en verde**; `pnpm --dir presentation
typecheck` y `pnpm --dir presentation build` OK (115 módulos); `pnpm build` OK; `pnpm exec prettier --write` sobre los
`.md` tocados y `pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"` OK.

### Corrección vuelta 2 (2026-11-05)

**vuelta 2 — §1 de `validation.md` alineado a 81/81/0; comentario de `FormatoRepository` corregido.**

- **Bloqueante (documental)**: `validation.md` §1 seguía declarando «56 RF» como alcance total y una tabla con 54
  CUMPLE / 2 PARCIAL, presentando RF-LIN-1.9 y RF-FMT-1.3 como deuda vigente, lo que contradecía a §1.1/§8 del mismo
  informe y a `spec.md` §9. §1 se reescribió para reflejar el estado final: **81 RF** (56 originales + 25 del delta
  v1.2) → **81 CUMPLE / 0 PARCIAL / 0 NO CUMPLE**, con los antiguos parciales **cerrados** (T-12 y T-11) y las **13
  ramas** de §6 **cubiertas** (T-14…T-18). §6 deja de calificar las ramas como «pendientes» y §8 se ajusta a la misma
  redacción. Fechas: validación original **2026-11-04**; cierre del delta y correcciones **2026-11-05**.
- **Menor**: el comentario de `listar()` en `src/application/ports/repositories/FormatoRepository.ts` describía un
  orden `created_at DESC, id DESC` que ya no existe; ahora describe el real (`nombre ASC, id ASC`, cursor keyset sobre
  `nombre`), conforme a RF-FMT-1.3 y RF-ORD-1.4. **Sin cambios de código funcional.**
- **Verificación**: `pnpm test`, `pnpm typecheck`, `pnpm lint` y `pnpm format:check` en verde.

## Delta v1.3 — Paginación de UI en catálogos (2026-11-06)

**Estado**: cerrado. Tareas **T-23…T-31** en `specs/001-gestion-lineas-telefonicas/tasks.md` (todas `[x]` tras T-31).

**Contexto**: el usuario pidió paginar las tablas de Formatos y Centros de Coste en el módulo de catálogos (SPA). Se tramitó como **delta v1.3 de la spec 001** (13 RF nuevos: RF-CAT-1.1…1.9 y RF-QUAL-1.13…1.16, total 81 → 94 RF), con **20 filas por página** en ambos paneles.

### Decisiones del usuario

| #   | Decisión                                                                      | Impacto                                                                                                                                         |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | Tramitar como **delta v1.3 de la spec 001** (no cambio suelto ni spec nueva). | La spec 001 pasa a **v1.3** con 94 RF; `spec.md`, `plan.md` y `tasks.md` se actualizan dentro de `specs/`.                                      |
| D-2 | **20 filas por página** en ambos paneles (Formatos y Centros de Coste).       | Coherente con RF-UI-LIN-1.1 (líneas, 20/página) y RF-CC-1.6 (API de centros, 20/página).                                                        |
| D-3 | No cambiar el contrato de la API ni los RF existentes.                        | El backend ya paginaba por cursor; la UI ahora consume ese cursor. Los selects de formato siguen recibiendo el catálogo completo (`limit=100`). |

### RFs nuevos del delta v1.3

| Grupo    | IDs                 | Qué exige                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CAT**  | RF-CAT-1.1 … 1.9    | Tabla de Formatos y Centros de Coste paginadas a **20 filas/página** con cursor; «Siguiente/Anterior» envía `after_id` + `c`; cambiar filtro u orden **reinicia** la paginación; los **selects de formato** siguen recibiendo el catálogo completo (`limit=100`, no se vacían al paginar); estado vacío/<20 filas deshabilita controles; coherente con RF-FMT-1.3, RF-ORD-1.4, RF-CC-1.6 |
| **QUAL** | RF-QUAL-1.13 … 1.16 | E2E: 2ª página de Formatos y de Centros muestra filas distintas; los selects de formato no se vacían al paginar; aplicar/limpiar filtros en centros reinicia la paginación                                                                                                                                                                                                               |

### Archivos tocados

- **SPA (`presentation/`)**: `hooks/useFormatos.ts` (useFormatos paginado + useFormatosCatalogo para selects), `hooks/useCentrosCoste.ts` (paginado, reinicio por filtros), `components/catalogos/FormatosPanel.tsx` (tabla paginada con Anterior/Siguiente, pila de cursores), `components/catalogos/CentrosCostePanel.tsx` (tabla paginada, reinicio al aplicar/limpiar filtros, select de formato usa catálogo completo).
- **Tests E2E**: `tests/e2e/formatos-paginacion.spec.ts` (nuevo, RF-QUAL-1.13/1.15), `tests/e2e/centros-paginacion.spec.ts` (nuevo, RF-QUAL-1.14/1.16), `tests/e2e/centros-paginacion-api.spec.ts` (nuevo en T-25, página 2 de centros).
- **Documentación**: `specs/001-gestion-lineas-telefonicas/{spec.md,plan.md,tasks.md}` (delta v1.3: §5.10, §9.2, §10.1/§10.2; plan §E; tareas T-23…T-31).

### Comandos verificados

| Comando                                                  | Resultado                                                                                                             |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm --dir presentation typecheck`                      | exit 0 (sin errores)                                                                                                  |
| `pnpm --dir presentation build`                          | exit 0 (115 módulos)                                                                                                  |
| `pnpm test`                                              | 21 archivos / 446 tests OK                                                                                            |
| `pnpm test:e2e`                                          | 32 tests OK (incluidos `formatos-paginacion.spec.ts`, `centros-paginacion.spec.ts`, `centros-paginacion-api.spec.ts`) |
| `pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"` | exit 0 (All matched files use Prettier code style!)                                                                   |
| `pnpm lint`                                              | exit 0 (tras corregir un error pre-existing de T-25 en centros-paginacion-api.spec.ts)                                |
| `pnpm typecheck` (raíz)                                  | exit 0                                                                                                                |
| `pnpm build` (raíz)                                      | exit 0                                                                                                                |

**Nota sobre `pnpm format:check` completo**: exit 1 por 2 ficheros `.tsx` de `presentation/` (`CentrosCostePanel.tsx`, `FormatosPanel.tsx`) modificados durante el delta y aún no formateados con Prettier. Quedan pendientes de `pnpm exec prettier --write` sobre esos 2 ficheros (fuera del alcance de T-29, que solo cubre `.md` de `specs/`).

### Pruebas de no vacuidad

Los tests E2E de T-27 y T-28 fueron verificados con mutación implícita: crear 25 formatos/centros forzó la existencia de página 2 (con 9 formatos preexistentes, `limit=20` cabría todo en una página y el test no distinguiría paginación real). Los tests de RF-QUAL-1.16 (aplicar/limpiar filtros → página 1) verifican que el cursor se reinicia correctamente.

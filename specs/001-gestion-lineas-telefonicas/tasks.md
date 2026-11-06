# Tareas — Spec 001: Gestión de Líneas Telefónicas

**Basado en**: `plan.md` aprobado
**Máx 10 tareas**, ~20-30 min c/u, orden de dependencia
**Tiempo estimado total**: ~4.5-5 horas

---

### T-01 · Esquemas Drizzle + Migración Inicial

- [x] RF-FMT-1.1 a 1.4, RF-CC-1.1 a 1.6, RF-LIN-1.1 a 1.9, RF-LIN-EXP-1.1 a 1.4, RF-DASH-1.1, 1.2, RF-CC-EXP-1.1, RF-FMT-EXP-1.1
- Archivos:
  - `src/infrastructure/database/schema/formatos.ts`
  - `src/infrastructure/database/schema/centros-coste.ts`
  - `src/infrastructure/database/schema/lineas-telefonicas.ts`
  - `src/infrastructure/database/connection.ts`
  - Migración generada: `src/infrastructure/database/migrations/0001_initial_schema.sql` (via `pnpm db:generate`)
- **Hecho cuando:** `pnpm db:generate` crea migración con 3 tablas, FKs, índices (incl. único parcial `uq_linea_numero_activa`), CHECK constraints; `pnpm db:migrate` aplica sin errores en PostgreSQL local.
- Riesgo: Olvidar índice único parcial o CHECK `costo_mensual >= 0`.

---

### T-02 · Dominio: PhoneNumber + Errores + Entidades + Value Objects

- [x] RF-VAL-1.1, RF-VAL-1.2, RF-VAL-1.3, RF-LIN-1.4, RF-LIN-1.8
- Archivos:
  - `src/domain/value-objects/PhoneNumber.ts` (normalizePhone, InvalidPhoneNumberError, prefijos fijos CL)
  - `src/domain/errors/DomainError.ts` (base + InvalidPhoneNumberError, DuplicateError, NotFoundError, ForeignKeyError)
  - `src/domain/value-objects/CostoMensual.ts` (value object decimal ≥ 0)
  - `src/domain/entities/Formato.ts`, `CentroCoste.ts`, `LineaTelefonica.ts` (factories, métodos de dominio: `darDeBaja()`, `cambiarEstado()`)
  - `tests/unit/domain/PhoneNumber.test.ts` (cobertura tabla spec 4.3 + inválidos)
  - `tests/unit/domain/LineaTelefonica.test.ts` (soft delete, inmutabilidad numero/id)
- **Hecho cuando:** `pnpm test tests/unit/domain/` pasa; `normalizePhone` cubre todos los casos de la spec (móvil, fijo Santiago, fijo regiones, con 0, con +56, con 56) y lanza `InvalidPhoneNumberError` tipado en inválidos; entidades tienen factories y métodos puros sin deps externas.
- Riesgo: Prefijos fijos regionales incompletos; no testear case-insensitive en normalización.

---

### T-03 · Puertos (Interfaces) + Repositorios Drizzle

- [x] RF-FMT-1.1 a 1.4, RF-CC-1.1 a 1.6, RF-LIN-1.1 a 1.9, RF-LIN-EXP-1.1 a 1.4
- Archivos:
  - `src/application/ports/repositories/FormatoRepository.ts`
  - `src/application/ports/repositories/CentroCosteRepository.ts`
  - `src/application/ports/repositories/LineaRepository.ts`
  - `src/application/ports/file-parser/SpreadsheetParser.ts`
  - `src/infrastructure/database/repositories/formato.repository.ts`
  - `src/infrastructure/database/repositories/centro-coste.repository.ts`
  - `src/infrastructure/database/repositories/linea.repository.ts` (listar con filtros dinámicos, exportar, bulk update estado)
  - `src/infrastructure/external/spreadsheet/xlsx-parser.ts` (implementa SpreadsheetParser)
  - `tests/integration/database/formato.repository.test.ts`
  - `tests/integration/database/centro-coste.repository.test.ts`
  - `tests/integration/database/linea.repository.test.ts` (filtros, paginación, export, bulk estado)
- **Hecho cuando:** `pnpm test tests/integration/database/` pasa (Testcontainers PostgreSQL); repositorios implementan interfaces al 100%; `LineaRepository.listar()` soporta 14 filtros + sort + paginación cursor; `exportar()` usa misma query sin limit/offset; bulk update usa transacción.
- Riesgo: Query dinámica con muchos parámetros propensa a errores de orden; exportar no respeta `incluir_bajas`.

---

### T-04 · Services CRUD: Formato, CentroCoste, Linea (+ Dashboard)

- [x] RF-FMT-1.1 a 1.4, RF-CC-1.1 a 1.6, RF-LIN-1.1 a 1.9, RF-DASH-1.1, 1.2, RF-CC-EXP-1.1, RF-FMT-EXP-1.1
- Archivos:
  - `src/application/services/formato.service.ts`
  - `src/application/services/centro-coste.service.ts`
  - `src/application/services/linea.service.ts` (CRUD, listar, exportar, cambiarEstado, cambiarEstadoMasivo)
  - `src/application/services/dashboard.service.ts` (KPIs 4 COUNT queries en paralelo)
  - `src/application/dto/*.ts` (DTOs entrada/salida)
  - `tests/unit/application/services/formato.service.test.ts`
  - `tests/unit/application/services/centro-coste.service.test.ts`
  - `tests/unit/application/services/linea.service.test.ts` (mocks repositorios)
  - `tests/unit/application/services/dashboard.service.test.ts`
- **Hecho cuando:** `pnpm test tests/unit/application/services/` pasa; services usan solo puertos (no Drizzle/Fastify); `LineaService.cambiarEstadoMasivo()` es transaccional, idempotente para 'baja', retorna `{actualizadas, ignoradas, fallidas}`; `DashboardService` ejecuta 4 COUNTs en `Promise.all`.
- Riesgo: Lógica de defaults en `LineaService.crear()` (tipo_linea inferido, estado='pendiente', tipo_uso='personal') no coincida con spec.

---

### T-05 · Import Service (Centros + Líneas, Transaccional)

- [x] RF-CC-IMP-1.1 a 1.5, RF-LIN-IMP-1.1 a 1.10
- Archivos:
  - `src/application/services/import.service.ts` (importarCentrosCoste, importarLineas)
  - `src/application/dto/import.dto.ts` (schemas validación filas, reportes)
  - `tests/unit/application/services/import.service.test.ts` (mocks repos + parser)
  - `tests/integration/http/import.test.ts` (Testcontainers, archivos CSV/XLSX reales)
- **Hecho cuando:** `pnpm test tests/unit/application/services/import.service.test.ts` y `pnpm test tests/integration/http/import.test.ts` pasan; importación centros: validación todo-o-nada (formato inexistente → 0 insertados, reporte errores); importación líneas: validación previa completa en memoria, duplicados no bloquean, errores validación → rollback total; reportes estructura exacta spec; límites 10MB/50k filas enforceados.
- Riesgo: Memoria en importaciones 50k filas (mitigación: streaming parser + procesamiento por chunks); case-insensitive `centro_coste_codigo` no implementado en lookup.

---

### T-06 · Capa HTTP: Controllers, Routes, Zod Schemas, Middleware

- [x] Todos los RFs de endpoints (56 RFs expuestos vía HTTP)
- Archivos:
  - `src/infrastructure/http/schemas/*.ts` (Zod request/response/query para cada recurso)
  - `src/infrastructure/http/middleware/error-handler.ts` (DomainError → HTTP status: 400, 404, 409, 500)
  - `src/infrastructure/http/middleware/validation.ts` (hook Zod)
  - `src/infrastructure/http/middleware/multipart.ts` (config 10MB, 50k rows)
  - `src/infrastructure/http/controllers/*.ts` (5 controllers)
  - `src/infrastructure/http/routes/*.ts` (6 route files: formatos, centros-coste, lineas, import, dashboard, index)
  - `src/app.ts` (registrar routes)
  - `tests/integration/http/*.test.ts` (Fastify inject + Testcontainers: CRUD, filtros, export, bulk, import, dashboard, errores)
- **Hecho cuando:** `pnpm test tests/integration/http/` pasa; todos los endpoints responden códigos correctos (200, 201, 400, 404, 409); validación Zod rechaza payloads inválidos; multipart acepta CSV/XLSX ≤10MB; export endpoints devuelven `Content-Disposition: attachment; filename="lineas_20261104_143022.csv"`; OpenAPI accesible en `/docs` y `/openapi.json`.
- Riesgo: Zod schemas no cubren todos los filtros de listado; error handler no mapea todos los DomainError.

---

### T-07 · UI Base: Vite + React + Router + Layout + API Client

- [x] RF-UI-LIN-1.1 a 1.7, RF-UI-IMP-1.1 a 1.4 (fundación)
- Archivos:
  - `presentation/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  - `presentation/src/main.tsx`, `App.tsx`, `vite-env.d.ts`
  - `presentation/src/components/layout/Sidebar.tsx`, `Header.tsx`, `Layout.tsx`
  - `presentation/src/services/api.ts` (fetch wrapper tipado, baseURL `/api`)
  - `presentation/src/hooks/useLineas.ts`, `useCentrosCoste.ts`, `useFormatos.ts`, `useImport.ts` (TanStack Query o SWR)
  - `presentation/src/utils/date.ts`, `export.ts`
  - Componentes base: `Button`, `Input`, `Select`, `Modal`, `Table`, `Pagination`, `FileDropZone`
- **Hecho cuando:** `cd presentation && pnpm dev` levanta SPA en puerto 5173; navegación Sidebar funciona (Dashboard / Líneas / Importación); `api.ts` tipa todas las respuestas; componentes base reutilizables renderizan sin errores consola.
- Riesgo: CORS no configurado en Fastify para puerto 5173; tipos TS desincronizados con API.

---

### T-08 · UI Módulo Líneas: Tabla, Filtros, CRUD Modals, Bulk Actions, Export

- [x] RF-UI-LIN-1.1 a 1.7
- Archivos:
  - `presentation/src/pages/Lineas.tsx`
  - `presentation/src/components/lineas/LineasTable.tsx` (paginación 20, ordenamiento columnas)
  - `presentation/src/components/lineas/LineasFilters.tsx` (14 filtros: texto, select, date, range)
  - `presentation/src/components/lineas/LineaFormModal.tsx` (create + edit, validación Zod cliente)
  - `presentation/src/components/lineas/LineaActions.tsx` (dropdown: editar, dar de baja)
  - `presentation/src/components/lineas/BulkActions.tsx` (checkbox fila + select all page + select estado + aplicar)
  - `presentation/src/components/lineas/LineasToolbar.tsx` (botón Exportar → `GET /api/lineas/export?filtros`)
- **Hecho cuando:** En browser: tabla carga 20 filas, paginación funciona, filtros aplican query params y refrescan datos, modal crear valida en cliente y servidor (error 400 se muestra), editar pre-puebla, "Dar de baja" confirma y PUT estado=baja, selección múltiple + bulk cambio estado muestra toast con reporte, botón Exportar descarga CSV con nombre timestamp y columnas correctas.
- Riesgo: Filtros de rango (costo, fecha) no mapean bien a query params; bulk actions no maneja idempotencia 'baja' en UI.

---

### T-08b · UI Formatos y Centros de Coste (tarea extra, aprobada por el usuario)

- [x] RF-FMT-1.1 a 1.4, RF-CC-1.1 a 1.6
- Motivo: la importación de centros exige formatos previos (SMU, FALABELLA) y la UI no tenía forma de crearlos.
- Archivos:
  - `presentation/src/pages/FormatosCentros.tsx`
  - `presentation/src/components/catalogos/FormatosPanel.tsx`, `CentrosCostePanel.tsx`, `FormatoFormModal.tsx`, `CentroCosteFormModal.tsx`
  - `presentation/src/App.tsx` (ruta `/catalogos`), `components/layout/Sidebar.tsx`, `components/layout/Header.tsx`
- **Hecho cuando:** se pueden crear, renombrar y eliminar formatos; crear, editar y eliminar centros de coste con código único y formato asociado; los errores 409 (dependencias) y 400 (validación) se muestran en pantalla.
- Riesgo: borrado bloqueado por FK RESTRICT al existir centros o líneas asociadas.

---

### T-09 · UI Módulo Importación: Dos Secciones, Drag&Drop, Progreso, Reportes, Plantillas

- [x] RF-UI-IMP-1.1 a 1.4
- Archivos:
  - `presentation/src/pages/Importacion.tsx`
  - `presentation/src/components/import/ImportPage.tsx` (dos secciones: Centros | Líneas)
  - `presentation/src/components/import/FileDropZone.tsx` (drag&drop + click, valida .csv/.xlsx)
  - `presentation/src/components/import/ImportProgress.tsx` (spinner + mensaje "Procesando fila X de Y")
  - `presentation/src/components/import/ImportReport.tsx` (tabs: Insertados, Duplicados, Errores; expandible por fila)
  - `presentation/src/hooks/useImport.ts` (mutation import + polling progreso si async, o wait respuesta)
  - Endpoint `GET /api/import/templates` (CSV ejemplo centros y líneas)
- **Hecho cuando:** En browser: dos secciones visibles; drag&drop acepta CSV/XLSX; al subir archivo válido muestra progreso y al finalizar reporte con 3 pestañas (insertados count, duplicados lista con números, errores lista con fila+motivo); botón "Descargar plantilla" genera CSV correcto para cada tipo; errores de validación (formato inexistente, duplicados, campos inválidos) se muestran claros.
- Riesgo: Archivos grandes bloquean UI (mitigación: web worker o chunked upload); reporte duplicados no muestra `motivo`.

---

### T-10 · Tests E2E (Playwright) + Cobertura Mínima + Lint/Typecheck

- [x] Validación integral de todos los RFs vía UI + API
- Archivos:
  - `tests/e2e/dashboard.spec.ts` (KPIs cargan, números coinciden con BD)
  - `tests/e2e/lineas-crud.spec.ts` (crear, listar, filtrar, paginar, editar, baja, bulk, exportar)
  - `tests/e2e/import.spec.ts` (importar centros ok, importar centros error formato, importar líneas duplicados+errores, plantillas)
  - `tests/e2e/formatos-centros.spec.ts` (CRUD formatos, CRUD centros, export)
  - `vitest.config.ts` (coverage thresholds: lines 80%, branches 70%, functions 80%)
  - `.github/workflows/ci.yml` (opcional: typecheck, lint, test, build, e2e)
- **Hecho cuando:** `pnpm test:e2e` pasa (Playwright contra `pnpm dev` + `pnpm dev:api`); `pnpm test:coverage` cumple thresholds; `pnpm lint` y `pnpm typecheck` sin errores; `pnpm build` genera `dist/` sin warnings.
- Riesgo: Tests E2E flaky por timing (usar `waitFor` / `expect.poll`); BD de test no se limpia entre specs (usar transacciones + rollback en fixtures).

---

### T-10b · Importación de Centros de Coste: Creación Automática de Formatos (tarea extra, aprobada por el usuario)

- [x] RF-CC-IMP-1.2 (sin cambiar el comportamiento por defecto)
- Motivo: el CSV real de centros de coste (756 filas, delimitador `;`) usa 9 formatos y la base de datos solo tenía 6 (faltaban ADMINISTRACION, EDUCACION y OTROS, 41 filas); la importación es todo-o-nada, por lo que fallaba entera con 41 errores `el formato "ADMINISTRACION" no existe`.
- Archivos:
  - `src/application/ports/repositories/UnidadDeTrabajo.ts` (nuevo puerto de transacción)
  - `src/infrastructure/database/repositories/unidad-de-trabajo.repository.ts`, `tipos.ts` (nuevos)
  - `src/application/dto/import.dto.ts`, `src/application/services/import.service.ts`
  - `src/infrastructure/http/{controllers/import.controller.ts,schemas/import.schemas.ts,routes/import.routes.ts,respuestas.ts,container.ts}`
  - `presentation/src/{hooks/useImport.ts,components/import/ImportPage.tsx,components/import/ImportReport.tsx,services/api.ts,types/api.ts,styles.css}`
  - `tests/unit/application/services/import.service.test.ts`, `tests/integration/database/import.service.test.ts`, `tests/integration/http/api.test.ts`, `tests/e2e/import.spec.ts`
- **Hecho cuando:** con `crear_formatos_faltantes=true` (checkbox de la UI, marcado por defecto) los formatos inexistentes se crean dentro de la misma transacción que la inserción de los centros y se informan en `formatos_creados`; sin la opción el comportamiento es el anterior (error por fila y 0 insertados).
- Riesgo: la creación de formatos dentro de la transacción abre un SAVEPOINT anidado en `centros_coste.crearMuchos`; se verificó que el rollback deshace también los formatos creados.

---

### T-10c · Buscador de centros de coste (combobox con búsqueda por texto) (tarea extra, aprobada por el usuario)

- [x] RF-UI-LIN-1.2 (el filtro de centro de coste pasa a ser un buscador; los demás filtros no cambian)
- Motivo: el usuario importó 756 centros de coste reales; el filtro "Centro de coste" era un `<select>` alimentado con los primeros 100 (`useCentrosCoste({ limit: 100 })`) y no había forma de buscar.
- Archivos:
  - `src/application/ports/repositories/CentroCosteRepository.ts` (`busqueda` en `FiltrosCentroCoste`)
  - `src/infrastructure/database/repositories/centro-coste.repository.ts` (filtro `(lower(c.codigo) ILIKE … OR lower(c.nombre) ILIKE …)` con `ilikeSeguro`)
  - `src/infrastructure/http/schemas/centro-coste.schemas.ts` (query `busqueda`), `src/infrastructure/http/controllers/centro-coste.controller.ts`
  - `presentation/src/hooks/useCentrosCoste.ts` (`useBuscarCentrosCoste`)
  - `presentation/src/components/lineas/CentroCosteCombobox.tsx` (nuevo), `LineasFilters.tsx`, `LineaFormModal.tsx`, `presentation/src/pages/Lineas.tsx`, `presentation/src/styles.css`
  - `tests/unit/application/services/centro-coste.service.test.ts`, `tests/integration/database/centro-coste.repository.test.ts`, `tests/integration/http/api.test.ts`, `tests/e2e/centros-busqueda.spec.ts`, `tests/e2e/lineas-crud.spec.ts`
- **Hecho cuando:** `GET /api/v1/centros-coste?busqueda=<texto>` devuelve todos los centros cuyo código o nombre contengan ese texto (combinable con los demás filtros y con la paginación por cursor); en la UI de líneas, el filtro "Centro de coste" y el campo obligatorio "Centro de coste *" del formulario son un buscador con debounce (250 ms), navegación por teclado, estado "Buscando…"/"Sin resultados" y botón para limpiar.
- Riesgo: la búsqueda es _server-side_ (ILIKE sobre `lower(codigo)`/`lower(nombre)`); con muchísimos centros de coste convendría un índice `trigram` en el futuro.

---

### T-10d · Unificar el filtro de centro de coste (tarea extra, aprobada por el usuario)

- [x] RF-UI-LIN-1.2 (el filtro de centro de coste queda como un único buscador; los demás filtros no cambian)
- Motivo: tras T-10c el panel de filtros de líneas tenía **3 controles de centro de coste** redundantes (el combobox
  "Centro de coste" + los inputs "Centro de coste (código)" y "Centro de coste (nombre)"). El usuario pidió dejar
  **un solo** control.
- Archivos:
  - `presentation/src/components/lineas/LineasFilters.tsx` (se retiran los dos inputs de texto)
  - `presentation/src/types/api.ts` (`FiltrosLineas` sin `centro_coste_codigo` / `centro_coste_nombre`)
  - `presentation/src/hooks/useLineas.ts` (comentario de los 12 filtros)
  - `presentation/src/pages/Lineas.tsx` (comentario: el estado, la query y la exportación usan solo `centro_coste_id`)
  - `tests/e2e/centros-busqueda.spec.ts` (test nuevo: el panel expone un único control de centro de coste)
  - `specs/001-gestion-lineas-telefonicas/spec.md` (nota junto a RF-UI-LIN-1.2)
- **Hecho cuando:** el panel de filtros de líneas tiene un único control de centro de coste (el combobox "Centro de
  coste", que busca por código **o** nombre) y el listado/exportación se filtran por `centro_coste_id`; la API
  conserva los parámetros `centro_coste_codigo` y `centro_coste_nombre` y la pantalla `/catalogos` no cambia.
- Riesgo: ninguno funcional; el buscador ya cubre la búsqueda por código y por nombre (T-10c).

---

### T-10e · Buscador de centro de coste: uno específico o todos los que coincidan (tarea extra, aprobada por el usuario)

- [x] RF-UI-LIN-1.2 (el filtro de centro de coste conserva un único control, ahora con dos modos de uso)
- Motivo: petición textual del usuario _"LO MEJOR SIERIA QUE PUDIERAN SER AMBOS SI BUSCAN UNO EN ESPECIFICO O
  VARIOS DEL MISMO DEL TIPO"_: al escribir texto en el buscador hay que poder elegir **un centro concreto** o
  **todos los centros que coincidan** con ese texto (p. ej. escribir "FALABELLA" y quedarse con las 38 líneas de
  centros FALABELLA).
- Archivos:
  - `src/application/ports/repositories/LineaRepository.ts` (`centroCosteBusqueda` en `FiltrosLinea`)
  - `src/infrastructure/database/repositories/linea.repository.ts` (`condicionBusquedaCentroCoste()`, semántica OR
    con `ilikeSeguro`, en `listar()` y `exportar()`)
  - `src/infrastructure/http/schemas/linea.schemas.ts` (`centro_coste_busqueda`: string, trim, máx 100; heredado
    por la query de exportación)
  - `src/infrastructure/http/controllers/linea.controller.ts` (mapeo snake_case → `centroCosteBusqueda`)
  - `presentation/src/components/lineas/CentroCosteCombobox.tsx` (prop opcional `onSeleccionMultiple` y opción
    especial "Todos los centros que coincidan con «texto»")
  - `presentation/src/components/lineas/LineasFilters.tsx` (los dos modos son excluyentes)
  - `presentation/src/components/lineas/LineaFormModal.tsx` (el formulario **no** ofrece el modo múltiple)
  - `presentation/src/types/api.ts` (`centro_coste_busqueda` en `FiltrosLineas`), `presentation/src/hooks/useLineas.ts`,
    `presentation/src/pages/Lineas.tsx`, `presentation/src/styles.css` (`.combobox__opcion--multiple`)
  - `tests/integration/database/linea.repository.test.ts`, `tests/unit/application/services/linea.service.test.ts`,
    `tests/integration/http/api.test.ts`, `tests/e2e/centros-busqueda.spec.ts`
  - `specs/001-gestion-lineas-telefonicas/spec.md` (nota junto a RF-UI-LIN-1.2)
- **Hecho cuando:** `GET /api/v1/lineas?centro_coste_busqueda=<texto>` devuelve las líneas de todos los centros
  de coste cuyo código **o** nombre contengan ese texto (combinable con los demás filtros, con la paginación por
  cursor y con la exportación); en la UI, el desplegable del buscador ofrece **encima** de las coincidencias
  individuales la opción "Todos los centros que coincidan con «texto»", que deja el filtro en modo texto; elegir
  una coincidencia concreta deja el filtro en modo id (y limpia el modo texto).
- Riesgo: el buscador muestra como máximo 20 sugerencias individuales, por lo que el modo "todos los que
  coincidan" es el que da acceso a los centros que quedan fuera de ese TOP 20.

---

## Resumen de Tareas

| Tarea | Descripción                                              | RFs Principales          | Tiempo Est. |
| ----- | -------------------------------------------------------- | ------------------------ | ----------- |
| T-01  | Esquemas Drizzle + Migración                             | Modelo datos completo    | 25 min      |
| T-02  | Dominio: PhoneNumber, Errores, Entidades                 | VAL, LIN-1.4, LIN-1.8    | 30 min      |
| T-03  | Puertos + Repositorios Drizzle                           | CRUD + Listados + Export | 30 min      |
| T-04  | Services CRUD + Dashboard                                | FMT, CC, LIN, DASH, EXP  | 30 min      |
| T-05  | Import Service (Transaccional)                           | CC-IMP, LIN-IMP          | 30 min      |
| T-06  | Capa HTTP (Controllers, Routes, Middleware)              | Todos endpoints          | 30 min      |
| T-07  | UI Base (Vite, React, Layout, API Client)                | Fundación UI             | 25 min      |
| T-08  | UI Módulo Líneas (Tabla, Filtros, CRUD, Bulk, Export)    | UI-LIN                   | 30 min      |
| T-09  | UI Módulo Importación (2 secciones, Drag&Drop, Reportes) | UI-IMP                   | 30 min      |
| T-10  | E2E + Cobertura + Lint/Typecheck                         | Validación integral      | 25 min      |

**Total estimado**: ~4 hrs 45 min

---

## Próximo Paso

> **Plan (`plan.md`) y lista de tareas (`tasks.md`) aprobados**: la implementación de **T-01…T-10e** y del
> delta **T-11…T-19** está completa y verificada. Las tareas de corrección **T-20…T-22** (derivadas de la
> revisión posterior) también están completadas.

**Fecha de aprobación del plan**: 2026-11-05  
**Aprobado por**: usuario (2026-11-05)

---

## Delta v1.2 — Cierre de deuda técnica

**Basado en**: `plan.md` → «Plan del delta v1.2 — Cierre de deuda técnica (2026-11-05)».
**Regla**: una tarea = una llamada del implementer. Tests primero (TDD) y cada tarea deja `pnpm test` en verde.
**Orden**: T-11 → T-19 (dependencias de D.4 del plan). Las tareas T-01…T-10e ya están completadas; el delta empieza en
T-11. Al completar cada tarea, marcar `- [x]`.

### T-11 · Formatos: listado por `nombre` con cursor sobre `nombre`

- [x] RF-FMT-1.3, RF-ORD-1.4
- Archivos:
  - `src/infrastructure/database/repositories/cursor.ts`
  - `src/infrastructure/database/repositories/formato.repository.ts`
  - `src/infrastructure/database/repositories/centro-coste.repository.ts` y `linea.repository.ts` (pasar la columna a las
    funciones de cursor)
  - `tests/unit/infrastructure/cursor.test.ts` (nuevo)
  - `tests/integration/database/formato.repository.test.ts`
  - `tests/integration/http/api.test.ts`
- Pasos:
  1. **Rojo — unitario del cursor**: `decodificarCursor(codificarCursor('ALFA', id, 'nombre'), 'nombre')` devuelve
     `{ v: 'ALFA', id, c: 'nombre' }`; el mismo cursor con `'created_at'` lanza `ValidationError`; un cursor legado
     (base64 de `{ v, id }`, sin `c`) lanza `ValidationError`.
  2. **Rojo — repositorio**: crear `ZETA`, `ALFA` y `MU`; recorrer con `limit: 1` y comprobar el orden `ALFA, MU, ZETA`
     sin repetir ni saltar ids (mismo patrón que el test actual de 7 formatos).
  3. **Rojo — HTTP**: `GET /api/v1/formatos?limit=2` devuelve nombres ascendentes y `next_cursor` continúa por el
     siguiente nombre.
  4. Implementar el sobre `{ v, id, c }` y el `ORDER BY nombre ASC, id ASC`; adaptar las llamadas de centros
     (`'created_at'`) y de líneas (su columna de orden).
- **Hecho cuando:** los formatos salen por `nombre` ASC, el cursor lleva `c: 'nombre'`, un cursor de otra columna o legado
  responde 400 y `GET /api/v1/formatos/export` sigue ordenado por nombre.
- **Verificación:** `pnpm test tests/unit/infrastructure/cursor.test.ts tests/integration/database/formato.repository.test.ts tests/integration/http/api.test.ts`; `pnpm typecheck`.
- **Riesgo:** los cursores viejos pasan a responder 400 (decisión D.3 del plan).

---

### T-12 · Líneas: 9 columnas ordenables con cursor coherente

- [x] RF-ORD-1.1, RF-ORD-1.2, RF-ORD-1.3
- Archivos:
  - `src/application/ports/repositories/LineaRepository.ts`
  - `src/infrastructure/database/repositories/linea.repository.ts`
  - `src/infrastructure/http/schemas/linea.schemas.ts`
  - `src/infrastructure/http/controllers/linea.controller.ts`
  - `tests/integration/database/linea.repository.test.ts`
  - `tests/integration/http/api.test.ts`
- Pasos:
  1. **Rojo — repositorio**: con 3+ líneas de centros distintos, ordenar por cada una de las 9 columnas (asc y desc) y
     paginar con `limit: 1` hasta el final comprobando que no se repite ni se salta ningún id. Casos específicos:
     `centro_coste_codigo` (dos centros), `costo_mensual` (`900 < 1000`), `estado` y `tipo_uso`.
  2. **Rojo — HTTP**: `GET /api/v1/lineas?sort=proveedor&order=asc` devuelve ordenado; `sort=centro_coste_codigo` y
     `sort=tipo_uso` → 200; `sort=empleado` y `sort=inventado` → **400** con `errors` (RFC 7807).
  3. Implementar el mapa `COLUMNAS_ORDEN`, los casos de `valorCursor()` y el enum; retirar los casts del controlador.
- **Hecho cuando:** las 9 columnas ordenan en ambos sentidos y paginan sin repetir ni saltar; `empleado` responde 400.
- **Verificación:** `pnpm test tests/integration/database/linea.repository.test.ts tests/integration/http/api.test.ts`; `pnpm typecheck`.
- **Riesgo:** el keyset de `centro_coste_codigo` usa la columna del `JOIN`; probar la paginación, no solo una página.

---

### T-13 · UI: columnas ordenables de la tabla de líneas

- [x] RF-ORD-1.5
- Archivos:
  - `presentation/src/types/api.ts`
  - `presentation/src/components/lineas/LineasTable.tsx`
  - `presentation/src/pages/Lineas.tsx`
  - `tests/e2e/lineas-orden.spec.ts` (nuevo)
- Pasos:
  1. **Rojo — E2E**: crear dos líneas con proveedores y centros distintos; clicar la cabecera "Proveedor" y comprobar
     que la petición lleva `sort=proveedor&order=asc` y que las filas quedan ordenadas; clicar "Centro de Coste" y
     comprobar `sort=centro_coste_codigo`; comprobar que "Empleado" no es un `button`.
  2. Implementar el mapa `columna de tabla → columna de API` y tipar `sort`. El estado `sort` guarda la **columna de la
     API** (`centro_coste_codigo`); la flecha activa se calcula mapeando la clave de la tabla, para que el resaltado y el
     query string coincidan.
- **Hecho cuando:** las 8 columnas ordenables (todas las visibles menos `empleado`) lo son, la API recibe la columna
  correcta y la UI ya no ofrece orden por `created_at`.
- **Verificación:** `pnpm test:e2e tests/e2e/lineas-orden.spec.ts`; `pnpm --dir presentation typecheck`; `pnpm --dir presentation build`.
- **Riesgo:** desajuste `centro_coste` ↔ `centro_coste_codigo` → 400; lo cubre el E2E.

---

### T-14 · Unitarios: sanitización de fórmulas y normalización límite

- [x] RF-QUAL-1.4, RF-QUAL-1.5 (verifican RF-VAL-1.4 y RF-VAL-1.5)
- Archivos:
  - `tests/unit/application/services/import.service.test.ts`
  - `tests/unit/domain/PhoneNumber.test.ts`
- Pasos:
  1. **Sanitización (RF-QUAL-1.4)**: un caso por prefijo (`=`, `+`, `-`, `@`) y por campo de texto. Centros: `codigo`,
     `nombre` y `formato_nombre` (con `crear_formatos_faltantes: true`, assertar el nombre del formato creado, p. ej.
     `'=PELIGRO`). Líneas: `proveedor` y `empleado`. Assertar el valor persistido con apóstrofo y que `numero` y
     `centro_coste_codigo` **no** se sanitizan.
  2. **Normalización (RF-QUAL-1.5)**: `"+560 9 1234 5678"` y `"056 9 1234 5678"` → `{ normalized: '+56912345678',
tipo: 'movil' }`; `"5612345678"` → `{ normalized: '+565612345678', tipo: 'fijo' }`. `normalizePhone()` **no** se
     modifica (Q5).
- **Hecho cuando:** los tests nuevos pasan sin tocar `src/`; si alguno falla, el defecto es real y se corrige antes de
  seguir.
- **Verificación:** `pnpm test tests/unit/application/services/import.service.test.ts tests/unit/domain/PhoneNumber.test.ts`.
- **Riesgo:** `formato_nombre` sanitizado no resuelve contra un formato existente; usar la ruta de creación automática.

---

### T-15 · HTTP: `If-Match`, `incluir_bajas`, 413 y `fallidas` masivo

- [x] RF-QUAL-1.1, RF-QUAL-1.2 (parte HTTP), RF-QUAL-1.3, RF-QUAL-1.10 (parte HTTP), RF-QUAL-1.11
- Archivos:
  - `tests/integration/http/api.test.ts`
- Pasos:
  1. **If-Match (RF-QUAL-1.1)**: `PUT /api/v1/formatos/:id` con `If-Match: W/"1"` → 200 y `version: 2`; con `"2"` →
     200; con `abc`, `0` y `W/"x"` → 400; con `"1"` (versión ya superada) → 409 y sin cambio.
  2. **incluir_bajas (RF-QUAL-1.2)**: crear una línea y darla de baja; `GET /api/v1/lineas/export` y
     `?incluir_bajas=false` no contienen el número; `?incluir_bajas=true` sí.
  3. **413 (RF-QUAL-1.3)**: un buffer de 10 MB + 1 KB por multipart → 413 RFC 7807 en `/api/v1/import/centros-coste` y
     `/api/v1/import/lineas`.
  4. **masivo (RF-QUAL-1.11)**: `POST /api/v1/lineas/estado/masivo` con 2 ids válidos + 1 UUID inexistente →
     `{ actualizadas: 2, ignoradas: 0, fallidas: 1 }` y las 2 actualizadas.
  5. **reactivación (RF-QUAL-1.10)**: crear una línea, `PATCH /api/v1/lineas/:id/estado` a `baja`, volver a `activa` →
     200; `GET /api/v1/lineas` la incluye y la fila devuelta tiene `deleted_at: null`.
- **Hecho cuando:** los cinco grupos pasan sin tocar `src/`; si un caso falla por un defecto real, se detiene la tarea y
  se documenta (no se adapta el test al comportamiento observado).
- **Verificación:** `pnpm test tests/integration/http/api.test.ts`.
- **Riesgo:** el buffer de 10 MB ralentiza el archivo; mantener **un solo** caso de 413 por endpoint.

---

### T-16 · HTTP: KPIs sin caché, export `.xlsx` e import case-insensitive

- [x] RF-QUAL-1.8, RF-QUAL-1.9, RF-QUAL-1.12
- Archivos:
  - `tests/integration/http/api.test.ts`
- Pasos:
  1. **KPIs (RF-QUAL-1.8)**: `GET /api/v1/dashboard/kpis` → `total_lineas: 1, lineas_activas: 0`; `PATCH /api/v1/lineas/:id/estado` a `activa`; segundo `GET` → `lineas_activas: 1` (sin caché).
  2. **xlsx (RF-QUAL-1.9)**: un `GET …/export?format=xlsx` por recurso (líneas, centros de coste, formatos);
     `content-type` de Excel; `content-disposition` con `^(lineas|centros_coste|formatos)_\d{8}_\d{6}\.xlsx$`; releer
     `respuesta.rawPayload` con `XLSX.read` y assertar la primera fila (cabeceras de `COLUMNAS_EXPORT_*`).
  3. **case-insensitive (RF-QUAL-1.12)**: formato `SMU` existente + CSV con `formato_nombre: smu` → 200,
     `insertados: 1` y el centro apunta a `SMU`.
- **Hecho cuando:** los tres grupos pasan sin tocar `src/`; si un caso falla por un defecto real, se detiene la tarea y
  se documenta (no se adapta el test al comportamiento observado).
- **Verificación:** `pnpm test tests/integration/http/api.test.ts`.
- **Riesgo:** el prefijo real del archivo de centros es `centros_coste` (ver `nombreArchivoExport`).

---

### T-17 · E2E: segunda página, validación cliente, bajas y reactivación

- [x] RF-QUAL-1.6, RF-QUAL-1.7, RF-QUAL-1.2 (parte E2E), RF-QUAL-1.10 (parte E2E)
- Archivos:
  - `tests/e2e/lineas-paginacion.spec.ts` (nuevo)
  - `tests/e2e/lineas-validacion.spec.ts` (nuevo)
  - `tests/e2e/lineas-crud.spec.ts` (ampliar)
- Pasos:
  1. **Segunda página (RF-QUAL-1.6)**: preparar 21+ líneas y un centro con un único `POST /api/v1/import/lineas`
     (multipart con CSV generado); `/lineas` muestra 20 filas; "Siguiente ›" muestra un conjunto no vacío y **sin**
     números repetidos respecto de la página 1.
  2. **Validación cliente (RF-QUAL-1.7)**: abrir "Nueva línea" y pulsar "Crear línea" sin datos → visibles "El número es
     obligatorio" y "Selecciona un centro de coste"; rellenar número y centro con costo `-1` → "El costo no puede ser
     negativo"; contar las peticiones `POST /api/v1/lineas` (debe ser 0).
  3. **incluir bajas (RF-QUAL-1.2)**: crear una línea por API, darla de baja por API, marcar "incluir bajas" y pulsar
     "Exportar CSV"; el CSV descargado contiene el número.
  4. **reactivación (RF-QUAL-1.10)**: con la línea en baja, reactivarla por API (`PATCH /api/v1/lineas/:id/estado` a
     `activa`); recargar `/lineas` y comprobar que la fila reaparece y su `select` de estado muestra `activa`.
- **Hecho cuando:** los cuatro escenarios pasan con `pnpm test:e2e` sin detener el dev server.
- **Verificación:** `pnpm test:e2e`.
- **Riesgo:** 21 altas por API son lentas; preparar los datos con **una** importación CSV.

---

### T-18 · CI: cobertura obligatoria y artefacto

- [x] RF-CI-1.1, RF-CI-1.2, RF-CI-1.3
- Archivos:
  - `.github/workflows/ci.yml`
- Pasos:
  1. Medir la línea base con `pnpm test:coverage` y anotar el porcentaje global (statements, lines, functions,
     branches). Si algún umbral no se alcanza, cubrir los archivos de `src/infrastructure/http/**` o
     `src/application/**` que falten **antes** de encender el CI (los `src/infrastructure/database/**` no se miden).
  2. En el job `calidad`, cambiar el paso `Tests` por `Tests con cobertura` (`pnpm test:coverage`, mismo
     `DATABASE_URL`).
  3. Añadir `Subir reporte de cobertura` con `actions/upload-artifact@v4`, `if: always()`, `name: cobertura`,
     `path: coverage/`, `retention-days: 7`.
  4. No tocar el job `e2e` ni `vitest.config.ts` (los umbrales globales 80/80/80/70 ya están declarados).
- **Hecho cuando:** `pnpm test:coverage` termina en 0 en local, el workflow usa ese comando y sube `coverage/` incluso
  cuando el umbral falla; el job `e2e` queda idéntico.
- **Verificación:** `pnpm test:coverage`; `pnpm exec prettier --check .github/workflows/ci.yml`; revisar el diff del
  workflow.
- **Riesgo:** el umbral global puede estar por debajo de lo medido; se cubre en el paso 1 y **no** se baja el umbral.

---

### T-19 · Limpieza de artefactos y cierre en `MEMORY.md`

- [x] Documentación del delta (sin RF)
- Archivos:
  - `MEMORY.md`
  - `specs/001-gestion-lineas-telefonicas/_memoria-delta.md` (borrar)
  - `specs/001-gestion-lineas-telefonicas/_perm_probe*.md` (borrar todos)
- Pasos:
  1. Pegar al final de `MEMORY.md` el contenido de `_memoria-delta.md` **sin** el comentario HTML inicial
     (`<!-- … -->`).
  2. Añadir al final una sección `## Delta v1.2 completado — Cierre de deuda técnica (2026-11-05)` con las tareas
     T-11…T-18, el porcentaje de cobertura medido, la decisión sobre cursores (`c` obligatorio), los archivos tocados y
     los comandos verificados.
  3. Borrar `_memoria-delta.md` y **todos** los `_perm_probe*.md` (`_perm_probe.md` y las variantes con sufijo;
     contienen líneas de regla de 100 columnas, **no** están vacíos).
  4. Ejecutar `pnpm exec prettier --write "MEMORY.md" "specs/001-gestion-lineas-telefonicas/plan.md"
"specs/001-gestion-lineas-telefonicas/tasks.md"` (Prettier realinea las tablas) y después `--check` sobre todo
     `specs/**/*.md` y `MEMORY.md`; incluir el reformateo en el mismo commit.
  5. Marcar `- [x]` en T-11…T-18 y comprobar que no queda ningún `_*.md` en `specs/001-gestion-lineas-telefonicas/`.
- **Hecho cuando:** `MEMORY.md` contiene las dos secciones, no queda ningún `_*.md` en
  `specs/001-gestion-lineas-telefonicas/` y `specs/` queda sin temporales.
- **Verificación:** `pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"`; listar el contenido de
  `specs/001-gestion-lineas-telefonicas/`.
- **Riesgo:** pegar el comentario HTML o duplicar la sección; revisar el diff de `MEMORY.md`.

---

## Correcciones tras la validación — `If-Match` en `DELETE`, parseo estricto y tests que faltaban

**Contexto**: el subagente `reviewer` devolvió **CAMBIOS NECESARIOS** con 5 hallazgos sobre el estado
anterior al delta. El usuario aprobó: (a) resolver el hallazgo nº1 **por vía código** (implementar `If-Match`
en los `DELETE`) y (b) aplicar también los hallazgos nº3, nº4 y nº5. El hallazgo nº2 es **documental**
(lo hace el implementador, no el planner).

**Regla**: una tarea = una llamada del implementer. Tests primero (TDD) y cada tarea deja `pnpm test` en verde.

### T-20 · `If-Match` en `DELETE` (nº1), parseo estricto (nº3) y 2 tests que faltaban (nº5)

- [x] RF-OPT-1.1, RF-OPT-1.2, RF-OPT-1.3, RF-ORD-1.1, RF-VAL-1.4
- Archivos:
  - `src/infrastructure/http/if-match.ts` (parseo estricto)
  - `src/infrastructure/http/routes/{linea,formato,centro-coste}.routes.ts` (leer `If-Match` en el `DELETE`)
  - `src/infrastructure/http/controllers/{linea,formato,centro-coste}.controller.ts`
  - `src/application/services/{linea,formato,centro-coste}.service.ts`
  - `src/application/ports/repositories/{Formato,CentroCoste}Repository.ts`
  - `src/infrastructure/database/repositories/{formato,centro-coste}.repository.ts`
  - `tests/unit/infrastructure/if-match.test.ts`, `tests/unit/application/services/{linea,formato,centro-coste}.service.test.ts`
  - `tests/integration/http/api.test.ts`, `tests/integration/database/{formato,centro-coste}.repository.test.ts`,
    `tests/integration/database/import.service.test.ts`
- Pasos:
  1. **Rojo — unitario de `versionEsperadaDe`**: `'3abc'`, `'3.5'`, `'1e3'`, `'"3abc"'` y `'W/"3.5"'` →
     `ValidationError` (RF-OPT-1.2: solo se acepta un entero ≥ 1).
  2. **Rojo — unitarios de servicio**: `eliminar(id, versionEsperada)` de formato, centro de coste y línea;
     versión desactualizada → `ConflictError` **sin** escribir; borrado condicional que no afecta filas →
     `ConflictError`; recurso inexistente → `NotFoundError` (404, no 409).
  3. **Rojo — HTTP**: `DELETE /api/v1/{formatos,centros-coste,lineas}/:id` con `If-Match` desactualizada → 409 y
     el recurso **no** cambia; con `If-Match` inválida → 400 y el recurso **no** cambia; con la versión correcta →
     borrado efectivo. Cursor de `/api/v1/lineas`: sin `c` (legado) y emitido para `created_at` usado con
     `sort=proveedor` → 400 RFC 7807.
  4. **Rojo — BD**: importación real de un CSV con `=PELIGRO` en `proveedor`/`empleado` y comprobación del
     **valor persistido** en la tabla (empieza por `'`).
  5. Implementar: los tres `DELETE` leen `If-Match` con `versionEsperadaDe(request)` y la propagan; el borrado es
     condicional por versión (`DELETE ... WHERE id = $1 AND version = $2`); parseo estricto de la cabecera.
- **Hecho cuando:** los tests nuevos pasan; `pnpm test` en verde; los tests nuevos **fallan** si se revierte
  cualquiera de los 3 mecanismos (parseo estricto, propagación de `If-Match`, borrado condicional).
- **Verificación:** `pnpm test`; `pnpm typecheck`; `pnpm lint`.
- **Riesgo:** el `DELETE` de líneas es una **baja lógica** (`UPDATE`), no un `DELETE` físico: la condición de
  versión se aplica en el `UPDATE` (`actualizar`), que ya usa _optimistic locking_.

---

### T-21 · Cabeceras de `plan.md` y `tasks.md` en estado real (nº4)

- [x] Documentación (sin RF)
- Archivos:
  - `specs/001-gestion-lineas-telefonicas/plan.md`
  - `specs/001-gestion-lineas-telefonicas/tasks.md`
- Pasos:
  1. `plan.md`: estado `borrador (pendiente aprobación)` → **aprobado**; `Fecha de aprobación del plan` →
     **2026-11-05**; línea de firma rellena con la fórmula neutra.
  2. `tasks.md`: «Fecha de aprobación del plan» y «Aprobado por» rellenados.
  3. No inventar nombres: «Aprobado por: usuario (2026-11-05)».
- **Hecho cuando:** ninguna cabecera queda en «borrador» ni «pendiente».
- **Verificación:** `pnpm exec prettier --check "specs/**/*.md"`.

---

### T-22 · Actualización documental del estado de verificación (nº2)

- [x] Documentación (sin RF; no se reescriben requisitos)
- Archivos:
  - `specs/001-gestion-lineas-telefonicas/spec.md` (§9)
  - `specs/001-gestion-lineas-telefonicas/validation.md` (§1, §3.1, §3.2, §4, §6, §8)
  - `MEMORY.md`
- Pasos:
  1. `spec.md` §9: el estado real es **81 RF** (56 originales + 25 del delta v1.2), **RF-LIN-1.9** y
     **RF-FMT-1.3** ahora **CUMPLE**; remitir a la sección de cierre de `MEMORY.md`.
  2. `validation.md`: §3.1 y §3.2 pasan de «hallazgo abierto» a «cerrado»; §6 marca las 13 ramas como
     **cubiertas**, indicando el fichero de test de cada una; §4 y §6 reflejan los RF-OPT cerrados.
  3. `MEMORY.md`: sección con el detalle de las correcciones (qué, por qué, decisiones del usuario y comandos).
- **Hecho cuando:** `spec.md` §9 y `validation.md` ya no declaran «54 CUMPLE / 2 PARCIAL» ni «13 ramas sin
  cobertura».
- **Verificación:** `pnpm exec prettier --write` sobre los `.md` tocados y `pnpm format:check` en verde.
- **Corrección (vuelta 2, 2026-11-05):** §1 de `validation.md` se reescribió para reflejar **81 RF → 81 CUMPLE /
  0 PARCIAL** (56 originales + 25 del delta v1.2), sin el bloque que presentaba los 2 parciales como deuda vigente;
  §6 deja de calificar las 13 ramas como «pendientes». Los antiguos parciales quedan como **cerrados** (T-12 y T-11).

---

## Resumen del delta v1.2

- **T-11** Formatos: listado por `nombre` y cursor con columna (`c`).
- **T-12** Líneas: 9 columnas ordenables y cursor por columna.
- **T-13** UI: columnas ordenables (8, sin `empleado`).
- **T-14** Unitarios: sanitización completa y normalización límite.
- **T-15** HTTP: `If-Match`, `incluir_bajas`, 413, reactivación y `fallidas`.
- **T-16** HTTP: KPIs sin caché, `.xlsx` e import case-insensitive.
- **T-17** E2E: segunda página, validación cliente, bajas y reactivación.
- **T-18** CI: `pnpm test:coverage` + artefacto `coverage/`.
- **T-19** Limpieza de temporales y cierre en `MEMORY.md`.

## Resumen de las correcciones posteriores a la validación

- **T-20** `If-Match` en los tres `DELETE` (nº1), parseo estricto de la cabecera (nº3) y 2 tests que faltaban
  (cursor de `/api/v1/lineas` y sanitización verificada en BD) (nº5).
- **T-21** Cabeceras de `plan.md` y `tasks.md` en estado real (nº4).
- **T-22** Estado de verificación de `spec.md` §9 y `validation.md` (nº2).

---

## Delta v1.3 — Paginación de UI en catálogos (2026-11-06)

**Basado en**: `plan.md` → anexo «Plan del delta v1.3» y `spec.md` **v1.3, aprobada** (94 RF: 81 del delta v1.2 + RF-CAT-1.1…1.9 y RF-QUAL-1.13…1.16).
**Regla**: una tarea = una llamada del implementer. Tests primero (TDD) y cada tarea deja `pnpm test` en verde. Las tareas T-01…T-22 ya están completadas; el delta empieza en T-23. Al completar cada tarea, marcar `- [x]`.
**Orden**: T-23 → T-31 (dependencias de §E.4 del plan).

### T-23 · Hooks paginados de Formatos (`useFormatos` y `useFormatosCatalogo`)

- [x] RF-CAT-1.1, RF-CAT-1.4, RF-CAT-1.6, RF-CAT-1.7
- Archivos:
  - `presentation/src/hooks/useFormatos.ts`
- Pasos:
  1. **Rojo — unitario del hook**: `useFormatos()` solicita `limit=20` sin `after_id` en la página 1 y con el cursor de la página activa en las siguientes; `useFormatosCatalogo()` solicita `limit=100` sin `after_id`.
  2. Implementar `useFormatos({limite = 20, orden = 'nombre', direccion = 'asc'})` que reinicie `after_id` al cambiar orden/dirección, e implementar `useFormatosCatalogo()` (`limit=100`, sin cursor) para los selects de formato (catálogo completo, independiente de la página de la tabla).
- **Hecho cuando:** `useFormatos` pide `limit=20` con cursor y `useFormatosCatalogo` pide `limit=100` sin cursor (verificado con mock de `api.get`); al cambiar el orden se reinicia a página 1 sin `after_id`; los selects del catálogo no dependen de la paginación de la tabla.
- Verificación: `pnpm --dir presentation typecheck`.
- Riesgo: el SPA no tiene runner de unitarios (decisión Q3 de v1.2); este test puede requerir añadir `@testing-library/react` + `jsdom`.

### T-24 · Panel Formatos con paginación UI (20 filas/página, cursor)

- [x] RF-CAT-1.1, RF-CAT-1.3, RF-CAT-1.8, RF-CAT-1.9
- Archivos:
  - `presentation/src/components/catalogos/FormatosPanel.tsx`
  - `tests/unit/hooks/useFormatos.test.ts` (nuevo: test unitario del hook paginado)
- Pasos:
  1. **Rojo — unitario del hook paginado**: reinicio de `after_id` al cambiar orden; «Siguiente» deshabilitado cuando no hay `next_cursor`.
  2. Implementar paginación UI en `FormatosPanel` con pila de cursores (patrón de `pages/Lineas.tsx`, T-13): «Anterior» deshabilitado en página 1; «Siguiente» deshabilitado sin `next_cursor`; cambiar de página avanza el cursor manteniendo la columna de orden (`c`).
- **Hecho cuando:** la tabla de formatos muestra 20 filas por página; «Anterior» está deshabilitado en la página 1; «Siguiente» está deshabilitado en la última página; cambiar el orden reinicia a la página 1; el test unitario del hook pasa.
- Verificación: `pnpm --dir presentation typecheck` y `pnpm --dir presentation build`.

### T-25 · Hook `useCentrosCoste` paginado (20 filas/página, cursor)

- [x] RF-CAT-1.4, RF-CAT-1.5, RF-CAT-1.6, RF-CAT-1.8
- Archivos:
  - `presentation/src/hooks/useCentrosCoste.ts`
  - `tests/e2e/centros-paginacion-api.spec.ts` (nuevo: E2E de segunda página)
- Pasos:
  1. **Rojo — E2E**: crear 25+ centros de coste (un formato + centros por `POST /api/v1/centros-coste`), solicitar `GET /api/v1/centros-coste?limit=20` y repetir con `after_id` de la última fila de la primera; la segunda página debe devolver filas distintas y sin repetir de la primera.
  2. Implementar `useCentrosCoste(filtros, {limite = 20})` con `after_id`; al cambiar los filtros se descarta `after_id` (primera página). `useBuscarCentrosCoste` se mantiene sin paginación (`limit=20`).
- **Hecho cuando:** `useCentrosCoste` pide `limit=20` con cursor y reinicia al cambiar filtros; el E2E de segunda página pasa (`pnpm test:e2e tests/e2e/centros-paginacion-api.spec.ts`).
- Verificación: `pnpm test:e2e tests/e2e/centros-paginacion-api.spec.ts`; `pnpm --dir presentation typecheck`.

### T-26 · Panel Centros de Coste con paginación UI (20 filas/página, cursor)

- [x] RF-CAT-1.3, RF-CAT-1.4, RF-CAT-1.5, RF-CAT-1.8
- Archivos:
  - `presentation/src/components/catalogos/CentrosCostePanel.tsx`
  - `tests/unit/hooks/useCentrosCoste.test.ts` (nuevo: test unitario del hook paginado)
- Pasos:
  1. **Rojo — unitario del hook paginado**: página 1 sin `after_id`; cambio de filtros descarta el cursor.
  2. Implementar controles Anterior/Siguiente en `CentrosCostePanel` (mismo patrón que `FormatosPanel`) y reinicio de cursores al pulsar «Aplicar filtros» o «Limpiar». El `Select` de formato se alimenta con `useFormatosCatalogo()` (catálogo completo, `limit=100`).
- **Hecho cuando:** la tabla de centros está paginada a 20 filas; «Aplicar filtros» y «Limpiar» vuelven a la página 1 sin `after_id`; el select de formato sigue con el catálogo completo aunque la tabla pagine; el test unitario del hook pasa.
- Verificación: `pnpm --dir presentation typecheck` y `pnpm --dir presentation build`.

### T-27 · E2E Formatos: 2ª página y selects no vacían al paginar

- [ ] RF-QUAL-1.13, RF-QUAL-1.15 (RF-CAT-1.1, RF-CAT-1.3, RF-CAT-1.7)
- Archivos:
  - `tests/e2e/formatos-paginacion.spec.ts` (nuevo)
- Pasos:
  1. Crear 21+ formatos por API; abrir `/catalogos`; la página 1 muestra 20 filas y «Siguiente ›» muestra una página 2 con filas distintas y sin números/nombres repetidos de la página 1.
  2. Paginar la tabla de formatos y comprobar que el `Select` de formato (formulario de centro de coste y filtro de centros de coste) no se vacía al cambiar de página (RF-CAT-1.7).
- **Hecho cuando:** `pnpm test:e2e tests/e2e/formatos-paginacion.spec.ts` pasa sin detener el dev server.
- Verificación: `pnpm test:e2e tests/e2e/formatos-paginacion.spec.ts`.

### T-28 · E2E Centros: 2ª página y reinicio por filtros

- [ ] RF-QUAL-1.14, RF-QUAL-1.16 (RF-CAT-1.4, RF-CAT-1.5)
- Archivos:
  - `tests/e2e/centros-paginacion.spec.ts` (nuevo)
- Pasos:
  1. Crear 21+ centros de coste por API; abrir `/catalogos`; la página 2 muestra un conjunto de filas distinto y no vacío respecto de la página 1.
  2. Aplicar un filtro (código, nombre o formato) y verificar que la paginación se reinicia a la primera página (sin `after_id`); «Limpiar» también reinicia.
- **Hecho cuando:** `pnpm test:e2e tests/e2e/centros-paginacion.spec.ts` pasa sin detener el dev server.
- Verificación: `pnpm test:e2e tests/e2e/centros-paginacion.spec.ts`.

### T-29 · Formato de specs con Prettier y `format:check`

- [ ] (sin RF — calidad de documentación)
- Archivos: `specs/001-gestion-lineas-telefonicas/spec.md`, `plan.md`, `tasks.md` (solo retoque de formato; sin cambiar requisitos ni tareas existentes)
- **Hecho cuando:** `pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"` está en verde; `spec.md` sin cambios de requisitos y T-01…T-22 intactas con sus marcas `[x]`.
- Riesgo: Prettier realinea tablas; revisar el diff antes de hacer commit.

### T-30 · Cierre en `MEMORY.md` del delta v1.3

- [ ] (sin RF — documentación)
- Archivos: `MEMORY.md`
- Pasos: añadir al final la sección «Delta v1.3 — Paginación de UI en catálogos (2026-11-06)» con las tareas T-23…T-31, los RFs cubiertos (RF-CAT-1.1…1.9, RF-QUAL-1.13…1.16) y los comandos verificados del delta.
- **Hecho cuando:** `MEMORY.md` contiene la sección del delta v1.3 con tareas, RF y comandos verificados; `pnpm exec prettier --check "specs/**/*.md" "MEMORY.md"` en verde.
- Nota: esta tarea la ejecuta un agente con permiso sobre `MEMORY.md` (el planner solo escribe dentro de `specs/`).

### T-31 · Verificación final del delta v1.3

- [ ] (sin RF — verificación)
- Archivos: (ninguno; ejecuta la suite completa)
- Pasos: `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm --dir presentation typecheck`, `pnpm --dir presentation build` y `pnpm db:generate`.
- **Hecho cuando:** toda la suite está en verde, `pnpm db:generate` no produce cambios de esquema, y las tareas T-23…T-31 están marcadas `[x]`.

## Resumen del delta v1.3 — Paginación de UI en catálogos

| Tarea    | Contenido                                                          | RFs principales           | Estado |
| -------- | ------------------------------------------------------------------ | ------------------------- | ------ |
| **T-23** | Hooks paginados de Formatos + catálogo completo para selects       | RF-CAT-1.1, 1.4, 1.6, 1.7 | [x]    |
| **T-24** | Panel Formatos con paginación UI (20 filas/página, cursor)         | RF-CAT-1.1, 1.3, 1.8, 1.9 | [x]    |
| **T-25** | Hook `useCentrosCoste` paginado + E2E segunda página               | RF-CAT-1.4, 1.5, 1.6, 1.8 | [x]    |
| **T-26** | Panel Centros de Coste con paginación UI (20 filas/página, cursor) | RF-CAT-1.3, 1.4, 1.5, 1.8 | [x]    |
| **T-27** | E2E Formatos: 2ª página y selects intactos                         | RF-QUAL-1.13, 1.15        | [x]    |
| **T-28** | E2E Centros: 2ª página y reinicio por filtros                      | RF-QUAL-1.14, 1.16        | [x]    |
| **T-29** | Formato de specs con Prettier + `format:check`                     | (sin RF)                  | [x]    |
| **T-30** | Cierre en `MEMORY.md` del delta v1.3                               | (sin RF)                  | [x]    |
| **T-31** | Verificación final del delta v1.3                                  | (sin RF)                  | [x]    |

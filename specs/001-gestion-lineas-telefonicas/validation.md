# Validación de implementación — Spec 001 Gestión de Líneas Telefónicas

**Fecha**: 2026-11-04 (validación original); cierre del delta v1.2 y correcciones: 2026-11-05
**Revisor**: subagente `reviewer` (QA)
**Veredicto**: **APROBADO**

---

## 1. Resumen

La revisión formal de la spec 001 contra la implementación se hizo en dos pasos. La **validación original
(2026-11-04)** cubrió los **56 RF originales** de `specs/001-gestion-lineas-telefonicas/spec.md`; solo dos requisitos
de ordenamiento quedaron fuera de CUMPLE (**RF-LIN-1.9** y **RF-FMT-1.3**), ambos menores y sin impacto en la
operabilidad del sistema. El usuario aprobó cerrarlos **como tareas dentro de esta misma spec** (no como spec nueva),
junto con las 13 ramas sin cobertura de tests y el umbral de cobertura en el CI.

El **delta v1.2 (2026-11-05)** añadió **25 RF** (5 ORD, 3 OPT, 12 QUAL, 3 CI y 2 VAL), implementados en las tareas
**T-11…T-19**. Una revisión posterior detectó 5 hallazgos, que el usuario aprobó resolver y quedaron cerrados con las
tareas **T-20…T-22**. El alcance final es de **81 RF** (56 originales + 25 del delta v1.2):

| Estado         | Cantidad |
| -------------- | -------- |
| CUMPLE         | 81       |
| PARCIAL        | 0        |
| NO CUMPLE      | 0        |
| No verificable | 0        |

**Estado final (2026-11-05)**: **81 CUMPLE / 0 PARCIAL / 0 NO CUMPLE**. Los antiguos parciales **RF-LIN-1.9**
(ordenamiento por cualquiera de las 9 columnas) y **RF-FMT-1.3** (formatos ordenados por `nombre`) quedan **cerrados**
por el delta v1.2 (T-12 y T-11, respectivamente) y las **13 ramas** de §6 quedan **cubiertas** (T-14…T-18). **No queda
deuda técnica abierta** dentro del alcance de esta spec.

### 1.1 Cierre de la deuda técnica (delta v1.2, 2026-11-05)

Detalle de los cierres y su evidencia:

| Cierre                       | RFs afectadas                      | Evidencia                                                                                     |
| ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| RF-LIN-1.9 (cerrado)         | RF-LIN-1.9, RF-ORD-1.1…1.5         | `tests/integration/database/linea.repository.test.ts`, `tests/integration/http/api.test.ts`   |
| RF-FMT-1.3 (cerrado)         | RF-FMT-1.3, RF-ORD-1.4             | `tests/integration/database/formato.repository.test.ts`, `tests/integration/http/api.test.ts` |
| Bloqueo optimista            | RF-OPT-1.1, RF-OPT-1.2, RF-OPT-1.3 | `tests/unit/infrastructure/if-match.test.ts`, `tests/integration/http/api.test.ts`            |
| Cobertura de las 13 ramas    | RF-QUAL-1.1…1.12                   | ver §6                                                                                        |
| Umbral de cobertura en el CI | RF-CI-1.1, RF-CI-1.2, RF-CI-1.3    | `.github/workflows/ci.yml`, `vitest.config.ts`                                                |

Detalle del cierre: sección «Delta v1.2 completado — Cierre de deuda técnica (2026-11-05)» de `MEMORY.md`.

---

## 2. Cobertura por capacidad

| Capacidad | RFs                                      | Estado    | Nota breve                                                            |
| --------- | ---------------------------------------- | --------- | --------------------------------------------------------------------- |
| FMT       | RF-FMT-1.1, 1.2, 1.3, 1.4                | 4 CUMPLE  | **Cerrado**: RF-FMT-1.3 ya ordena por `nombre` (ver §3.2)             |
| CC        | RF-CC-1.1 … RF-CC-1.6 (6 RF)             | 6 CUMPLE  | CRUD completo con borrado bloqueado por dependencias                  |
| CC-IMP    | RF-CC-IMP-1.1 … RF-CC-IMP-1.5 (5 RF)     | 5 CUMPLE  | Importación transaccional todo-o-nada con reporte                     |
| LIN       | RF-LIN-1.1 … RF-LIN-1.9 (9 RF)           | 9 CUMPLE  | **Cerrado**: RF-LIN-1.9 ya ordena por las 9 columnas (ver §3.1)       |
| LIN-IMP   | RF-LIN-IMP-1.1 … RF-LIN-IMP-1.10 (10 RF) | 10 CUMPLE | Duplicados no bloquean; errores de validación cancelan la importación |
| LIN-EXP   | RF-LIN-EXP-1.1 … RF-LIN-EXP-1.4 (4 RF)   | 4 CUMPLE  | CSV/XLSX con filtros aplicados                                        |
| DASH      | RF-DASH-1.1, RF-DASH-1.2 (2 RF)          | 2 CUMPLE  | 4 KPIs, sin caché                                                     |
| UI-LIN    | RF-UI-LIN-1.1 … RF-UI-LIN-1.7 (7 RF)     | 7 CUMPLE  | Tabla paginada, 14 filtros, CRUD, cambio de estado masivo             |
| UI-IMP    | RF-UI-IMP-1.1 … RF-UI-IMP-1.4 (4 RF)     | 4 CUMPLE  | Dos secciones (centros / líneas) con reporte                          |
| VAL       | RF-VAL-1.1 … RF-VAL-1.5 (5 RF)           | 5 CUMPLE  | Normalización chilena, sanitización de fórmulas y casos límite        |
| CC-EXP    | RF-CC-EXP-1.1 (1 RF)                     | 1 CUMPLE  | Export de centros de coste                                            |
| FMT-EXP   | RF-FMT-EXP-1.1 (1 RF)                    | 1 CUMPLE  | Export de formatos                                                    |
| ORD       | RF-ORD-1.1 … RF-ORD-1.5 (5 RF)           | 5 CUMPLE  | 9 columnas ordenables y cursor coherente por columna                  |
| OPT       | RF-OPT-1.1 … RF-OPT-1.3 (3 RF)           | 3 CUMPLE  | `If-Match` en `PUT` **y** `DELETE`, con parseo estricto (ver §4)      |
| QUAL      | RF-QUAL-1.1 … RF-QUAL-1.12 (12 RF)       | 12 CUMPLE | Las 13 ramas de §6, una por una                                       |
| CI        | RF-CI-1.1 … RF-CI-1.3 (3 RF)             | 3 CUMPLE  | `pnpm test:coverage` con puerta de cobertura en el pipeline           |

---

## 3. Hallazgos menores (2, **cerrados** el 2026-11-05)

### 3.1 RF-LIN-1.9 — Ordenamiento limitado a 4 columnas — **CERRADO**

**Estado original**: la spec indica ordenamiento del listado de líneas por cualquier columna, pero la implementación
solo admitía 4:

- `src/infrastructure/http/schemas/linea.schemas.ts:86` — enum de `sort` en el schema HTTP.
- `src/application/ports/repositories/LineaRepository.ts:7` — tipo `ColumnaOrdenLinea`.
- `src/infrastructure/database/repositories/linea.repository.ts:74-82` — mapa `COLUMNAS_ORDEN` con la expresión SQL y
  el tipo usado para el cast del cursor.

**Cierre (delta v1.2, T-12)**: el conjunto de columnas ordenables pasó a ser el **cerrado de 9 columnas** de
RF-ORD-1.2 (`numero`, `proveedor`, `centro_coste_codigo`, `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `estado`,
`tipo_uso`, `created_at`), con `empleado` excluido por la decisión Q4 (es nullable y rompería el keyset del cursor).
La paginación por cursor viaja ahora sobre la columna de orden (`RF-ORD-1.1`), de modo que un cursor de otra columna
se rechaza con **400**.

**Verificación**: `tests/integration/database/linea.repository.test.ts` (recorrido de las 9 columnas en ambos sentidos
paginado) y `tests/integration/http/api.test.ts` (`sort=proveedor`, `sort=centro_coste_codigo`, `sort=tipo_uso`,
`sort=empleado` → 400).

### 3.2 RF-FMT-1.3 — El listado de formatos no viene ordenado por `nombre` — **CERRADO**

**Estado original**: existía `FormatoRepository.listarTodos()` con `ORDER BY nombre ASC`
(`src/infrastructure/database/repositories/formato.repository.ts:165-172`), pero solo lo usaba el export. El endpoint
`GET /api/v1/formatos` usaba `listar()` con `ORDER BY created_at DESC`
(`src/infrastructure/database/repositories/formato.repository.ts:113`).

**Cierre (delta v1.2, T-11)**: `listar()` pasó a `ORDER BY nombre ASC, id ASC` con keyset `(nombre, id)` y el cursor
viaja sobre `nombre` (`RF-ORD-1.4`). El export no cambia (ya ordenaba por `nombre ASC`).

**Verificación**: `tests/integration/database/formato.repository.test.ts` (orden `ALFA → MU → ZETA` paginando con
`limit: 1` sin repetir ni saltar, y sobre `{ v: 'ALFA', id, c: 'nombre' }`) y `tests/integration/http/api.test.ts`
(`GET /api/v1/formatos?limit=2` devuelve `ALFA, MU` y el `next_cursor` continúa con `ZETA`).

---

## 4. Desviaciones aceptadas (confirmadas en el código)

Las 6 desviaciones detectadas frente a la spec fueron revisadas y **aceptadas** al comprobar que la implementación
respetaba la constitución y las decisiones de diseño:

1. **Paginación cursor-based `after_id` (keyset)**, sin `OFFSET` en ningún listado.
2. **`If-Match` opcional**: si no llega la cabecera, la operación se ejecuta sin verificación de versión. **Sigue
   siendo una desviación consciente** respecto de la regla 10 de la constitución (el delta v1.2 no la cambió), pero su
   semántica ya está **cerrada** por RF-OPT-1.1…1.3: la cabecera se aplica **tanto en `PUT` como en `DELETE`** (los
   tres `DELETE`: `/lineas/:id`, `/formatos/:id`, `/centros-coste/:id`), el parseo es **estricto** (solo un entero
   ≥ 1) y una versión que no coincide produce **409 sin aplicar el cambio**.
3. **UI = SPA React + Vite** en `presentation/`, como paquete pnpm propio que nunca importa código de `src/`.
4. **API HTTP en snake_case** con DTOs de aplicación en camelCase (traducidos en la capa HTTP).
5. **`linea_historial` (auditoría) no implementada** en esta spec; quedó postergada explícitamente en la sección 3 de la
   spec.
6. **Sin Docker** → los tests de integración y E2E se ejecutan sobre el PostgreSQL local con la base `telefono2_test`.

Además, los endpoints de exportación viven en `/api/v1/.../export`: la spec los escribía sin versión, pero la
constitución obliga a versionar bajo `/api/v1/`.

> **Nota (cierre de RF-OPT, 2026-11-05)**: la revisión posterior detectó que los tres `DELETE` **ignoraban** la
> cabecera `If-Match` (un `If-Match: "999"` borraba sin 409 y un `If-Match: "abc"` borraba sin 400). El usuario aprobó
> resolverlo **por vía código**: los `DELETE` ahora leen la cabecera, la propagan hasta el servicio y el borrado es
> **condicional por versión** (`DELETE ... WHERE id = $1 AND version = $2`; en el caso de las líneas, que es una baja
> lógica, la condición va en el `UPDATE`). El **404** (recurso inexistente) y el **409** (versión que no coincide) son
> respuestas distintas y no se mezclan.

---

## 5. Comprobaciones transversales verificadas

| Comprobación                                                  | Resultado | Referencia                                            |
| ------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| Errores en formato RFC 7807                                   | Conforme  | `src/infrastructure/http/middleware/error-handler.ts` |
| Propagación de `correlation-id`                               | Conforme  | middleware de correlación de Fastify                  |
| Sanitización de fórmulas                                      | Conforme  | `src/application/services/import.service.ts`          |
| Ausencia de `OFFSET` en los listados                          | Conforme  | repositorios y esquema de paginación por cursor       |
| Regla de dependencias `domain → application → infrastructure` | Conforme  | `src/` (la SPA nunca importa `src/`)                  |
| Logging estructurado con Pino                                 | Conforme  | nivel vía `LOG_LEVEL`                                 |
| OpenAPI servido en `/docs` y `/openapi.json`                  | Conforme  | `src/app.ts`                                          |
| Health check                                                  | Conforme  | `GET /health`                                         |

---

## 6. Cobertura de pruebas: las 13 ramas detectadas en la revisión original — **TODAS CUBIERTAS**

Se detectaron **13 ramas o caminos de código sin cobertura de tests** en la revisión original. **Todas están
cubiertas** desde el delta v1.2 (tareas **T-14…T-18**):

| #   | Rama detectada                                                                              | RF            | Cubierta en                                                                                                    |
| --- | ------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | `If-Match` a nivel HTTP y el parseo de la cabecera (`W/"3"`, `"3"`, valor inválido)         | RF-QUAL-1.1   | `tests/unit/infrastructure/if-match.test.ts` y `tests/integration/http/api.test.ts` (`PUT` **y** `DELETE`)     |
| 2   | `incluir_bajas=true` a nivel HTTP y en E2E (solo probado en repositorio)                    | RF-QUAL-1.2   | `tests/integration/http/api.test.ts` y `tests/e2e/lineas-crud.spec.ts`                                         |
| 3   | 413 por archivo > 10 MB vía HTTP (solo hay test de servicio)                                | RF-QUAL-1.3   | `tests/integration/http/api.test.ts` (ambos endpoints de importación)                                          |
| 4   | Sanitización con los prefijos `+`, `-`, `@` y en los campos `proveedor`/`empleado`          | RF-QUAL-1.4   | `tests/unit/application/services/import.service.test.ts` y `tests/integration/database/import.service.test.ts` |
| 5   | Casos límite de normalización: `"+560 9 1234 5678"`, `"056 9 1234 5678"` y `"5612345678"`   | RF-QUAL-1.5   | `tests/unit/domain/PhoneNumber.test.ts`                                                                        |
| 6   | Paginación en la UI: ningún E2E navega a la segunda página                                  | RF-QUAL-1.6   | `tests/e2e/lineas-paginacion.spec.ts`                                                                          |
| 7   | Validación en cliente del formulario de línea (mensajes de error)                           | RF-QUAL-1.7   | `tests/e2e/lineas-validacion.spec.ts`                                                                          |
| 8   | Dashboard "sin caché" (que dos llamadas seguidas reflejen el cambio)                        | RF-QUAL-1.8   | `tests/integration/http/api.test.ts`                                                                           |
| 9   | Exportación a `.xlsx` (`construirXlsx` no se ejercita)                                      | RF-QUAL-1.9   | `tests/integration/http/api.test.ts` (los 3 recursos, con comprobación de la firma ZIP)                        |
| 10  | Reactivación desde `baja` vía HTTP/E2E                                                      | RF-QUAL-1.10  | `tests/integration/http/api.test.ts` y `tests/e2e/lineas-crud.spec.ts`                                         |
| 11  | `fallidas` del cambio masivo con ids inexistentes a nivel HTTP                              | RF-QUAL-1.11  | `tests/integration/http/api.test.ts`                                                                           |
| 12  | Importación de centros con `formato_nombre` en mayúsculas distintas (rama case-insensitive) | RF-QUAL-1.12  | `tests/integration/http/api.test.ts`                                                                           |
| 13  | Enforcement del umbral de cobertura 80%/70% (la constitución lo exige, no está en el CI)    | RF-CI-1.1…1.3 | `.github/workflows/ci.yml` (paso «Tests con cobertura» + artefacto `cobertura`) y `vitest.config.ts`           |

Además, la revisión posterior añadió dos comprobaciones que faltaban a nivel HTTP/BD:

- **Cursor de `/api/v1/lineas`**: cursor legado (sin `c`) y cursor emitido para `created_at` usado con
  `sort=proveedor` → **400** RFC 7807 (`tests/integration/http/api.test.ts`).
- **Sanitización verificada en la base de datos**: importación real de un CSV con `=PELIGRO` y comprobación del
  **valor persistido** (`tests/integration/database/import.service.test.ts`).

---

## 7. Comandos ejecutados en la validación

| Comando                             | Resultado (revisión original) | Resultado (cierre 2026-11-05)                                                 |
| ----------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `pnpm test`                         | 19 archivos / 336 tests OK    | 21 archivos / **446 tests OK**                                                |
| `pnpm test:e2e`                     | 15 tests OK                   | **29 tests OK**                                                               |
| `pnpm test:coverage`                | (no se ejecutaba en el CI)    | código de salida **0** (83,46 % st / 88,33 % br / 95,38 % fn / 83,46 % lines) |
| `pnpm typecheck`                    | OK                            | OK                                                                            |
| `pnpm lint`                         | OK                            | OK (0 errores, 0 warnings)                                                    |
| `pnpm format:check`                 | (n/a)                         | OK                                                                            |
| `pnpm --dir presentation typecheck` | OK                            | OK                                                                            |

---

## 8. Conclusión

La implementación de la spec 001 es **sólida, completa y verificable**: los **81 requisitos funcionales** (56
originales + 25 del delta v1.2) se cumplen íntegramente, no queda ningún requisito parcial, sin cumplir ni bloqueante.

Los 2 hallazgos menores de esta revisión (RF-FMT-1.3 y RF-LIN-1.9) están **cerrados**, las **13 ramas** que no tenían
cobertura están **cubiertas** y el **CI** ejecuta la suite con una **puerta de cobertura activa**. Se recomienda
**cerrar la fase de Validar**.

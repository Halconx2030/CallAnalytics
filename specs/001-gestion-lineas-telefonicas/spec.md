# Spec 001 — Gestión de Líneas Telefónicas

**Estado**: aprobado (v1.2 — delta de cierre de deuda técnica)
**Versión**: 1.2
**Fecha**: 2026-11-04
**Fecha de aprobación**: 2026-11-04
**Fecha de actualización**: 2026-11-05

---

## 1. Problema

La organización necesita un sistema centralizado para gestionar el inventario de líneas telefónicas (móviles y fijas), su asignación a centros de coste, importación masiva desde archivos de proveedores, y un dashboard operativo con KPIs y capacidades CRUD completas. Actualmente no existe una fuente única de verdad; los datos están dispersos en hojas de cálculo sin trazabilidad ni validación automática de números chilenos.

---

## 2. Qué incluye esta spec

| Capability                    | Descripción                                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Formatos**                  | Catálogo de formatos (ej: "SMU", "FALABELLA") referenciados por centros de coste                                                                                                                                                                                        |
| **Centros de Coste**          | Gestión y importación masiva (codigo único, nombre, formato_id)                                                                                                                                                                                                         |
| **Líneas Telefónicas**        | CRUD completo con campos: numero (único, normalizado chileno), proveedor, centro_coste_id (FK obligatorio), fecha_asignacion, costo_mensual, tipo_linea (movil/fijo), empleado (opcional), estado (activa/baja/pendiente/portabilidad), tipo_uso (personal/geovictoria) |
| **Importación de Líneas**     | CSV/Excel con cabeceras; inserta solo nuevas por número único; reporta duplicados; permite crear línea solo con número                                                                                                                                                  |
| **Dashboard Principal**       | Sidebar izquierda con KPIs: Total líneas, Líneas activas, Count Personal, Count Geovictoria                                                                                                                                                                             |
| **Módulo Líneas (UI)**        | Tabla paginada (20 filas/página), filtros por columna, CRUD completo, cambio estado masivo                                                                                                                                                                              |
| **Módulo Importación (UI)**   | Dos secciones: Importar Centros de Coste \| Importar Líneas; validación y reporte de resultados                                                                                                                                                                         |
| **Validación número chileno** | Normalización a estándar: +56 9 XXXX XXXX (móvil) / +56 XX XXXX XXXX (fijo)                                                                                                                                                                                             |
| **Exportación (EXP)**         | Generación de reportes CSV/Excel de líneas, centros de coste y formatos con filtros aplicados                                                                                                                                                                           |
| **Cierre de deuda técnica**   | Precisiones de ordenamiento (RF-FMT-1.3, RF-LIN-1.9), bloqueo optimista por `If-Match`, cobertura de las 13 ramas pendientes y enforcement del umbral de cobertura en CI (§5.9)                                                                                         |

---

## 3. Fuera de esta spec

- Facturación, rating de llamadas o consumo de minutos/datos
- Integración con PBX/centralitas en tiempo real
- Portabilidad automática con operadores (solo estado "portabilidad" manual)
- Gestión de usuarios, roles, autenticación/autorización (se asume auth externa)
- Multi-tenancy / organizations
- Webhooks o notificaciones push
- Historial/auditoría inmutable de cambios (se hará en spec posterior)
- Dashboard analítico avanzado (gráficos, tendencias)

---

## 4. Modelo de Datos

### 4.1 Entidades

```
Formato
├── id: UUID (PK)
├── nombre: string (único, ej: "SMU", "FALABELLA")
├── created_at: timestamp
└── updated_at: timestamp

CentroCoste
├── id: UUID (PK)
├── codigo: string (único, ej: "510", "C059102801")
├── nombre: string (ej: "RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO")
├── formato_id: UUID (FK → Formato.id, NOT NULL)
├── created_at: timestamp
└── updated_at: timestamp

LineaTelefonica
├── id: UUID (PK)
├── numero: string (normalizado E.164 chileno, único, NOT NULL)
├── numero_original: string (valor crudo del import/ingreso)
├── proveedor: string (texto libre, ej: "Entel", "Movistar", "WOM")
├── centro_coste_id: UUID (FK → CentroCoste.id, NOT NULL)
├── fecha_asignacion: date (NOT NULL)
├── costo_mensual: decimal(10,2) (NOT NULL, ≥ 0)
├── tipo_linea: enum ('movil' | 'fijo') (NOT NULL)
├── empleado: string | null (opcional, texto libre)
├── estado: enum ('activa' | 'baja' | 'pendiente' | 'portabilidad') (NOT NULL, default 'pendiente')
├── tipo_uso: enum ('personal' | 'geovictoria') (NOT NULL, default 'personal')
├── created_at: timestamp
├── updated_at: timestamp
└── deleted_at: timestamp | null (soft delete para baja lógica)
```

### 4.2 Índices y Restricciones

```sql
-- Unicidad de número normalizado (solo líneas no dadas de baja)
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
```

### 4.3 Normalización de Número Chileno (Regla de Dominio)

| Entrada (ejemplos) | Tipo detectado    | Salida normalizada (`numero`) |
| ------------------ | ----------------- | ----------------------------- |
| `9 1234 5678`      | móvil             | `+56912345678`                |
| `+56 9 1234 5678`  | móvil             | `+56912345678`                |
| `56912345678`      | móvil             | `+56912345678`                |
| `2 1234 5678`      | fijo (Santiago)   | `+56212345678`                |
| `+56 2 1234 5678`  | fijo              | `+56212345678`                |
| `56212345678`      | fijo              | `+56212345678`                |
| `09 1234 5678`     | móvil (con 0)     | `+56912345678`                |
| `32 1234 5678`     | fijo (Valparaíso) | `+563212345678`               |
| `41 1234 5678`     | fijo (Concepción) | `+564112345678`               |

**Regla**: Única función `normalizePhone(raw: string): { normalized: string; tipo: 'movil' | 'fijo' }` en `domain/value-objects/PhoneNumber.ts`. Lanza error si no es número chileno válido.

**Regiones soportadas**: Móvil (prefijo 9) y fijo nacional (prefijos 2, 32, 33, 34, 35, 41, 42, 43, 44, 45, 51, 52, 53, 55, 56, 57, 58, 61, 63, 64, 65, 67, 71, 72, 73, 75).

---

## 5. Requisitos EARS

### 5.1 Capability: Formatos (FMT)

| ID         | Requisito (EARS)                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-FMT-1.1 | EL SISTEMA DEBE permitir crear un Formato con `nombre` único.                                                                                     |
| RF-FMT-1.2 | EL SISTEMA DEBE rechazar la creación si `nombre` ya existe (conflicto 409).                                                                       |
| RF-FMT-1.3 | EL SISTEMA DEBE listar todos los Formatos ordenados por `nombre`.                                                                                 |
| RF-FMT-1.4 | EL SISTEMA DEBE permitir eliminar un Formato solo si no tiene Centros de Coste asociados; en caso contrario, DEBE retornar error 409 con detalle. |

### 5.2 Capability: Centros de Coste (CC)

| ID        | Requisito (EARS)                                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-CC-1.1 | EL SISTEMA DEBE permitir crear un Centro de Coste con `codigo` único, `nombre`, y `formato_id` existente.                                       |
| RF-CC-1.2 | EL SISTEMA DEBE rechazar la creación si `codigo` ya existe (conflicto 409).                                                                     |
| RF-CC-1.3 | EL SISTEMA DEBE rechazar la creación si `formato_id` no existe (error 400).                                                                     |
| RF-CC-1.4 | EL SISTEMA DEBE permitir actualizar `nombre` y `formato_id` de un Centro de Coste existente; `codigo` es inmutable.                             |
| RF-CC-1.5 | EL SISTEMA DEBE permitir eliminar un Centro de Coste solo si no tiene Líneas Telefónicas asociadas; en caso contrario, DEBE retornar error 409. |
| RF-CC-1.6 | EL SISTEMA DEBE listar Centros de Coste con paginación (20/página) y filtros por `codigo`, `nombre`, `formato_id`.                              |

#### 5.2.1 Importación de Centros de Coste (CC-IMP)

| ID            | Requisito (EARS)                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-CC-IMP-1.1 | CUANDO el usuario sube un archivo CSV/Excel con cabeceras `codigo,nombre,formato_nombre`, EL SISTEMA DEBE validar cada fila: `codigo` único (en BD y en archivo), `formato_nombre` existe en BD. |
| RF-CC-IMP-1.2 | SI una fila tiene `formato_nombre` inexistente, EL SISTEMA DEBE reportar error en esa fila y NO importar ninguna fila (transaccionalidad todo-o-nada).                                           |
| RF-CC-IMP-1.3 | SI un `codigo` ya existe en BD, EL SISTEMA DEBE reportar duplicado y NO importar ninguna fila.                                                                                                   |
| RF-CC-IMP-1.4 | CUANDO la importación es exitosa, EL SISTEMA DEBE retornar reporte: `{ insertados: number, duplicados: number, errores: Array<{fila, codigo, motivo}> }`.                                        |
| RF-CC-IMP-1.5 | EL SISTEMA DEBE aceptar archivos hasta 10 MB y máximo 50,000 filas.                                                                                                                              |

> **Nota (RF-CC-IMP-1.2)**: el comportamiento por defecto **no cambia**. La importación de centros de coste admite además una
> opción _opt-in_ (`crear_formatos_faltantes`, campo multipart `crear_formatos_faltantes`): cuando está activa, los formatos
> que no existan en la base de datos se crean automáticamente —en la misma transacción que la inserción de los centros de coste—
> y se informan en el reporte (`formatos_creados`). Sin esa opción, un `formato_nombre` inexistente sigue siendo un error por fila
> y no se importa ninguna fila.

### 5.3 Capability: Líneas Telefónicas (LIN)

#### 5.3.1 CRUD Básico

| ID         | Requisito (EARS)                                                                                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-LIN-1.1 | EL SISTEMA DEBE permitir crear una Línea Telefónica con `numero` (se normaliza y valida), `centro_coste_id` existente, `fecha_asignacion`, `costo_mensual` ≥ 0, `tipo_linea` (movil/fijo), `proveedor`, `empleado` (opcional), `estado` (default 'pendiente'), `tipo_uso` (default 'personal'). |
| RF-LIN-1.2 | EL SISTEMA DEBE rechazar la creación si `numero` normalizado ya existe en una línea no dada de baja (conflicto 409).                                                                                                                                                                            |
| RF-LIN-1.3 | EL SISTEMA DEBE rechazar la creación si `centro_coste_id` no existe (error 400).                                                                                                                                                                                                                |
| RF-LIN-1.4 | EL SISTEMA DEBE rechazar la creación si `numero` no es un número chileno válido (error 400 con detalle).                                                                                                                                                                                        |
| RF-LIN-1.5 | EL SISTEMA DEBE permitir actualizar todos los campos excepto `numero` e `id`; `numero` es inmutable.                                                                                                                                                                                            |
| RF-LIN-1.6 | EL SISTEMA DEBE permitir cambio de `estado` individual (activa/baja/pendiente/portabilidad).                                                                                                                                                                                                    |
| RF-LIN-1.7 | EL SISTEMA DEBE permitir cambio de `estado` masivo: dado un array de `ids` y un `estado` nuevo, actualizar todas en una transacción; reportar cuántas se actualizaron y cuáles fallaron (p.ej., ya en baja).                                                                                    |
| RF-LIN-1.8 | EL SISTEMA DEBE implementar baja lógica: al poner `estado = 'baja'`, SET `deleted_at = now()`; la línea deja de aparecer en listados normales pero persiste en BD.                                                                                                                              |
| RF-LIN-1.9 | EL SISTEMA DEBE listar Líneas con paginación (20/página), ordenamiento por cualquier columna, y filtros por cada campo (búsqueda parcial en strings, exacto en enums/fechas/rangos numéricos).                                                                                                  |

#### 5.3.2 Importación de Líneas (LIN-IMP)

| ID              | Requisito (EARS)                                                                                                                                                                                                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-LIN-IMP-1.1  | CUANDO el usuario sube un archivo CSV/Excel con cabeceras `numero,proveedor,centro_coste_codigo,fecha_asignacion,costo_mensual,tipo_linea,empleado,estado,tipo_uso`, EL SISTEMA DEBE procesar fila a fila.                                                                                                                                               |
| RF-LIN-IMP-1.2  | SOLO se insertan líneas cuyo `numero` normalizado NO exista ya en BD (líneas no dadas de baja).                                                                                                                                                                                                                                                          |
| RF-LIN-IMP-1.3  | SI un `numero` ya existe, EL SISTEMA DEBE reportarlo como duplicado en el resultado y NO actualizar la línea existente.                                                                                                                                                                                                                                  |
| RF-LIN-IMP-1.4  | EL SISTEMA DEBE permitir crear una línea proporcionando SOLO `numero`; el resto de campos son opcionales y toman valores por defecto: `estado='pendiente'`, `tipo_uso='personal'`, `tipo_linea` inferido del número, `costo_mensual=0`, `fecha_asignacion=hoy`, `proveedor=''`, `empleado=null`, `centro_coste_id` DEBE resolverse (ver RF-LIN-IMP-1.6). |
| RF-LIN-IMP-1.5  | SI `centro_coste_codigo` no existe en BD, EL SISTEMA DEBE reportar error en esa fila.                                                                                                                                                                                                                                                                    |
| RF-LIN-IMP-1.6  | SI la fila no trae `centro_coste_codigo` NI `centro_coste_id`, EL SISTEMA DEBE reportar error (centro de coste obligatorio).                                                                                                                                                                                                                             |
| RF-LIN-IMP-1.7  | EL SISTEMA DEBE validar `fecha_asignacion` (formato YYYY-MM-DD), `costo_mensual` (decimal ≥ 0), `tipo_linea` (movil/fijo), `estado` (valores permitidos), `tipo_uso` (personal/geovictoria).                                                                                                                                                             |
| RF-LIN-IMP-1.8  | CUANDO la importación termina, EL SISTEMA DEBE retornar reporte: `{ insertados: number, duplicados: Array<{numero, motivo}>, errores: Array<{fila, numero, motivo}> }`.                                                                                                                                                                                  |
| RF-LIN-IMP-1.9  | EL SISTEMA DEBE procesar la importación en una transacción: si hay errores de validación en CUALQUIER fila, NO se inserta NINGUNA (todo-o-nada), pero los duplicados reportados NO bloquean la transacción (se insertan los válidos no duplicados).                                                                                                      |
| RF-LIN-IMP-1.10 | EL SISTEMA DEBE aceptar archivos hasta 10 MB y máximo 50,000 filas.                                                                                                                                                                                                                                                                                      |

#### 5.3.3 Exportación de Líneas (LIN-EXP) — NUEVO

| ID             | Requisito (EARS)                                                                                                                                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-LIN-EXP-1.1 | EL SISTEMA DEBE exponer endpoint `GET /api/lineas/export` que genere archivo CSV/Excel con todas las líneas filtradas según parámetros de query (mismos filtros que listado).                                                          |
| RF-LIN-EXP-1.2 | EL ARCHIVO EXPORTADO DEBE incluir columnas: `numero`, `numero_original`, `proveedor`, `centro_coste_codigo`, `centro_coste_nombre`, `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `empleado`, `estado`, `tipo_uso`, `created_at`. |
| RF-LIN-EXP-1.3 | EL SISTEMA DEBE permitir exportar solo líneas activas (`deleted_at IS NULL`) o incluir bajas (parámetro `incluir_bajas=true`).                                                                                                         |
| RF-LIN-EXP-1.4 | EL NOMBRE DEL ARCHIVO DEBE ser `lineas_YYYYMMDD_HHMMSS.csv` (o `.xlsx`).                                                                                                                                                               |

### 5.4 Capability: Dashboard (DASH)

| ID          | Requisito (EARS)                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-DASH-1.1 | EL SISTEMA DEBE exponer un endpoint `/api/dashboard/kpis` que retorne: `total_lineas` (count donde deleted_at IS NULL), `lineas_activas` (count donde estado='activa' AND deleted_at IS NULL), `count_personal` (count donde tipo_uso='personal' AND deleted_at IS NULL), `count_geovictoria` (count donde tipo_uso='geovictoria' AND deleted_at IS NULL). |
| RF-DASH-1.2 | LOS KPIs DEBEN calcularse en tiempo real sobre la BD (sin caché persistente).                                                                                                                                                                                                                                                                              |

### 5.5 Capability: UI - Módulo Líneas (UI-LIN)

| ID            | Requisito (EARS)                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-UI-LIN-1.1 | LA INTERFAZ DEBE mostrar tabla paginada (20 filas/página) con columnas: Número, Proveedor, Centro de Coste, Fecha Asignación, Costo Mensual, Tipo Línea, Empleado, Estado, Tipo Uso, Acciones. |
| RF-UI-LIN-1.2 | LA INTERFAZ DEBE permitir filtro de búsqueda por cada columna (input de texto para strings, select para enums, date picker para fechas, range para costo).                                     |
| RF-UI-LIN-1.3 | LA INTERFAZ DEBE permitir crear nueva línea (modal/formulario) con validación en cliente y servidor.                                                                                           |
| RF-UI-LIN-1.4 | LA INTERFAZ DEBE permitir editar línea existente (modal/formulario pre-poblado).                                                                                                               |
| RF-UI-LIN-1.5 | LA INTERFAZ DEBE permitir baja lógica (botón "Dar de baja" → confirma → PUT estado='baja').                                                                                                    |
| RF-UI-LIN-1.6 | LA INTERFAZ DEBE permitir selección múltiple (checkbox por fila + "Seleccionar todo en página") y acción masiva "Cambiar estado" con select de estados permitidos.                             |
| RF-UI-LIN-1.7 | LA INTERFAZ DEBE mostrar botón "Exportar" que descargue CSV/Excel con los filtros actuales aplicados (RF-LIN-EXP-1.1).                                                                         |

> **Nota (RF-UI-LIN-1.2, T-10c)**: el filtro de **centro de coste** es un _buscador_ (combobox) en lugar de un
> `select` con el listado completo: el usuario escribe el **código o el nombre** y el servidor
> (`GET /api/v1/centros-coste?busqueda=...`) devuelve **todos** los centros de coste que contienen ese texto
> (no solo los primeros 100). El mismo buscador se usa en el formulario de alta/edición de línea, donde el
> campo "Centro de coste *" sigue siendo obligatorio.
>
> **Nota (RF-UI-LIN-1.2, T-10d)**: el filtro de centro de coste del panel de líneas es un **único buscador**,
> que acepta indistintamente el código o el nombre del centro de coste. Por ese motivo se retiran los inputs de
> texto "Centro de coste (código)" y "Centro de coste (nombre)": quedan **12 filtros** en el panel (de los 14
> originales, `centro_coste_codigo` y `centro_coste_nombre` se sustituyen por el buscador). Los parámetros
> `centro_coste_codigo` y `centro_coste_nombre` **se conservan en la API** (`GET /api/v1/lineas` y
> `GET /api/v1/lineas/export`); solo deja de usarlos la UI de líneas. La pantalla `/catalogos` mantiene sus
> filtros propios por código, nombre y formato.
>
> **Nota (RF-UI-LIN-1.2, T-10e)**: el buscador de centro de coste tiene **dos modos de uso**, excluyentes
> entre sí:
>
> 1. **Un centro concreto**: se elige una coincidencia del desplegable y el listado se filtra por
>    `centro_coste_id`.
> 2. **Todos los que coincidan**: se elige la opción especial "Todos los centros que coincidan con «texto»"
>    y el listado se filtra por `centro_coste_busqueda`, que devuelve las líneas de **todos** los centros de
>    coste cuyo **código o nombre** contengan ese texto (p. ej. escribir "FALABELLA" y quedarse con las
>    líneas de los 38 centros FALABELLA).
>
> El parámetro nuevo `centro_coste_busqueda` (`GET /api/v1/lineas` y `GET /api/v1/lineas/export`) aplica la
> semántica **OR** sobre el centro de coste y es combinable con los demás filtros y con la paginación por
> cursor. Si llegan a la vez `centro_coste_id` y `centro_coste_busqueda` se combinan con **AND** (la UI nunca
> los envía juntos).

### 5.6 Capability: UI - Módulo Importación (UI-IMP)

| ID            | Requisito (EARS)                                                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-UI-IMP-1.1 | LA INTERFAZ DEBE mostrar dos secciones separadas: "Importar Centros de Coste" y "Importar Líneas".                                                               |
| RF-UI-IMP-1.2 | CADA sección DEBE permitir arrastrar/soltar o seleccionar archivo CSV/Excel.                                                                                     |
| RF-UI-IMP-1.3 | AL procesar, LA INTERFAZ DEBE mostrar progreso y al finalizar DEBE mostrar reporte detallado: insertados, duplicados (con números), errores (con fila y motivo). |
| RF-UI-IMP-1.4 | LA INTERFAZ DEBE permitir descargar plantilla CSV de ejemplo para cada tipo de importación.                                                                      |

### 5.7 Capability: Validación y Normalización (VAL)

| ID         | Requisito (EARS)                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-VAL-1.1 | LA FUNCIÓN `normalizePhone(raw)` DEBE aceptar strings con espacios, guiones, paréntesis, prefijo +56, 56, 0, 9, 2, y DEBE retornar `{ normalized: string, tipo: 'movil'                                                                                                        | 'fijo' }` en formato E.164 chileno (+569XXXXXXXXX o +56XXXXXXXXXX). |
| RF-VAL-1.2 | SI `raw` no corresponde a un número chileno válido (móvil 9 dígitos tras +569, fijo 9 dígitos tras +56X donde X≠9), `normalizePhone` DEBE lanzar error tipado `InvalidPhoneNumberError` con mensaje descriptivo.                                                               |
| RF-VAL-1.3 | NINGÚN otro punto del código DEBE transformar números telefónicos; toda persistencia y comparación DEBE usar el valor normalizado.                                                                                                                                             |
| RF-VAL-1.4 | CUANDO una celda de texto importable (`codigo`, `nombre`, `formato_nombre`, `proveedor`, `empleado`) comienza por `=`, `+`, `-` o `@`, EL SISTEMA DEBE anteponer un apóstrofo (`'`) al valor persistido, para impedir la interpretación como fórmula (constitución, regla 12). |
| RF-VAL-1.5 | `normalizePhone` DEBE normalizar `"+560 9 1234 5678"` y `"056 9 1234 5678"` a `+56912345678` (tipo `movil`), y DEBE normalizar `"5612345678"` a `+565612345678` (tipo `fijo`, fijo regional con código de área 56).                                                            |

> **Nota (RF-VAL-1.4, RF-VAL-1.5)**: estos dos requisitos **documentan el comportamiento ya implementado** (no lo
> cambian). La tabla de normalización de la sección 4.3 no los cubría, y la regla 12 de la constitución (sanitización) no
> tenía un RF asociado.
>
> **Decisión (Q5) — `"5612345678"` se resuelve como fijo regional**: son 10 dígitos que empiezan por `56`, lectura que puede
> resultar ambigua (prefijo de país mal escrito frente a código de área). Se **confirma** la resolución actual de
> `normalizePhone()`: `+565612345678`, tipo `fijo` (fijo regional, código de área 56). `normalizePhone()` **no se modifica**;
> lo que se añade es el test que fija esta resolución (RF-QUAL-1.5).

### 5.8 Capability: Exportación de Centros de Coste y Formatos (CC-EXP, FMT-EXP) — NUEVO

| ID             | Requisito (EARS)                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-CC-EXP-1.1  | EL SISTEMA DEBE exponer endpoint `GET /api/centros-coste/export` que genere CSV/Excel con columnas: `codigo`, `nombre`, `formato_nombre`, `created_at`. |
| RF-FMT-EXP-1.1 | EL SISTEMA DEBE exponer endpoint `GET /api/formatos/export` que genere CSV/Excel con columnas: `nombre`, `created_at`.                                  |

### 5.9 Capability: Cierre de deuda técnica (CIERRE) — NUEVO (v1.1, decisions cerradas en v1.2)

> **Nota**: esta sección **no cambia** el comportamiento ya implementado ni reescribe los requisitos anteriores. Cierra la
> deuda técnica registrada en [`validation.md`](./validation.md) (hallazgos 3.1 y 3.2, y las 13 ramas sin cobertura de la
> sección 6 de ese informe). Los requisitos que la spec ya exigía se **precisan** aquí; los que faltaban se **redactan**.

#### 5.9.1 Precisiones de ordenamiento (ORD)

| ID         | Requisito (EARS)                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-ORD-1.1 | MIENTRAS se pagina el listado de líneas con una columna de orden distinta de `created_at`, EL SISTEMA DEBE mantener la paginación por cursor coherente con esa columna (el cursor DEBE transportar el valor de la columna de orden y el `id` como desempate).                     |
| RF-ORD-1.2 | EL SISTEMA DEBE admitir como columnas de ordenamiento del listado de líneas el conjunto cerrado: `numero`, `proveedor`, `centro_coste_codigo`, `fecha_asignacion`, `costo_mensual`, `tipo_linea`, `estado`, `tipo_uso` y `created_at`.                                            |
| RF-ORD-1.3 | SI el parámetro `sort` del listado de líneas recibe un valor fuera del conjunto de RF-ORD-1.2, EL SISTEMA DEBE responder 400 con detalle de validación (RFC 7807).                                                                                                                |
| RF-ORD-1.4 | MIENTRAS se pagina el listado de formatos, EL SISTEMA DEBE mantener la paginación por cursor coherente con el orden por `nombre`.                                                                                                                                                 |
| RF-ORD-1.5 | LA INTERFAZ DEBE ofrecer ordenamiento por cada columna que muestra en la tabla de líneas **excepto `empleado`**, y el conjunto de columnas ordenables de la UI DEBE ser un subconjunto del de RF-ORD-1.2 (la API puede admitir columnas que la UI no exponga, como `created_at`). |

> **Nota (RF-FMT-1.3, cumplimiento)**: RF-FMT-1.3 ya exigía el orden por `nombre`; el endpoint `GET /api/v1/formatos` usa
> hoy `listar()` (`ORDER BY created_at DESC`) mientras que `listarTodos()` (`ORDER BY nombre ASC`) solo lo usa el export.
> El cierre es **trabajo de cumplimiento**, no un requisito nuevo: el listado de formatos DEBE entregarse ordenado por
> `nombre` ascendente.
>
> **Consecuencia técnica de RF-ORD-1.4**: como `GET /api/v1/formatos` es paginado por cursor y hoy el cursor viaja sobre
> `created_at`, el cambio de orden **obliga** a que el cursor viaje también sobre `nombre` (con `id` como desempate), o
> la paginación entregaría filas repetidas o saltadas. `listarTodos()` (usado por el export) ya está en el orden correcto y
> no se ve afectado.
>
> **Nota (RF-LIN-1.9, precisión)**: RF-LIN-1.9 ya exigía "ordenamiento por cualquier columna"; la implementación admite
> hoy solo 4. El cierre es **trabajo de cumplimiento**: se precisa el conjunto de columnas ordenables en RF-ORD-1.2 y se
> añade el requisito de coherencia del cursor (RF-ORD-1.1), que no estaba redactado.
>
> **Criterio de RF-ORD-1.2 (Decisión)**: el conjunto de columnas ordenables se toma de las columnas de la tabla de líneas
> de la UI (`RF-UI-LIN-1.1`) más `created_at` (orden por defecto ya implementado), **descartando `empleado`** (ver nota
> siguiente). Quedan **fuera** `id`, `numero_original`, `version`, `updated_at` y `deleted_at` (columnas técnicas o no
> mostradas en la UI).
>
> **Decisión (Q4) — `empleado` NO es ordenable**: `empleado` admite `NULL`, y la comparación _keyset_ del cursor
> (`(columna, id) > (valor, id)`) no es fiable con nulos: una tupla con `NULL` nunca resulta "mayor" que otra, por lo que
> las filas con `empleado` nulo quedarían fuera de la paginación y el orden por esa columna no sería determinista. Se
> **excluye** del conjunto de RF-ORD-1.2. `empleado` **sigue siendo** columna visible de la UI y **sigue funcionando** como
> filtro de texto (búsqueda parcial, `RF-LIN-1.9`); solo se retira la capacidad de ordenar por ella. Todas las columnas del
> conjunto final son `NOT NULL`, lo que hace el cursor inequívoco.
>
> **Nota (supuesto)**: `centro_coste_codigo` es una columna de la tabla unida (`centros_coste.codigo`); se incluye porque la
> UI la muestra y el filtro por centro de coste ya la usa. Su expresión SQL y su tipo de cast para el cursor (`text`) se
> resuelven en el Plan, no aquí.
>
> **Nota (RF-ORD-1.5)**: la UI puede exponer un subconjunto del conjunto de la API. Hoy la tabla de líneas
> (`presentation/src/components/lineas/LineasTable.tsx`) declara ordenables `numero`, `costo_mensual`,
> `fecha_asignacion` y `created_at`, pero **no muestra una columna `created_at`**, por lo que ese orden no es alcanzable
> desde la interfaz.

#### 5.9.2 Bloqueo optimista por `If-Match` (OPT)

| ID         | Requisito (EARS)                                                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-OPT-1.1 | CUANDO una petición de escritura (`PUT`/`DELETE`) incluye la cabecera `If-Match` con un _entity-tag_ fuerte (`"3"`) o débil (`W/"3"`), EL SISTEMA DEBE usar el entero contenido en la cabecera como versión esperada del recurso. |
| RF-OPT-1.2 | SI el valor de la cabecera `If-Match` no es un entero mayor o igual a 1, EL SISTEMA DEBE responder 400 con detalle de validación (RFC 7807) sin ejecutar la escritura.                                                            |
| RF-OPT-1.3 | SI la versión esperada no coincide con la versión almacenada del recurso, EL SISTEMA DEBE responder 409 y NO DEBE aplicar el cambio.                                                                                              |

> **Nota (desviación aceptada)**: la cabecera `If-Match` **sigue siendo opcional** (si no llega, la operación se ejecuta
> sin verificación de versión). Es una desviación consciente respecto de la regla 10 de la constitución, ya aceptada en
> `validation.md` §4. Esta sección **no la cambia**; solo fija la semántica de parseo y de conflicto.

#### 5.9.3 Cobertura de las ramas pendientes (QUAL)

> **Nota**: los requisitos siguientes **no introducen comportamiento nuevo**; obligan a que el comportamiento ya
> implementado quede cubierto por tests automatizados verificables. Cada uno referencia el RF que lo origina.

| ID           | Requisito (EARS)                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-QUAL-1.1  | LA SUITE DE PRUEBAS DEBE verificar a nivel HTTP el parseo de la cabecera `If-Match` en sus tres variantes (`W/"3"`, `"3"` y un valor inválido), cubriendo RF-OPT-1.1 y RF-OPT-1.2.                                                                                |
| RF-QUAL-1.2  | LA SUITE DE PRUEBAS DEBE verificar a nivel HTTP y E2E que la exportación de líneas con `incluir_bajas=true` incluye las líneas dadas de baja lógicamente y que, con el parámetro en `false` u omitido, las excluye (RF-LIN-EXP-1.3).                              |
| RF-QUAL-1.3  | LA SUITE DE PRUEBAS DEBE verificar a nivel HTTP que un archivo de más de 10 MB es rechazado con 413 (RF-CC-IMP-1.5, RF-LIN-IMP-1.10).                                                                                                                             |
| RF-QUAL-1.4  | LA SUITE DE PRUEBAS DEBE verificar la sanitización de fórmulas ante los prefijos `=`, `+`, `-` y `@` en todos los campos de texto importables, incluidos `proveedor` y `empleado` (RF-VAL-1.4).                                                                   |
| RF-QUAL-1.5  | LA SUITE DE PRUEBAS DEBE verificar los casos límite de normalización de número telefónico (RF-VAL-1.5).                                                                                                                                                           |
| RF-QUAL-1.6  | LA SUITE E2E DEBE verificar que la navegación a la segunda página del listado de líneas muestra un conjunto de filas distinto del de la primera página (RF-UI-LIN-1.1).                                                                                           |
| RF-QUAL-1.7  | LA SUITE E2E DEBE verificar que el formulario de línea muestra los mensajes de error de validación en cliente (número obligatorio, centro de coste obligatorio, costo no negativo) y NO envía la petición al servidor cuando la validación falla (RF-UI-LIN-1.3). |
| RF-QUAL-1.8  | LA SUITE DE PRUEBAS DEBE verificar que dos llamadas consecutivas al endpoint de KPIs reflejan un cambio de estado de líneas efectuado entre ambas (RF-DASH-1.2).                                                                                                  |
| RF-QUAL-1.9  | LA SUITE DE PRUEBAS DEBE verificar la generación de un archivo `.xlsx` de exportación —contenido y nombre de archivo— en los exports de líneas, centros de coste y formatos (RF-LIN-EXP-1.4, RF-CC-EXP-1.1, RF-FMT-EXP-1.1).                                      |
| RF-QUAL-1.10 | LA SUITE DE PRUEBAS DEBE verificar a nivel HTTP y E2E que una línea en estado `baja` puede reactivarse cambiando su estado a uno distinto y que vuelve a aparecer en el listado normal con `deleted_at` en `NULL` (RF-LIN-1.6, RF-LIN-1.8).                       |
| RF-QUAL-1.11 | LA SUITE DE PRUEBAS DEBE verificar a nivel HTTP que el cambio de estado masivo con identificadores inexistentes los reporta en `fallidas` sin abortar la operación (RF-LIN-1.7).                                                                                  |
| RF-QUAL-1.12 | LA SUITE DE PRUEBAS DEBE verificar que la importación de centros de coste resuelve `formato_nombre` sin distinguir mayúsculas de minúsculas (Q2 de la sección 6, RF-CC-IMP-1.1).                                                                                  |

#### 5.9.4 Enforcement del umbral de cobertura en CI (CI)

| ID        | Requisito (EARS)                                                                                                                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-CI-1.1 | EL PROCESO DE INTEGRACIÓN CONTINUA DEBE ejecutar la suite de pruebas con el reporte de cobertura habilitado y DEBE fallar el pipeline cuando la cobertura medida no alcance los umbrales de RF-CI-1.2.                                                                                                                                                               |
| RF-CI-1.2 | LOS UMBRALES DE COBERTURA MÍNIMOS DEBEN ser 80% de statements, 80% de lines, 80% de functions y 70% de branches, evaluados de forma **global** (agregado del conjunto medido, no por archivo) y medidos sobre el conjunto `src/**` con las exclusiones vigentes en `vitest.config.ts` (`src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**`). |
| RF-CI-1.3 | EL PROCESO DE INTEGRACIÓN CONTINUA DEBE adjuntar el reporte de cobertura como artefacto del job, para su revisión posterior.                                                                                                                                                                                                                                         |

> **Decisión (Q1) — Alcance de la medición: `src/**`**: se **mantiene** el `include` vigente en `vitest.config.ts`
> (`src/**/*.ts`, excluyendo `src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**` y los archivos
> `*.test.ts` / `*.spec.ts`). La constitución (sección 8) enuncia el umbral para "código de dominio (`src/domain/`,
> `src/application/`)", pero **medir más no contradice** la constitución: la constitución fija el **mínimo** que debe
> cubrirse, y el conjunto medido es un superconjunto. Medir también `src/infrastructure/http` y `src/infrastructure/external`
> es, por tanto, **más estricto** que el mínimo constitucional. No se modifica el `include`.
>
> **Decisión (Q2) — Umbrales globales**: se evalúan de forma **global** (agregado del conjunto medido), que es el
> comportamiento actual de Vitest (`thresholds` sin `perFile`). **No** se activa `perFile: true`, que sería mucho más
> estricto. Los valores son los ya declarados en `vitest.config.ts`: `lines: 80`, `functions: 80`, `branches: 70`,
> `statements: 80`.
>
> **Decisión (Q3) — La SPA queda fuera del umbral**: el umbral **NO aplica** a `presentation/`. No se añade Vitest ni
> infraestructura de tests unitarios a la SPA en este delta; la SPA se cubre con los tests E2E de Playwright, que ya
> ejercitan la interfaz real. Queda registrado como **deuda futura** (dotar a `presentation/` de runner de tests unitarios y
> su propio umbral), fuera del alcance de esta spec.

---

## 6. Preguntas Abiertas — RESUELTAS

| #   | Pregunta                                                                                                                                              | Decisión                                                                         | Impacto                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| Q1  | ¿El campo `proveedor` en Línea Telefónica es texto libre o catálogo referenciado (tabla `proveedores`)?                                               | **Texto libre** (string, no FK)                                                  | Modelo simplificado, importación directa |
| Q2  | ¿Se requiere validar que `centro_coste_codigo` en importación de líneas coincida exactamente (case-sensitive) o case-insensitive?                     | **Case-insensitive** (normalizar a upper/lower en comparación)                   | Importación más tolerante                |
| Q3  | ¿El cambio de estado masivo a 'baja' debe permitir seleccionar líneas ya en 'baja' (idempotente) o fallar para esas?                                  | **Idempotente**: líneas ya en baja se ignoran (no error, no cuentan en fallidas) | RF-LIN-1.7 simplificado                  |
| Q4  | ¿La importación de líneas debe resolver `centro_coste_id` por `codigo` (texto) o también aceptar `centro_coste_id` (UUID) directamente en el archivo? | **Solo `centro_coste_codigo` (texto)**; UUID no se expone en importación         | Archivos más legibles para usuarios      |
| Q5  | ¿El dashboard KPI "Total líneas" cuenta solo `deleted_at IS NULL` o también incluye las de baja?                                                      | **Solo `deleted_at IS NULL`** (líneas no dadas de baja)                          | RF-DASH-1.1 confirmado                   |
| Q6  | ¿Se requiere soporte para números fijos de regiones fuera de Santiago (prefijos 32, 41, 45, 55, 58, 65, 75, etc.)?                                    | **Sí, todos los prefijos fijos chilenos válidos** (ver tabla en 4.3)             | RF-VAL-1.1 extendido                     |
| Q7  | ¿El campo `tipo_uso` (personal/geovictoria) es fijo o se espera que sea extensible en futuro?                                                         | **Extensible vía migración** (check constraint, no enum nativo BD)               | Flexibilidad futura                      |
| Q8  | ¿La UI debe ser SPA (React/Vue/Svelte) o server-rendered (templates Fastify)?                                                                         | **SPA React** (se define en plan)                                                | Arquitectura frontend                    |

---

## 7. Criterios de Aceptación (Resumen)

| Escenario                                                  | Esperado                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Crear formato duplicado                                    | 409 Conflict                                                          |
| Importar centros con formato inexistente                   | 0 insertados, reporte errores por fila                                |
| Importar líneas con 3 duplicados y 2 errores de validación | Insertan N-5, reporte duplicados (3) + errores (2)                    |
| Cambio estado masivo 50 líneas → 48 ok, 2 ya en baja       | 48 actualizadas, 2 ignoradas (idempotente), reporte 0 fallidas        |
| Normalizar "9 1234 5678"                                   | "+56912345678", tipo=movil                                            |
| Normalizar "2 1234 5678"                                   | "+56212345678", tipo=fijo                                             |
| Normalizar "32 1234 5678"                                  | "+563212345678", tipo=fijo                                            |
| Normalizar "1234567"                                       | Error InvalidPhoneNumberError                                         |
| Dashboard KPIs                                             | Cuentan solo líneas no borradas (deleted_at IS NULL)                  |
| Exportar líneas con filtros                                | CSV/Excel con columnas definidas, nombre `lineas_YYYYMMDD_HHMMSS.csv` |
| Exportar centros de coste                                  | CSV/Excel con columnas: codigo, nombre, formato_nombre, created_at    |
| Exportar formatos                                          | CSV/Excel con columnas: nombre, created_at                            |

---

## 8. Decisiones de Diseño Clave (para trazabilidad)

| Decisión                                             | Justificación                                                      | Alternativa descartada                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Proveedor = texto libre                              | Simplica importación; proveedores varían y no hay catálogo maestro | Tabla `proveedores` con FK (añade complejidad innecesaria)           |
| Centro de coste obligatorio en importación           | Regla de negocio: toda línea pertenece a un centro                 | Permitir null y asignar después (rompe integridad)                   |
| Duplicados en importación = no insertan, no bloquean | Idempotencia práctica; usuario re-importa corregido                | Todo-o-nada estricto (bloquea importaciones grandes por 1 duplicado) |
| Exportación en misma spec                            | Caso de uso operativo diario; bajo esfuerzo técnico                | Spec posterior (retrasaba valor inmediato)                           |
| tipo_uso extensible vía check constraint             | Flexibilidad sin migraciones complejas                             | Enum nativo PostgreSQL (requiere ALTER TYPE para añadir valores)     |
| Case-insensitive en codigo centro coste              | Usuarios escriben códigos con mayúsculas/minúsculas mixtas         | Case-sensitive estricto (fuente de errores de importación)           |

---

_Fin de la especificación. **Aprobada** para pasar a fase Plan._

---

## 9. Verificación de la implementación

- **Fecha**: 2026-11-04 (revalidación y cierre: 2026-11-05)
- **Veredicto**: **APROBADO**
- **Resultado**: **81 RF** (56 originales + 25 del delta v1.2) → **81 CUMPLE**, 0 **PARCIAL**, 0 **NO CUMPLE**, 0 no
  verificables, sin hallazgos bloqueantes.
- **Los 2 requisitos que estaban en PARCIAL se han cerrado**:
  - **RF-LIN-1.9** — el listado de líneas admite las **9 columnas ordenables** del conjunto cerrado de RF-ORD-1.2
    (`empleado` excluido por decisión Q4) y la paginación por cursor es coherente con la columna de orden.
  - **RF-FMT-1.3** — `GET /api/v1/formatos` devuelve los formatos ordenados por `nombre` ascendente, con el cursor
    viajando sobre `nombre`.
- **Cierre**: la corrección posterior a la revisión (`If-Match` en los `DELETE`, parseo estricto de la cabecera y
  los 2 tests que faltaban) está registrada en la sección «Delta v1.2 completado — Cierre de deuda técnica
  (2026-11-05)» de `MEMORY.md`.

Informe completo: [`validation.md`](./validation.md)

### 9.1 Delta v1.1/v1.2 — Cierre de deuda técnica (2026-11-05)

- **Motivo**: el usuario aprobó cerrar la deuda técnica que la validación dejó abierta, como tareas dentro de esta misma
  spec (no como spec nueva).
- **Alcance**: (a) orden del listado de formatos, (b) ordenamiento del listado de líneas, (c) 13 ramas sin cobertura de
  tests y (d) enforcement del umbral de cobertura en CI.
- **Naturaleza del delta**: **no cambia comportamiento implementado**. Los puntos (a) y (b) ya estaban exigidos por la spec
  (RF-FMT-1.3 y RF-LIN-1.9): son **trabajo de cumplimiento**, y aquí solo se **precisa** su alcance. Los puntos (c) y (d)
  sí exigían **redacción nueva**: se añaden la capability 5.9 (CIERRE), dos RF de validación (RF-VAL-1.4, RF-VAL-1.5) y
  los requisitos de cobertura (RF-QUAL-\*) y de CI (RF-CI-\*).
- **v1.1 → v1.2**: incorpora las **5 decisiones** que el usuario tomó sobre las preguntas abiertas del delta
  (alcance y granularidad de la cobertura en CI, exclusión de la SPA, `empleado` no ordenable y confirmación de la
  resolución de `"5612345678"`). v1.2 **no añade ni elimina requisitos**: solo concreta los ya redactados. Detalle en la
  sección 10.
- **Conteo**: 56 RF originales (sin cambios) + 5 RF de ordenamiento (ORD) + 3 RF de bloqueo optimista (OPT) + 12 RF de
  cobertura (QUAL) + 3 RF de CI (CI) + 2 RF de validación (VAL) = **81 RF**.
- **Pendiente**: ninguno. **No quedan preguntas abiertas ni bloqueantes**; la spec puede pasar a la fase Plan.

---

## 10. Decisiones tomadas en el delta v1.1/v1.2 (2026-11-05)

> **Estado**: **no quedan preguntas abiertas ni bloqueantes.** Las 5 preguntas que el delta v1.1 abrió fueron resueltas por
> el usuario el 2026-11-05 y están incorporadas en la v1.2 de la spec. La spec puede pasar a la fase **Plan**.

| #   | Pregunta                                                                         | Decisión                                                                                                                                                                                                     | Impacto                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | ¿Cuál es el conjunto de archivos que debe medir el umbral de cobertura?          | **Mantener `src/**`** con las exclusiones vigentes en `vitest.config.ts` (`src/app.ts`, `src/config/**`, `src/infrastructure/database/**`, `tests/**`, `*.test.ts`, `*.spec.ts`). No se cambia el `include`. | Fija RF-CI-1.2. Medir un superconjunto del mínimo de la constitución §8 es **más estricto**, no contradictorio. El pipeline puede quedar en rojo si algún archivo nuevo no llega al mínimo.        |
| Q2  | ¿Los umbrales se evalúan de forma global o por archivo?                          | **Globales** (agregado del conjunto medido). **No** se activa `perFile: true`.                                                                                                                               | Fija RF-CI-1.2. Valores: `lines: 80`, `functions: 80`, `branches: 70`, `statements: 80` (los ya declarados en `vitest.config.ts`).                                                                 |
| Q3  | ¿El umbral de cobertura aplica también a la SPA `presentation/`?                 | **No aplica.** No se añade Vitest a la SPA en este delta.                                                                                                                                                    | La SPA se cubre con los tests E2E de Playwright. Queda registrada como **deuda futura** (dotar a `presentation/` de runner de tests unitarios y su propio umbral), fuera del alcance de esta spec. |
| Q4  | ¿`empleado` (columna nullable) forma parte del conjunto de columnas ordenables?  | **No.** Se **excluye** del conjunto de RF-ORD-1.2.                                                                                                                                                           | Fija RF-ORD-1.2 (9 columnas, todas `NOT NULL`) y RF-ORD-1.5. `empleado` **sigue siendo** columna visible y filtro de texto. Evita el borde de la comparación _keyset_ con `NULL`.                  |
| Q5  | ¿Se confirma la resolución de `"5612345678"` (10 dígitos que empiezan por `56`)? | **Sí: se confirma el comportamiento actual** → `+565612345678`, tipo `fijo` (fijo regional, área 56).                                                                                                        | Fija RF-VAL-1.5. `normalizePhone()` **no se modifica**; solo se añade el test que fija esta resolución (RF-QUAL-1.5). No requiere cambios en la tabla 4.3.                                         |

> **Consecuencias de estas decisiones sobre los RFs**: RF-ORD-1.2 y RF-ORD-1.5 (conjunto de 9 columnas y exclusión de
> `empleado`), RF-CI-1.1, RF-CI-1.2 y RF-CI-1.3 (alcance `src/**`, umbrales globales 80/80/80/70, SPA fuera) y RF-VAL-1.5
> (resolución confirmada). Ninguna decisión altera el comportamiento ya implementado.

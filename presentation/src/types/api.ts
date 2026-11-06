/** Tipos de la API de TELEFONO 2 (respuestas en `snake_case`). */

/** Respuesta paginada por cursor. */
export interface Pagina<T> {
  readonly items: T[];
  readonly next_cursor: string | null;
  readonly has_next_page: boolean;
}

/** Formato de centro de coste. */
export interface Formato {
  readonly id: string;
  readonly nombre: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Centro de coste. */
export interface CentroCoste {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly formato_id: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Línea telefónica. */
export interface Linea {
  readonly id: string;
  readonly numero: string;
  readonly numero_original: string;
  readonly proveedor: string;
  readonly centro_coste_id: string;
  readonly centro_coste_codigo?: string;
  readonly centro_coste_nombre?: string;
  readonly fecha_asignacion: string;
  readonly costo_mensual: string;
  readonly tipo_linea: string;
  readonly empleado: string | null;
  readonly estado: string;
  readonly tipo_uso: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

/** KPIs del panel principal. */
export interface Kpis {
  readonly total_lineas: number;
  readonly lineas_activas: number;
  readonly count_personal: number;
  readonly count_geovictoria: number;
}

/** Estados posibles de una línea. */
export type EstadoLinea = 'activa' | 'baja' | 'pendiente' | 'portabilidad';

/** Tipos de uso de una línea. */
export type TipoUso = 'personal' | 'geovictoria';

/** Tipos de línea telefónica. */
export type TipoLinea = 'movil' | 'fijo';

/**
 * Columnas por las que la UI de líneas ofrece ordenamiento (`RF-ORD-1.5`).
 *
 * Es un **subconjunto** del conjunto que admite la API: la tabla no muestra
 * `created_at` (que sí es ordenable en la API) y `empleado` no es ordenable en
 * ninguno de los dos lados, porque admite `NULL` y rompería la comparación
 * *keyset* del cursor (decisión Q4 de la spec).
 */
export type ColumnaOrdenLinea =
  | 'numero'
  | 'proveedor'
  | 'centro_coste_codigo'
  | 'fecha_asignacion'
  | 'costo_mensual'
  | 'tipo_linea'
  | 'estado'
  | 'tipo_uso';

/** Detalle de error de validación (RFC 7807). */
export interface DetalleError {
  readonly path?: string;
  readonly message?: string;
  readonly [clave: string]: unknown;
}

/** Problema HTTP (RFC 7807). */
export interface ProblemaHttp {
  readonly type?: string;
  readonly title?: string;
  readonly status?: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly errors?: DetalleError[];
}

/** Error de la importación de centros de coste. */
export interface ErrorImportacionCentro {
  readonly fila: number;
  readonly codigo: string;
  readonly motivo: string;
}

/** Error de la importación de líneas. */
export interface ErrorImportacionLinea {
  readonly fila: number;
  readonly numero: string;
  readonly motivo: string;
}

/** Duplicado detectado en la importación de líneas. */
export interface DuplicadoImportacionLinea {
  readonly fila: number;
  readonly numero: string;
  readonly motivo: string;
}

/** Reporte de importación de centros de coste. */
export interface ReporteImportacionCentros {
  readonly insertados: number;
  readonly duplicados: number;
  readonly errores: ErrorImportacionCentro[];
  /** Formatos creados durante la importación (vacío si no se creó ninguno). */
  readonly formatos_creados?: string[];
}

/** Reporte de importación de líneas. */
export interface ReporteImportacionLineas {
  readonly insertados: number;
  readonly duplicados: DuplicadoImportacionLinea[];
  readonly errores: ErrorImportacionLinea[];
}

/** Resultado del cambio de estado masivo. */
export interface ResultadoCambioEstadoMasivo {
  readonly actualizadas: number;
  readonly ignoradas: number;
  readonly fallidas: number;
}

/**
 * Filtros del listado de líneas (12 filtros del RF-LIN-1.9).
 *
 * El centro de coste se filtra por `centro_coste_id`: el buscador acepta el
 * código o el nombre del centro de coste y fija su id.
 *
 * El modo "todos los centros que coincidan" del buscador usa en cambio
 * `centro_coste_busqueda` (texto libre por código **o** nombre). Los dos modos
 * son excluyentes: la UI nunca envía ambos a la vez.
 */
export interface FiltrosLineas {
  readonly numero?: string;
  readonly proveedor?: string;
  readonly centro_coste_id?: string;
  readonly centro_coste_busqueda?: string;
  readonly fecha_asignacion?: string;
  readonly fecha_desde?: string;
  readonly fecha_hasta?: string;
  readonly costo_min?: number;
  readonly costo_max?: number;
  readonly tipo_linea?: string;
  readonly empleado?: string;
  readonly estado?: string;
  readonly tipo_uso?: string;
  /** Columna de ordenamiento (subconjunto que ofrece la UI, `RF-ORD-1.5`). */
  readonly sort?: ColumnaOrdenLinea;
  /** Dirección del ordenamiento. */
  readonly order?: 'asc' | 'desc';
  readonly after_id?: string;
  readonly limit?: number;
}

/** Datos de alta o edición de una línea (snake_case, campos opcionales). */
export interface DatosLinea {
  readonly numero?: string;
  readonly numero_original?: string;
  readonly proveedor?: string;
  readonly centro_coste_id?: string;
  readonly fecha_asignacion?: string;
  readonly costo_mensual?: string;
  readonly tipo_linea?: string;
  readonly empleado?: string | null;
  readonly estado?: string;
  readonly tipo_uso?: string;
}

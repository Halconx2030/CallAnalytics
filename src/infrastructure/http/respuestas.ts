import type { CentroCosteDto } from '@application/dto/centro-coste.dto.js';
import type { KpisDto } from '@application/dto/dashboard.dto.js';
import type { FormatoDto } from '@application/dto/formato.dto.js';
import type {
  ErrorImportacionCentroDto,
  ReporteImportacionCentrosDto,
} from '@application/dto/import.dto.js';
import type { LineaDto } from '@application/dto/linea.dto.js';
import type { PaginaCursor } from '@application/ports/repositories/paginacion.js';

/**
 * Conversión de los DTOs de la capa de aplicación a las respuestas HTTP.
 *
 * La API expone `snake_case` (igual que los archivos de importación), mientras que la capa
 * de aplicación trabaja con `camelCase`.
 */

/** Respuesta de un formato. */
export interface FormatoResponse {
  readonly id: string;
  readonly nombre: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Respuesta de un centro de coste. */
export interface CentroCosteResponse {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly formato_id: string;
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}

/** Respuesta de una línea telefónica. */
export interface LineaResponse {
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

/** Respuesta de los KPIs del panel. */
export interface KpisResponse {
  readonly total_lineas: number;
  readonly lineas_activas: number;
  readonly count_personal: number;
  readonly count_geovictoria: number;
}

/** Respuesta del reporte de importación de centros de coste. */
export interface ReporteImportacionCentrosResponse {
  readonly insertados: number;
  readonly duplicados: number;
  readonly errores: ErrorImportacionCentroDto[];
  /** Formatos creados durante la importación (vacío si no se creó ninguno). */
  readonly formatos_creados: string[];
}

/** Respuesta paginada genérica. */
export interface PaginaResponse<T> {
  readonly items: T[];
  readonly next_cursor: string | null;
  readonly has_next_page: boolean;
}

/** Convierte un DTO de formato a la respuesta HTTP. */
export function toFormatoResponse(dto: FormatoDto): FormatoResponse {
  return {
    id: dto.id,
    nombre: dto.nombre,
    version: dto.version,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

/** Convierte un DTO de centro de coste a la respuesta HTTP. */
export function toCentroCosteResponse(dto: CentroCosteDto): CentroCosteResponse {
  return {
    id: dto.id,
    codigo: dto.codigo,
    nombre: dto.nombre,
    formato_id: dto.formatoId,
    version: dto.version,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
  };
}

/** Convierte un DTO de línea a la respuesta HTTP. */
export function toLineaResponse(dto: LineaDto): LineaResponse {
  return {
    id: dto.id,
    numero: dto.numero,
    numero_original: dto.numeroOriginal,
    proveedor: dto.proveedor,
    centro_coste_id: dto.centroCosteId,
    ...(dto.centroCosteCodigo === undefined ? {} : { centro_coste_codigo: dto.centroCosteCodigo }),
    ...(dto.centroCosteNombre === undefined ? {} : { centro_coste_nombre: dto.centroCosteNombre }),
    fecha_asignacion: dto.fechaAsignacion,
    costo_mensual: dto.costoMensual,
    tipo_linea: dto.tipoLinea,
    empleado: dto.empleado,
    estado: dto.estado,
    tipo_uso: dto.tipoUso,
    version: dto.version,
    created_at: dto.createdAt,
    updated_at: dto.updatedAt,
    deleted_at: dto.deletedAt,
  };
}

/** Convierte el DTO de KPIs a la respuesta HTTP. */
export function toKpisResponse(dto: KpisDto): KpisResponse {
  return {
    total_lineas: dto.totalLineas,
    lineas_activas: dto.lineasActivas,
    count_personal: dto.countPersonal,
    count_geovictoria: dto.countGeovictoria,
  };
}

/** Convierte una página del servicio a la respuesta paginada HTTP. */
export function toPaginaResponse<T, R>(
  pagina: PaginaCursor<T>,
  mapper: (item: T) => R
): PaginaResponse<R> {
  return {
    items: pagina.items.map((item) => mapper(item)),
    next_cursor: pagina.nextCursor,
    has_next_page: pagina.hasNextPage,
  };
}

/** Convierte el reporte de importación de centros de coste a la respuesta HTTP. */
export function toReporteImportacionCentrosResponse(
  dto: ReporteImportacionCentrosDto
): ReporteImportacionCentrosResponse {
  return {
    insertados: dto.insertados,
    duplicados: dto.duplicados,
    errores: dto.errores,
    formatos_creados: dto.formatosCreados ?? [],
  };
}

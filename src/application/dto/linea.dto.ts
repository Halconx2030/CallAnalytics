import type { EstadoLinea, LineaTelefonica, TipoUso } from '@domain/entities/LineaTelefonica.js';
import type { TipoLinea } from '@domain/value-objects/PhoneNumber.js';

/** Entrada para crear una línea telefónica (RF-LIN-1.1). */
export interface CrearLineaDto {
  /** Número tal como lo ingresa el usuario; se normaliza a E.164 chileno. */
  readonly numero: string;
  /** Número original tal como venía en el archivo (opcional). */
  readonly numeroOriginal?: string | undefined;
  /** Proveedor (texto libre). */
  readonly proveedor?: string | undefined;
  /** Id del centro de coste al que se asigna la línea. */
  readonly centroCosteId: string;
  /** Fecha de asignación `YYYY-MM-DD`; por defecto, hoy. */
  readonly fechaAsignacion?: string | undefined;
  /** Costo mensual (decimal ≥ 0); por defecto, 0. */
  readonly costoMensual?: number | string | undefined;
  /** Tipo de línea; por defecto se infiere del número. */
  readonly tipoLinea?: TipoLinea | undefined;
  /** Empleado asignado (opcional). */
  readonly empleado?: string | null | undefined;
  /** Estado; por defecto `pendiente`. */
  readonly estado?: EstadoLinea | undefined;
  /** Tipo de uso; por defecto `personal`. */
  readonly tipoUso?: TipoUso | undefined;
}

/**
 * Entrada para actualizar una línea.
 *
 * `numero` e `id` son inmutables (RF-LIN-1.5) y por eso no aparecen aquí.
 */
export interface ActualizarLineaDto {
  readonly numeroOriginal?: string | undefined;
  readonly proveedor?: string | undefined;
  readonly centroCosteId?: string | undefined;
  readonly fechaAsignacion?: string | undefined;
  readonly costoMensual?: number | string | undefined;
  readonly tipoLinea?: TipoLinea | undefined;
  readonly empleado?: string | null | undefined;
  readonly estado?: EstadoLinea | undefined;
  readonly tipoUso?: TipoUso | undefined;
}

/** Salida de una línea telefónica. */
export interface LineaDto {
  readonly id: string;
  readonly numero: string;
  readonly numeroOriginal: string;
  readonly proveedor: string;
  readonly centroCosteId: string;
  /** Código del centro de coste (presente en listados y exportaciones). */
  readonly centroCosteCodigo?: string | undefined;
  /** Nombre del centro de coste (presente en listados y exportaciones). */
  readonly centroCosteNombre?: string | undefined;
  readonly fechaAsignacion: string;
  /** Costo mensual con dos decimales (ej. "1234.50"). */
  readonly costoMensual: string;
  readonly tipoLinea: TipoLinea;
  readonly empleado: string | null;
  readonly estado: EstadoLinea;
  readonly tipoUso: TipoUso;
  readonly version: number;
  /** Fecha de creación en ISO 8601. */
  readonly createdAt: string;
  /** Fecha de última actualización en ISO 8601. */
  readonly updatedAt: string;
  /** Fecha de baja lógica en ISO 8601, o `null` si la línea sigue vigente. */
  readonly deletedAt: string | null;
}

/** Fila de exportación de líneas (RF-LIN-EXP-1.2). */
export interface LineaExportDto {
  readonly numero: string;
  readonly numeroOriginal: string;
  readonly proveedor: string;
  readonly centroCosteCodigo: string;
  readonly centroCosteNombre: string;
  readonly fechaAsignacion: string;
  readonly costoMensual: string;
  readonly tipoLinea: string;
  readonly empleado: string | null;
  readonly estado: string;
  readonly tipoUso: string;
  /** Fecha de creación en ISO 8601. */
  readonly createdAt: string;
}

/** Resultado de un cambio de estado masivo (RF-LIN-1.7). */
export interface ResultadoCambioEstadoMasivoDto {
  /** Líneas que quedaron en el estado pedido. */
  readonly actualizadas: number;
  /** Líneas que ya estaban en ese estado (operación idempotente). */
  readonly ignoradas: number;
  /** Ids que no existen en la base de datos. */
  readonly fallidas: number;
}

/** Convierte la entidad de dominio en el DTO de salida. */
export function toLineaDto(
  linea: LineaTelefonica,
  centroCoste?: { codigo: string; nombre: string }
): LineaDto {
  return {
    id: linea.id ?? '',
    numero: linea.numero,
    numeroOriginal: linea.numeroOriginal,
    proveedor: linea.proveedor,
    centroCosteId: linea.centroCosteId,
    centroCosteCodigo: centroCoste?.codigo,
    centroCosteNombre: centroCoste?.nombre,
    fechaAsignacion: linea.fechaAsignacion,
    costoMensual: linea.costoMensual.aString(),
    tipoLinea: linea.tipoLinea,
    empleado: linea.empleado,
    estado: linea.estado,
    tipoUso: linea.tipoUso,
    version: linea.version,
    createdAt: linea.createdAt.toISOString(),
    updatedAt: linea.updatedAt.toISOString(),
    deletedAt: linea.deletedAt === null ? null : linea.deletedAt.toISOString(),
  };
}

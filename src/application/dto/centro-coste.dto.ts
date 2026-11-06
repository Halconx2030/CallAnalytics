import type { CentroCoste } from '@domain/entities/CentroCoste.js';

/** Entrada para crear un centro de coste (RF-CC-1.1). */
export interface CrearCentroCosteDto {
  /** Código único del centro de coste. */
  readonly codigo: string;
  /** Nombre descriptivo del centro de coste. */
  readonly nombre: string;
  /** Id del formato al que pertenece. */
  readonly formatoId: string;
}

/**
 * Entrada para actualizar un centro de coste.
 *
 * `codigo` es inmutable (RF-CC-1.4) y por eso no aparece aquí.
 */
export interface ActualizarCentroCosteDto {
  /** Nuevo nombre (opcional). */
  readonly nombre?: string | undefined;
  /** Nuevo formato asociado (opcional). */
  readonly formatoId?: string | undefined;
}

/** Salida de un centro de coste. */
export interface CentroCosteDto {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly formatoId: string;
  readonly version: number;
  /** Fecha de creación en ISO 8601. */
  readonly createdAt: string;
  /** Fecha de última actualización en ISO 8601. */
  readonly updatedAt: string;
}

/** Fila de exportación de centros de coste (RF-CC-EXP-1.1). */
export interface CentroCosteExportDto {
  readonly codigo: string;
  readonly nombre: string;
  /** Nombre del formato asociado. */
  readonly formatoNombre: string;
  /** Fecha de creación en ISO 8601. */
  readonly createdAt: string;
}

/** Convierte la entidad de dominio en el DTO de salida. */
export function toCentroCosteDto(centro: CentroCoste): CentroCosteDto {
  return {
    id: centro.id ?? '',
    codigo: centro.codigo,
    nombre: centro.nombre,
    formatoId: centro.formatoId,
    version: centro.version,
    createdAt: centro.createdAt.toISOString(),
    updatedAt: centro.updatedAt.toISOString(),
  };
}

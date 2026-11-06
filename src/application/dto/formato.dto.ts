import type { Formato } from '@domain/entities/Formato.js';

/** Entrada para crear un formato (RF-FMT-1.1). */
export interface CrearFormatoDto {
  /** Nombre único del formato (ej. "SMU", "FALABELLA"). */
  readonly nombre: string;
}

/** Entrada para actualizar un formato. */
export interface ActualizarFormatoDto {
  /** Nuevo nombre del formato. */
  readonly nombre: string;
}

/** Salida de un formato. */
export interface FormatoDto {
  readonly id: string;
  readonly nombre: string;
  readonly version: number;
  /** Fecha de creación en ISO 8601. */
  readonly createdAt: string;
  /** Fecha de última actualización en ISO 8601. */
  readonly updatedAt: string;
}

/** Convierte la entidad de dominio en el DTO de salida. */
export function toFormatoDto(formato: Formato): FormatoDto {
  return {
    id: formato.id ?? '',
    nombre: formato.nombre,
    version: formato.version,
    createdAt: formato.createdAt.toISOString(),
    updatedAt: formato.updatedAt.toISOString(),
  };
}

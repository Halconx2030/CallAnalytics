import { eq, or, sql, type SQL } from 'drizzle-orm';

import type { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';

import type {
  ColumnaOrdenLinea,
  FiltrosLinea,
} from '@application/ports/repositories/LineaRepository.js';

import * as schema from '../schema/index.js';

import { ilikeSeguro } from './cursor.js';

/** Fila proyectada de la consulta de líneas (con datos del centro de coste). */
export interface FilaLinea {
  id: string;
  numero: string;
  numeroOriginal: string;
  proveedor: string;
  centroCosteId: string;
  centroCosteCodigo: string;
  centroCosteNombre: string;
  fechaAsignacion: string;
  costoMensual: string;
  tipoLinea: string;
  empleado: string | null;
  estado: string;
  tipoUso: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Proyección compartida por el listado y la exportación. */
export const proyeccionLinea = {
  id: schema.lineasTelefonicas.id,
  numero: schema.lineasTelefonicas.numero,
  numeroOriginal: schema.lineasTelefonicas.numeroOriginal,
  proveedor: schema.lineasTelefonicas.proveedor,
  centroCosteId: schema.lineasTelefonicas.centroCosteId,
  centroCosteCodigo: schema.centrosCoste.codigo,
  centroCosteNombre: schema.centrosCoste.nombre,
  fechaAsignacion: schema.lineasTelefonicas.fechaAsignacion,
  costoMensual: schema.lineasTelefonicas.costoMensual,
  tipoLinea: schema.lineasTelefonicas.tipoLinea,
  empleado: schema.lineasTelefonicas.empleado,
  estado: schema.lineasTelefonicas.estado,
  tipoUso: schema.lineasTelefonicas.tipoUso,
  version: schema.lineasTelefonicas.version,
  createdAt: schema.lineasTelefonicas.createdAt,
  updatedAt: schema.lineasTelefonicas.updatedAt,
  deletedAt: schema.lineasTelefonicas.deletedAt,
};

/** Columnas por las que se puede ordenar, con su tipo SQL para el cast del cursor. */
export const COLUMNAS_ORDEN: Record<ColumnaOrdenLinea, { expresion: SQL; tipo: string }> = {
  numero: { expresion: sql`${schema.lineasTelefonicas.numero}`, tipo: 'text' },
  proveedor: { expresion: sql`${schema.lineasTelefonicas.proveedor}`, tipo: 'text' },
  centro_coste_codigo: { expresion: sql`${schema.centrosCoste.codigo}`, tipo: 'text' },
  fecha_asignacion: {
    expresion: sql`${schema.lineasTelefonicas.fechaAsignacion}`,
    tipo: 'date',
  },
  costo_mensual: { expresion: sql`${schema.lineasTelefonicas.costoMensual}`, tipo: 'numeric' },
  tipo_linea: { expresion: sql`${schema.lineasTelefonicas.tipoLinea}`, tipo: 'text' },
  estado: { expresion: sql`${schema.lineasTelefonicas.estado}`, tipo: 'text' },
  tipo_uso: { expresion: sql`${schema.lineasTelefonicas.tipoUso}`, tipo: 'text' },
  created_at: { expresion: sql`${schema.lineasTelefonicas.createdAt}`, tipo: 'timestamptz' },
};

/** Valores de inserción derivados de la entidad. */
export function valoresInsercionLinea(linea: LineaTelefonica) {
  return {
    numero: linea.numero,
    numeroOriginal: linea.numeroOriginal,
    proveedor: linea.proveedor,
    centroCosteId: linea.centroCosteId,
    fechaAsignacion: linea.fechaAsignacion,
    costoMensual: linea.costoMensual.aString(),
    tipoLinea: linea.tipoLinea,
    empleado: linea.empleado,
    estado: linea.estado,
    tipoUso: linea.tipoUso,
    deletedAt: linea.deletedAt,
    createdAt: linea.createdAt,
    updatedAt: linea.updatedAt,
  };
}

/** Valor de la columna de ordenamiento que se guarda en el cursor. */
export function valorCursorLinea(columna: ColumnaOrdenLinea, fila: FilaLinea): string {
  switch (columna) {
    case 'numero':
      return fila.numero;
    case 'proveedor':
      return fila.proveedor;
    case 'centro_coste_codigo':
      return fila.centroCosteCodigo;
    case 'fecha_asignacion':
      return fila.fechaAsignacion;
    case 'costo_mensual':
      return String(fila.costoMensual);
    case 'tipo_linea':
      return fila.tipoLinea;
    case 'estado':
      return fila.estado;
    case 'tipo_uso':
      return fila.tipoUso;
    case 'created_at':
      return fila.createdAt.toISOString();
  }
}

/** Traduce los 14 filtros de la spec a condiciones SQL combinadas. */
export function construirCondicionesFiltroLinea(filtros: FiltrosLinea): SQL[] {
  return [
    ...condicionesFiltroTexto(filtros),
    ...condicionesFiltroCentroCoste(filtros),
    ...condicionesFiltroRango(filtros),
    ...condicionesFiltroCatalogo(filtros),
  ];
}

/** Filtros de coincidencia parcial sobre atributos propios de la línea. */
function condicionesFiltroTexto(filtros: FiltrosLinea): SQL[] {
  const condiciones: SQL[] = [];

  if (filtros.numero !== undefined) {
    condiciones.push(ilikeSeguro(sql`${schema.lineasTelefonicas.numero}`, filtros.numero));
  }
  if (filtros.proveedor !== undefined) {
    condiciones.push(ilikeSeguro(sql`${schema.lineasTelefonicas.proveedor}`, filtros.proveedor));
  }
  if (filtros.empleado !== undefined) {
    condiciones.push(ilikeSeguro(sql`${schema.lineasTelefonicas.empleado}`, filtros.empleado));
  }

  return condiciones;
}

/** Filtros asociados al centro de coste (id exacto, código, nombre o búsqueda libre OR). */
function condicionesFiltroCentroCoste(filtros: FiltrosLinea): SQL[] {
  const condiciones: SQL[] = [];

  if (filtros.centroCosteId !== undefined) {
    condiciones.push(eq(schema.lineasTelefonicas.centroCosteId, filtros.centroCosteId));
  }
  if (filtros.centroCosteCodigo !== undefined) {
    condiciones.push(ilikeSeguro(sql`${schema.centrosCoste.codigo}`, filtros.centroCosteCodigo));
  }
  if (filtros.centroCosteNombre !== undefined) {
    condiciones.push(ilikeSeguro(sql`${schema.centrosCoste.nombre}`, filtros.centroCosteNombre));
  }
  if (filtros.centroCosteBusqueda !== undefined) {
    const condicion = condicionBusquedaCentroCoste(filtros.centroCosteBusqueda);
    if (condicion !== undefined) {
      condiciones.push(condicion);
    }
  }

  return condiciones;
}

/** Filtros de fecha de asignación y rango de costo mensual. */
function condicionesFiltroRango(filtros: FiltrosLinea): SQL[] {
  const condiciones: SQL[] = [];

  if (filtros.fechaAsignacion !== undefined) {
    condiciones.push(eq(schema.lineasTelefonicas.fechaAsignacion, filtros.fechaAsignacion));
  }
  if (filtros.fechaDesde !== undefined) {
    condiciones.push(
      sql`${schema.lineasTelefonicas.fechaAsignacion} >= ${filtros.fechaDesde}::date`
    );
  }
  if (filtros.fechaHasta !== undefined) {
    condiciones.push(
      sql`${schema.lineasTelefonicas.fechaAsignacion} <= ${filtros.fechaHasta}::date`
    );
  }
  if (filtros.costoMin !== undefined) {
    condiciones.push(sql`${schema.lineasTelefonicas.costoMensual} >= ${filtros.costoMin}::numeric`);
  }
  if (filtros.costoMax !== undefined) {
    condiciones.push(sql`${schema.lineasTelefonicas.costoMensual} <= ${filtros.costoMax}::numeric`);
  }

  return condiciones;
}

/** Filtros de igualdad sobre enumeraciones de línea. */
function condicionesFiltroCatalogo(filtros: FiltrosLinea): SQL[] {
  const condiciones: SQL[] = [];

  if (filtros.tipoLinea !== undefined) {
    condiciones.push(eq(schema.lineasTelefonicas.tipoLinea, filtros.tipoLinea));
  }
  if (filtros.estado !== undefined) {
    condiciones.push(eq(schema.lineasTelefonicas.estado, filtros.estado));
  }
  if (filtros.tipoUso !== undefined) {
    condiciones.push(eq(schema.lineasTelefonicas.tipoUso, filtros.tipoUso));
  }

  return condiciones;
}

/** Condición de búsqueda libre del centro de coste (código o nombre case-insensitive). */
function condicionBusquedaCentroCoste(busqueda: string): SQL | undefined {
  const texto = busqueda.trim();

  if (texto === '') {
    return undefined;
  }

  return or(
    ilikeSeguro(sql`lower(${schema.centrosCoste.codigo})`, texto),
    ilikeSeguro(sql`lower(${schema.centrosCoste.nombre})`, texto)
  );
}

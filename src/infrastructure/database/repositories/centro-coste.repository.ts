import { and, count, eq, inArray, or, sql, type SQL } from 'drizzle-orm';

import { CentroCoste } from '@domain/entities/CentroCoste.js';

import type {
  CentroCosteConFormato,
  CentroCosteRepository,
  FiltrosCentroCoste,
  OpcionesListadoCentroCoste,
} from '@application/ports/repositories/CentroCosteRepository.js';
import type { PaginaCursor } from '@application/ports/repositories/paginacion.js';
import { normalizarLimit } from '@application/ports/repositories/paginacion.js';

import * as schema from '../schema/index.js';

import {
  codificarCursor,
  decodificarCursor,
  ilikeSeguro,
  ordenKeyset,
  predicadoKeyset,
} from './cursor.js';
import { mapearErrorPostgres } from './errors.js';

import type { FuenteDrizzle } from './tipos.js';

/**
 * Implementación Drizzle del puerto {@link CentroCosteRepository}.
 *
 * Acepta la conexión directa o una transacción en curso (unidad de trabajo), de modo que
 * `crearMany` participe de la transacción abierta por el llamador.
 */
export class DrizzleCentroCosteRepository implements CentroCosteRepository {
  constructor(private readonly db: FuenteDrizzle) {}

  async crear(centroCoste: CentroCoste): Promise<CentroCoste> {
    try {
      const filas = await this.db
        .insert(schema.centrosCoste)
        .values({
          codigo: centroCoste.codigo,
          nombre: centroCoste.nombre,
          formatoId: centroCoste.formatoId,
          createdAt: centroCoste.createdAt,
          updatedAt: centroCoste.updatedAt,
        })
        .returning();

      const fila = filas[0];

      if (fila === undefined) {
        throw new Error('No se pudo insertar el centro de coste.');
      }

      return CentroCoste.reconstituirCentroCoste(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async buscarPorId(id: string): Promise<CentroCoste | null> {
    const filas = await this.db
      .select()
      .from(schema.centrosCoste)
      .where(eq(schema.centrosCoste.id, id))
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : CentroCoste.reconstituirCentroCoste(fila);
  }

  async buscarPorCodigo(codigo: string): Promise<CentroCoste | null> {
    const filas = await this.db
      .select()
      .from(schema.centrosCoste)
      .where(sql`lower(${schema.centrosCoste.codigo}) = lower(${codigo})`)
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : CentroCoste.reconstituirCentroCoste(fila);
  }

  async buscarPorCodigos(codigos: string[]): Promise<CentroCoste[]> {
    if (codigos.length === 0) {
      return [];
    }

    const unicos = [...new Set(codigos.map((codigo) => codigo.trim().toLowerCase()))].filter(
      (codigo) => codigo !== ''
    );

    if (unicos.length === 0) {
      return [];
    }

    const filas = await this.db
      .select()
      .from(schema.centrosCoste)
      .where(inArray(sql`lower(${schema.centrosCoste.codigo})`, unicos));

    return filas.map((fila) => CentroCoste.reconstituirCentroCoste(fila));
  }

  async crearMuchos(centrosCoste: CentroCoste[]): Promise<CentroCoste[]> {
    if (centrosCoste.length === 0) {
      return [];
    }

    try {
      return await this.db.transaction(async (tx) => {
        const filas = await tx
          .insert(schema.centrosCoste)
          .values(
            centrosCoste.map((centro) => ({
              codigo: centro.codigo,
              nombre: centro.nombre,
              formatoId: centro.formatoId,
              createdAt: centro.createdAt,
              updatedAt: centro.updatedAt,
            }))
          )
          .returning();

        return filas.map((fila) => CentroCoste.reconstituirCentroCoste(fila));
      });
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async listar(opciones: OpcionesListadoCentroCoste): Promise<PaginaCursor<CentroCoste>> {
    const limit = normalizarLimit(opciones.limit);
    const condicionesFiltros: SQL[] = [];

    if (opciones.codigo !== undefined) {
      condicionesFiltros.push(ilikeSeguro(sql`${schema.centrosCoste.codigo}`, opciones.codigo));
    }
    if (opciones.nombre !== undefined) {
      condicionesFiltros.push(ilikeSeguro(sql`${schema.centrosCoste.nombre}`, opciones.nombre));
    }
    if (opciones.formatoId !== undefined) {
      condicionesFiltros.push(eq(schema.centrosCoste.formatoId, opciones.formatoId));
    }
    if (opciones.busqueda !== undefined) {
      const condicion = this.condicionBusqueda(opciones.busqueda);

      if (condicion !== undefined) {
        condicionesFiltros.push(condicion);
      }
    }

    const condiciones: SQL[] = [...condicionesFiltros];

    if (opciones.afterId !== undefined) {
      const cursor = decodificarCursor(opciones.afterId, 'created_at');
      condiciones.push(
        predicadoKeyset(
          sql`${schema.centrosCoste.createdAt}`,
          sql`${schema.centrosCoste.id}`,
          'timestamptz',
          cursor.v,
          cursor.id,
          false
        )
      );
    }

    const filas = await this.db
      .select()
      .from(schema.centrosCoste)
      .where(and(...condiciones))
      .orderBy(
        ordenKeyset(sql`${schema.centrosCoste.createdAt}`, sql`${schema.centrosCoste.id}`, false)
      )
      .limit(limit + 1);

    const filasCount = await this.db
      .select({ count: count() })
      .from(schema.centrosCoste)
      .where(and(...condicionesFiltros));

    const totalCountRaw = filasCount[0]?.count;

    const totalCount =
      typeof totalCountRaw === 'string' ? parseInt(totalCountRaw, 10) : totalCountRaw ?? 0;

    const hasNextPage = filas.length > limit;
    const items = filas.slice(0, limit).map((fila) => CentroCoste.reconstituirCentroCoste(fila));
    const ultima = filas[limit - 1];
    const nextCursor =
      hasNextPage && ultima !== undefined
        ? codificarCursor(ultima.createdAt.toISOString(), ultima.id, 'created_at')
        : null;

    return { items, nextCursor, hasNextPage, totalCount };
  }

  async actualizar(centroCoste: CentroCoste, versionEsperada: number): Promise<CentroCoste | null> {
    if (centroCoste.id === null) {
      return null;
    }

    try {
      const filas = await this.db
        .update(schema.centrosCoste)
        .set({
          nombre: centroCoste.nombre,
          formatoId: centroCoste.formatoId,
          updatedAt: centroCoste.updatedAt,
          version: sql`${schema.centrosCoste.version} + 1`,
        })
        .where(
          and(
            eq(schema.centrosCoste.id, centroCoste.id),
            eq(schema.centrosCoste.version, versionEsperada)
          )
        )
        .returning();

      const fila = filas[0];
      return fila === undefined ? null : CentroCoste.reconstituirCentroCoste(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  /**
   * Elimina un centro de coste, opcionalmente de forma **condicional por versión**.
   *
   * Con `versionEsperada` el borrado es `DELETE ... WHERE id = $1 AND version = $2`: si la
   * fila tiene otra versión, no se borra nada (el servicio responde 409).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<boolean> {
    const condiciones: SQL[] = [eq(schema.centrosCoste.id, id)];

    if (versionEsperada !== undefined) {
      condiciones.push(eq(schema.centrosCoste.version, versionEsperada));
    }

    try {
      const filas = await this.db
        .delete(schema.centrosCoste)
        .where(and(...condiciones))
        .returning({ id: schema.centrosCoste.id });

      return filas.length > 0;
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async contarPorFormato(formatoId: string): Promise<number> {
    const filas = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.centrosCoste)
      .where(eq(schema.centrosCoste.formatoId, formatoId));

    return filas[0]?.total ?? 0;
  }

  async listarTodos(filtros?: FiltrosCentroCoste): Promise<CentroCosteConFormato[]> {
    const condiciones: SQL[] = [];

    if (filtros?.codigo !== undefined) {
      condiciones.push(ilikeSeguro(sql`${schema.centrosCoste.codigo}`, filtros.codigo));
    }
    if (filtros?.nombre !== undefined) {
      condiciones.push(ilikeSeguro(sql`${schema.centrosCoste.nombre}`, filtros.nombre));
    }
    if (filtros?.formatoId !== undefined) {
      condiciones.push(eq(schema.centrosCoste.formatoId, filtros.formatoId));
    }
    if (filtros?.busqueda !== undefined) {
      const condicion = this.condicionBusqueda(filtros.busqueda);

      if (condicion !== undefined) {
        condiciones.push(condicion);
      }
    }

    const filas = await this.db
      .select({
        centro: schema.centrosCoste,
        formatoNombre: schema.formatos.nombre,
      })
      .from(schema.centrosCoste)
      .innerJoin(schema.formatos, eq(schema.centrosCoste.formatoId, schema.formatos.id))
      .where(and(...condiciones))
      .orderBy(sql`${schema.centrosCoste.codigo} ASC`);

    return filas.map((fila) => ({
      centro: CentroCoste.reconstituirCentroCoste(fila.centro),
      formatoNombre: fila.formatoNombre,
    }));
  }

  /**
   * Condición de la búsqueda libre: el texto buscado aparece en el **código** o en el
   * **nombre** del centro de coste (sin distinguir mayúsculas y minúsculas).
   *
   * `ilikeSeguro` escapa los comodines `%` y `_` del texto para que se busquen de
   * forma literal.
   */
  private condicionBusqueda(busqueda: string): SQL | undefined {
    const texto = busqueda.trim();

    if (texto === '') {
      return undefined;
    }

    return or(
      ilikeSeguro(sql`lower(${schema.centrosCoste.codigo})`, texto),
      ilikeSeguro(sql`lower(${schema.centrosCoste.nombre})`, texto)
    );
  }
}

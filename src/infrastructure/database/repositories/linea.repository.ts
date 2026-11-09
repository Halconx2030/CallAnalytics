import { and, count, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import { CostoMensual } from '@domain/value-objects/CostoMensual.js';

import type {
  FiltrosLinea,
  LineaExportRow,
  LineaListado,
  LineaRepository,
  OpcionesListadoLineas,
  ResultadoCambioEstadoMasivo,
} from '@application/ports/repositories/LineaRepository.js';
import type { PaginaCursor } from '@application/ports/repositories/paginacion.js';
import { normalizarLimit } from '@application/ports/repositories/paginacion.js';

import * as schema from '../schema/index.js';

import { codificarCursor, decodificarCursor, ordenKeyset, predicadoKeyset } from './cursor.js';
import { mapearErrorPostgres } from './errors.js';
import {
  COLUMNAS_ORDEN,
  construirCondicionesFiltroLinea,
  proyeccionLinea,
  valorCursorLinea,
  valoresInsercionLinea,
  type FilaLinea,
} from './linea-query.helper.js';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/** Implementación Drizzle del puerto {@link LineaRepository}. */
export class DrizzleLineaRepository implements LineaRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async crear(linea: LineaTelefonica): Promise<LineaTelefonica> {
    try {
      const filas = await this.db
        .insert(schema.lineasTelefonicas)
        .values(valoresInsercionLinea(linea))
        .returning();

      const fila = filas[0];

      if (fila === undefined) {
        throw new Error('No se pudo insertar la línea.');
      }

      return LineaTelefonica.reconstituirLineaTelefonica(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async crearMuchas(lineas: LineaTelefonica[]): Promise<LineaTelefonica[]> {
    if (lineas.length === 0) {
      return [];
    }

    try {
      return await this.db.transaction(async (tx) => {
        const filas = await tx
          .insert(schema.lineasTelefonicas)
          .values(lineas.map((linea) => valoresInsercionLinea(linea)))
          .returning();

        return filas.map((fila) => LineaTelefonica.reconstituirLineaTelefonica(fila));
      });
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async buscarPorId(id: string): Promise<LineaTelefonica | null> {
    const filas = await this.db
      .select()
      .from(schema.lineasTelefonicas)
      .where(eq(schema.lineasTelefonicas.id, id))
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : LineaTelefonica.reconstituirLineaTelefonica(fila);
  }

  async buscarPorNumero(numero: string): Promise<LineaTelefonica | null> {
    const filas = await this.db
      .select()
      .from(schema.lineasTelefonicas)
      .where(
        and(eq(schema.lineasTelefonicas.numero, numero), isNull(schema.lineasTelefonicas.deletedAt))
      )
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : LineaTelefonica.reconstituirLineaTelefonica(fila);
  }

  async buscarPorNumeros(numeros: string[]): Promise<LineaTelefonica[]> {
    if (numeros.length === 0) {
      return [];
    }

    const unicos = [...new Set(numeros.map((numero) => numero.trim()).filter((n) => n !== ''))];

    if (unicos.length === 0) {
      return [];
    }

    const filas = await this.db
      .select()
      .from(schema.lineasTelefonicas)
      .where(
        and(
          inArray(schema.lineasTelefonicas.numero, unicos),
          isNull(schema.lineasTelefonicas.deletedAt)
        )
      );

    return filas.map((fila) => LineaTelefonica.reconstituirLineaTelefonica(fila));
  }

  async listar(opciones: OpcionesListadoLineas): Promise<PaginaCursor<LineaListado>> {
    const limit = normalizarLimit(opciones.limit);
    const columna = opciones.sortColumn ?? 'created_at';
    const ascendente = (opciones.sortOrder ?? 'desc') === 'asc';

    const condicionesFiltroBase: SQL[] = [
      isNull(schema.lineasTelefonicas.deletedAt),
      ...construirCondicionesFiltroLinea(opciones),
    ];

    const condiciones: SQL[] = [...condicionesFiltroBase];

    if (opciones.afterId !== undefined) {
      const cursor = decodificarCursor(opciones.afterId, columna);
      const definicion = COLUMNAS_ORDEN[columna];
      condiciones.push(
        predicadoKeyset(
          definicion.expresion,
          sql`${schema.lineasTelefonicas.id}`,
          definicion.tipo,
          cursor.v,
          cursor.id,
          ascendente
        )
      );
    }

    const filas: FilaLinea[] = await this.db
      .select(proyeccionLinea)
      .from(schema.lineasTelefonicas)
      .innerJoin(
        schema.centrosCoste,
        eq(schema.lineasTelefonicas.centroCosteId, schema.centrosCoste.id)
      )
      .where(and(...condiciones))
      .orderBy(
        ordenKeyset(
          COLUMNAS_ORDEN[columna].expresion,
          sql`${schema.lineasTelefonicas.id}`,
          ascendente
        )
      )
      .limit(limit + 1);

    const filasCount = await this.db
      .select({ count: count() })
      .from(schema.lineasTelefonicas)
      .innerJoin(
        schema.centrosCoste,
        eq(schema.lineasTelefonicas.centroCosteId, schema.centrosCoste.id)
      )
      .where(and(...condicionesFiltroBase));

    const totalCountRaw = filasCount[0]?.count;
    const totalCount =
      typeof totalCountRaw === 'string' ? parseInt(totalCountRaw, 10) : (totalCountRaw ?? 0);

    const hasNextPage = filas.length > limit;
    const pagina = filas.slice(0, limit);
    const items: LineaListado[] = pagina.map((fila) => ({
      linea: LineaTelefonica.reconstituirLineaTelefonica(fila),
      centroCosteCodigo: fila.centroCosteCodigo,
      centroCosteNombre: fila.centroCosteNombre,
    }));

    const ultima = pagina[pagina.length - 1];
    const nextCursor =
      hasNextPage && ultima !== undefined
        ? codificarCursor(valorCursorLinea(columna, ultima), ultima.id, columna)
        : null;

    return { items, nextCursor, hasNextPage, totalCount };
  }

  async actualizar(
    linea: LineaTelefonica,
    versionEsperada: number
  ): Promise<LineaTelefonica | null> {
    if (linea.id === null) {
      return null;
    }

    try {
      const filas = await this.db
        .update(schema.lineasTelefonicas)
        .set({
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
          updatedAt: linea.updatedAt,
          version: sql`${schema.lineasTelefonicas.version} + 1`,
        })
        .where(
          and(
            eq(schema.lineasTelefonicas.id, linea.id),
            eq(schema.lineasTelefonicas.version, versionEsperada)
          )
        )
        .returning();

      const fila = filas[0];
      return fila === undefined ? null : LineaTelefonica.reconstituirLineaTelefonica(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async actualizarEstadoMasivo(
    ids: string[],
    estado: LineaTelefonica['estado'],
    ahora: Date
  ): Promise<ResultadoCambioEstadoMasivo> {
    const idsUnicos = [...new Set(ids)];

    if (idsUnicos.length === 0) {
      return { actualizados: 0, sinCambios: 0, noEncontrados: 0 };
    }

    try {
      return await this.db.transaction(async (tx) => {
        const existentes = await tx
          .select({
            id: schema.lineasTelefonicas.id,
            estado: schema.lineasTelefonicas.estado,
            deletedAt: schema.lineasTelefonicas.deletedAt,
          })
          .from(schema.lineasTelefonicas)
          .where(inArray(schema.lineasTelefonicas.id, idsUnicos));

        const encontrados = new Set(existentes.map((fila) => fila.id));
        const noEncontrados = idsUnicos.filter((id) => !encontrados.has(id)).length;

        const aActualizar = existentes.filter((fila) => this.requiereActualizacion(fila, estado));

        if (aActualizar.length > 0) {
          await tx
            .update(schema.lineasTelefonicas)
            .set({
              estado,
              deletedAt: estado === 'baja' ? ahora : null,
              updatedAt: ahora,
              version: sql`${schema.lineasTelefonicas.version} + 1`,
            })
            .where(
              inArray(
                schema.lineasTelefonicas.id,
                aActualizar.map((fila) => fila.id)
              )
            );
        }

        return {
          actualizados: aActualizar.length,
          sinCambios: existentes.length - aActualizar.length,
          noEncontrados,
        };
      });
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async exportar(filtros: FiltrosLinea, incluirBajas: boolean): Promise<LineaExportRow[]> {
    const condiciones: SQL[] = [];

    if (!incluirBajas) {
      condiciones.push(isNull(schema.lineasTelefonicas.deletedAt));
    }

    condiciones.push(...construirCondicionesFiltroLinea(filtros));

    const filas: FilaLinea[] = await this.db
      .select(proyeccionLinea)
      .from(schema.lineasTelefonicas)
      .innerJoin(
        schema.centrosCoste,
        eq(schema.lineasTelefonicas.centroCosteId, schema.centrosCoste.id)
      )
      .where(and(...condiciones))
      .orderBy(
        sql`${schema.lineasTelefonicas.createdAt} DESC, ${schema.lineasTelefonicas.id} DESC`
      );

    return filas.map((fila) => ({
      numero: fila.numero,
      numeroOriginal: fila.numeroOriginal,
      proveedor: fila.proveedor,
      centroCosteCodigo: fila.centroCosteCodigo,
      centroCosteNombre: fila.centroCosteNombre,
      fechaAsignacion: fila.fechaAsignacion,
      costoMensual: CostoMensual.create(fila.costoMensual).aString(),
      tipoLinea: fila.tipoLinea,
      empleado: fila.empleado,
      estado: fila.estado,
      tipoUso: fila.tipoUso,
      createdAt: fila.createdAt,
    }));
  }

  async contarPorCentroCoste(centroCosteId: string): Promise<number> {
    const filas = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.lineasTelefonicas)
      .where(eq(schema.lineasTelefonicas.centroCosteId, centroCosteId));

    return filas[0]?.total ?? 0;
  }

  /**
   * Indica si la línea necesita cambio: distinto estado, o `deleted_at` desalineado con el
   * estado pedido (baja lógica).
   */
  private requiereActualizacion(
    fila: { estado: string; deletedAt: Date | null },
    estado: LineaTelefonica['estado']
  ): boolean {
    if (fila.estado !== estado) {
      return true;
    }

    if (estado === 'baja') {
      return fila.deletedAt === null;
    }

    return fila.deletedAt !== null;
  }
}

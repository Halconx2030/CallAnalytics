import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';

import { Formato } from '@domain/entities/Formato.js';

import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { PaginaCursor, PaginacionCursor } from '@application/ports/repositories/paginacion.js';
import { normalizarLimit } from '@application/ports/repositories/paginacion.js';

import * as schema from '../schema/index.js';

import { codificarCursor, decodificarCursor, ordenKeyset, predicadoKeyset } from './cursor.js';
import { mapearErrorPostgres } from './errors.js';

import type { FuenteDrizzle } from './tipos.js';

/**
 * Implementación Drizzle del puerto {@link FormatoRepository}.
 *
 * La instancia de base de datos se recibe por constructor para que los tests de integración
 * puedan apuntar a una base de pruebas sin tocar la de desarrollo. También acepta una
 * transacción en curso (unidad de trabajo), de modo que las escrituras formen parte de ella.
 */
export class DrizzleFormatoRepository implements FormatoRepository {
  constructor(private readonly db: FuenteDrizzle) {}

  async crear(formato: Formato): Promise<Formato> {
    try {
      const filas = await this.db
        .insert(schema.formatos)
        .values({
          nombre: formato.nombre,
          createdAt: formato.createdAt,
          updatedAt: formato.updatedAt,
        })
        .returning();

      const fila = filas[0];

      if (fila === undefined) {
        throw new Error('No se pudo insertar el formato.');
      }

      return Formato.reconstituirFormato(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async buscarPorId(id: string): Promise<Formato | null> {
    const filas = await this.db
      .select()
      .from(schema.formatos)
      .where(eq(schema.formatos.id, id))
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : Formato.reconstituirFormato(fila);
  }

  async buscarPorNombre(nombre: string): Promise<Formato | null> {
    const filas = await this.db
      .select()
      .from(schema.formatos)
      .where(eq(schema.formatos.nombre, nombre))
      .limit(1);

    const fila = filas[0];
    return fila === undefined ? null : Formato.reconstituirFormato(fila);
  }

  async buscarPorNombres(nombres: string[]): Promise<Formato[]> {
    if (nombres.length === 0) {
      return [];
    }

    const unicos = [...new Set(nombres.map((nombre) => nombre.trim().toLowerCase()))].filter(
      (nombre) => nombre !== ''
    );

    if (unicos.length === 0) {
      return [];
    }

    const filas = await this.db
      .select()
      .from(schema.formatos)
      .where(inArray(sql`lower(${schema.formatos.nombre})`, unicos));

    return filas.map((fila) => Formato.reconstituirFormato(fila));
  }

  /**
   * Lista formatos ordenados por `nombre` ASC (`RF-FMT-1.3`) con paginación por cursor sobre
   * esa misma columna e `id` como desempate (`RF-ORD-1.4`).
   */
  async listar(paginacion: PaginacionCursor): Promise<PaginaCursor<Formato>> {
    const limit = normalizarLimit(paginacion.limit);
    const condiciones: SQL[] = [];

    if (paginacion.afterId !== undefined) {
      const cursor = decodificarCursor(paginacion.afterId, 'nombre');
      condiciones.push(
        predicadoKeyset(
          sql`${schema.formatos.nombre}`,
          sql`${schema.formatos.id}`,
          'text',
          cursor.v,
          cursor.id,
          true
        )
      );
    }

    const filas = await this.db
      .select()
      .from(schema.formatos)
      .where(and(...condiciones))
      .orderBy(ordenKeyset(sql`${schema.formatos.nombre}`, sql`${schema.formatos.id}`, true))
      .limit(limit + 1);

    const hasNextPage = filas.length > limit;
    const items = filas.slice(0, limit).map((fila) => Formato.reconstituirFormato(fila));
    const ultima = filas[limit - 1];
    const nextCursor =
      hasNextPage && ultima !== undefined
        ? codificarCursor(ultima.nombre, ultima.id, 'nombre')
        : null;

    return { items, nextCursor, hasNextPage };
  }

  async actualizar(formato: Formato, versionEsperada: number): Promise<Formato | null> {
    if (formato.id === null) {
      return null;
    }

    try {
      const filas = await this.db
        .update(schema.formatos)
        .set({
          nombre: formato.nombre,
          updatedAt: formato.updatedAt,
          version: sql`${schema.formatos.version} + 1`,
        })
        .where(
          and(eq(schema.formatos.id, formato.id), eq(schema.formatos.version, versionEsperada))
        )
        .returning();

      const fila = filas[0];
      return fila === undefined ? null : Formato.reconstituirFormato(fila);
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  /**
   * Elimina un formato, opcionalmente de forma **condicional por versión**.
   *
   * Con `versionEsperada` el borrado es `DELETE ... WHERE id = $1 AND version = $2`: si la
   * fila tiene otra versión, no se borra nada (el servicio responde 409).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<boolean> {
    const condiciones: SQL[] = [eq(schema.formatos.id, id)];

    if (versionEsperada !== undefined) {
      condiciones.push(eq(schema.formatos.version, versionEsperada));
    }

    try {
      const filas = await this.db
        .delete(schema.formatos)
        .where(and(...condiciones))
        .returning({ id: schema.formatos.id });

      return filas.length > 0;
    } catch (error) {
      throw mapearErrorPostgres(error);
    }
  }

  async listarTodos(): Promise<Formato[]> {
    const filas = await this.db
      .select()
      .from(schema.formatos)
      .orderBy(sql`${schema.formatos.nombre} ASC`);

    return filas.map((fila) => Formato.reconstituirFormato(fila));
  }
}

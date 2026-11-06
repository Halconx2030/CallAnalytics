import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import {
  ConflictError,
  DuplicateError,
  ForeignKeyError,
  NotFoundError,
} from '@domain/errors/DomainError.js';
import { normalizePhone } from '@domain/value-objects/PhoneNumber.js';

import type {
  ActualizarLineaDto,
  CrearLineaDto,
  LineaDto,
  LineaExportDto,
  ResultadoCambioEstadoMasivoDto,
} from '@application/dto/linea.dto.js';
import { toLineaDto } from '@application/dto/linea.dto.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type {
  ColumnaOrdenLinea,
  DireccionOrden,
  FiltrosLinea,
  LineaRepository,
} from '@application/ports/repositories/LineaRepository.js';
import type { PaginaCursor, PaginacionCursor } from '@application/ports/repositories/paginacion.js';

/** Opciones de listado de líneas expuestas por el servicio. */
export interface OpcionesListarLineas extends FiltrosLinea, PaginacionCursor {
  /** Columna de ordenamiento; por defecto `created_at`. */
  readonly sortColumn?: ColumnaOrdenLinea | undefined;
  /** Dirección del ordenamiento; por defecto `desc`. */
  readonly sortOrder?: DireccionOrden | undefined;
}

/**
 * Casos de uso de las líneas telefónicas (RF-LIN-1.1 a RF-LIN-1.9).
 *
 * El servicio solo conoce los puertos: no importa Drizzle ni Fastify.
 */
export class LineaService {
  constructor(
    private readonly lineas: LineaRepository,
    private readonly centrosCoste: CentroCosteRepository
  ) {}

  /**
   * Crea una línea.
   *
   * - El número se normaliza y valida (400 si no es chileno válido, RF-LIN-1.4).
   * - El centro de coste debe existir (400, RF-LIN-1.3).
   * - El número no puede repetir el de una línea vigente (409, RF-LIN-1.2).
   */
  async crear(dto: CrearLineaDto): Promise<LineaDto> {
    const { normalized } = normalizePhone(dto.numero);

    await this.exigirCentroCoste(dto.centroCosteId);

    const existente = await this.lineas.buscarPorNumero(normalized);

    if (existente !== null) {
      throw new DuplicateError('numero');
    }

    const linea = LineaTelefonica.crearLineaTelefonica({
      numero: dto.numero,
      ...(dto.numeroOriginal === undefined ? {} : { numeroOriginal: dto.numeroOriginal }),
      ...(dto.proveedor === undefined ? {} : { proveedor: dto.proveedor }),
      centroCosteId: dto.centroCosteId,
      ...(dto.fechaAsignacion === undefined ? {} : { fechaAsignacion: dto.fechaAsignacion }),
      ...(dto.costoMensual === undefined ? {} : { costoMensual: dto.costoMensual }),
      ...(dto.tipoLinea === undefined ? {} : { tipoLinea: dto.tipoLinea }),
      ...(dto.empleado === undefined ? {} : { empleado: dto.empleado }),
      ...(dto.estado === undefined ? {} : { estado: dto.estado }),
      ...(dto.tipoUso === undefined ? {} : { tipoUso: dto.tipoUso }),
    });

    const guardada = await this.lineas.crear(linea);

    return toLineaDto(guardada);
  }

  /** Lista líneas con los 14 filtros, ordenamiento y paginación por cursor (RF-LIN-1.9). */
  async listar(opciones: OpcionesListarLineas): Promise<PaginaCursor<LineaDto>> {
    const pagina = await this.lineas.listar(opciones);

    return {
      items: pagina.items.map((item) =>
        toLineaDto(item.linea, {
          codigo: item.centroCosteCodigo,
          nombre: item.centroCosteNombre,
        })
      ),
      nextCursor: pagina.nextCursor,
      hasNextPage: pagina.hasNextPage,
    };
  }

  /** Obtiene una línea por id (404 si no existe). */
  async obtener(id: string): Promise<LineaDto> {
    const linea = await this.lineas.buscarPorId(id);

    if (linea === null) {
      throw new NotFoundError('línea telefónica', id);
    }

    return toLineaDto(linea);
  }

  /**
   * Actualiza los campos modificables de una línea.
   *
   * `numero` e `id` son inmutables (RF-LIN-1.5).
   */
  async actualizar(
    id: string,
    dto: ActualizarLineaDto,
    versionEsperada?: number
  ): Promise<LineaDto> {
    const linea = await this.lineas.buscarPorId(id);

    if (linea === null) {
      throw new NotFoundError('línea telefónica', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== linea.version) {
      throw new ConflictError(
        `La línea fue modificada por otra persona (versión actual: ${linea.version}).`
      );
    }

    if (dto.centroCosteId !== undefined && dto.centroCosteId !== linea.centroCosteId) {
      await this.exigirCentroCoste(dto.centroCosteId);
    }

    const actualizada = linea.actualizar({
      ...(dto.numeroOriginal === undefined ? {} : { numeroOriginal: dto.numeroOriginal }),
      ...(dto.proveedor === undefined ? {} : { proveedor: dto.proveedor }),
      ...(dto.centroCosteId === undefined ? {} : { centroCosteId: dto.centroCosteId }),
      ...(dto.fechaAsignacion === undefined ? {} : { fechaAsignacion: dto.fechaAsignacion }),
      ...(dto.costoMensual === undefined ? {} : { costoMensual: dto.costoMensual }),
      ...(dto.tipoLinea === undefined ? {} : { tipoLinea: dto.tipoLinea }),
      ...(dto.empleado === undefined ? {} : { empleado: dto.empleado }),
      ...(dto.estado === undefined ? {} : { estado: dto.estado }),
      ...(dto.tipoUso === undefined ? {} : { tipoUso: dto.tipoUso }),
    });

    const resultado = await this.lineas.actualizar(actualizada, linea.version);

    if (resultado === null) {
      throw new ConflictError('La línea fue modificada por otra persona.');
    }

    return toLineaDto(resultado);
  }

  /**
   * Cambia el estado de una línea (RF-LIN-1.6).
   *
   * Poner `baja` hace la baja lógica (`deleted_at`), y la operación es idempotente: si la
   * línea ya está en ese estado no se toca la base de datos.
   *
   * @param versionEsperada versión que el cliente cree tener (cabecera `If-Match`); si no
   * coincide con la almacenada se responde con conflicto (409) y **no** se aplica el cambio
   * (RF-OPT-1.3). Si no se indica, la operación no verifica la versión.
   */
  async cambiarEstado(
    id: string,
    estado: LineaTelefonica['estado'],
    versionEsperada?: number
  ): Promise<LineaDto> {
    const linea = await this.lineas.buscarPorId(id);

    if (linea === null) {
      throw new NotFoundError('línea telefónica', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== linea.version) {
      throw new ConflictError(
        `La línea fue modificada por otra persona (versión actual: ${linea.version}).`
      );
    }

    const cambiada = linea.cambiarEstado(estado);

    if (cambiada === linea) {
      return toLineaDto(linea);
    }

    const resultado = await this.lineas.actualizar(cambiada, linea.version);

    if (resultado === null) {
      throw new ConflictError('La línea fue modificada por otra persona.');
    }

    return toLineaDto(resultado);
  }

  /**
   * Da de baja una línea (baja lógica, `RF-LIN-1.8`) comprobando la versión esperada.
   *
   * Es el caso de uso del `DELETE /api/v1/lineas/:id`: la cabecera `If-Match` se propaga
   * hasta la escritura, que se hace de forma **condicional por versión**
   * (`UPDATE ... WHERE id = $id AND version = $versionEsperada`).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<LineaDto> {
    return this.cambiarEstado(id, 'baja', versionEsperada);
  }

  /**
   * Cambia el estado de varias líneas en una transacción (RF-LIN-1.7).
   *
   * Las líneas que ya están en el estado pedido se cuentan como `ignoradas` (idempotencia,
   * Q3 de la spec) y las que no existen como `fallidas`.
   */
  async cambiarEstadoMasivo(
    ids: string[],
    estado: LineaTelefonica['estado']
  ): Promise<ResultadoCambioEstadoMasivoDto> {
    const resultado = await this.lineas.actualizarEstadoMasivo(ids, estado, new Date());

    return {
      actualizadas: resultado.actualizados,
      ignoradas: resultado.sinCambios,
      fallidas: resultado.noEncontrados,
    };
  }

  /** Exporta las líneas filtradas, sin paginación (RF-LIN-EXP-1.1 a RF-LIN-EXP-1.3). */
  async exportar(filtros: FiltrosLinea = {}, incluirBajas = false): Promise<LineaExportDto[]> {
    const filas = await this.lineas.exportar(filtros, incluirBajas);

    return filas.map((fila) => ({
      numero: fila.numero,
      numeroOriginal: fila.numeroOriginal,
      proveedor: fila.proveedor,
      centroCosteCodigo: fila.centroCosteCodigo,
      centroCosteNombre: fila.centroCosteNombre,
      fechaAsignacion: fila.fechaAsignacion,
      costoMensual: fila.costoMensual,
      tipoLinea: fila.tipoLinea,
      empleado: fila.empleado,
      estado: fila.estado,
      tipoUso: fila.tipoUso,
      createdAt: fila.createdAt.toISOString(),
    }));
  }

  /** Verifica que el centro de coste exista; si no, error de clave foránea (400). */
  private async exigirCentroCoste(centroCosteId: string): Promise<void> {
    const centro = await this.centrosCoste.buscarPorId(centroCosteId);

    if (centro === null) {
      throw new ForeignKeyError('centroCosteId', 'El centro de coste indicado no existe.');
    }
  }
}

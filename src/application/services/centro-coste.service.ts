import { CentroCoste } from '@domain/entities/CentroCoste.js';
import {
  ConflictError,
  DuplicateError,
  ForeignKeyError,
  NotFoundError,
} from '@domain/errors/DomainError.js';

import type {
  ActualizarCentroCosteDto,
  CentroCosteDto,
  CentroCosteExportDto,
  CrearCentroCosteDto,
} from '@application/dto/centro-coste.dto.js';
import { toCentroCosteDto } from '@application/dto/centro-coste.dto.js';
import type {
  CentroCosteRepository,
  FiltrosCentroCoste,
} from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import type { PaginaCursor, PaginacionCursor } from '@application/ports/repositories/paginacion.js';

/**
 * Casos de uso de los centros de coste (RF-CC-1.1 a RF-CC-1.6).
 *
 * El servicio solo conoce los puertos: no importa Drizzle ni Fastify.
 */
export class CentroCosteService {
  constructor(
    private readonly centrosCoste: CentroCosteRepository,
    private readonly formatos: FormatoRepository,
    private readonly lineas: LineaRepository
  ) {}

  /**
   * Crea un centro de coste.
   *
   * El código debe ser único (409) y el formato debe existir (400).
   */
  async crear(dto: CrearCentroCosteDto): Promise<CentroCosteDto> {
    const codigo = dto.codigo.trim();

    const existente = await this.centrosCoste.buscarPorCodigo(codigo);

    if (existente !== null) {
      throw new DuplicateError('codigo');
    }

    await this.exigirFormato(dto.formatoId);

    const centro = CentroCoste.crearCentroCoste({
      codigo,
      nombre: dto.nombre,
      formatoId: dto.formatoId,
    });

    const guardado = await this.centrosCoste.crear(centro);

    return toCentroCosteDto(guardado);
  }

  /** Lista centros de coste con filtros y paginación por cursor (RF-CC-1.6). */
  async listar(
    filtros: FiltrosCentroCoste,
    paginacion: PaginacionCursor
  ): Promise<PaginaCursor<CentroCosteDto>> {
    const pagina = await this.centrosCoste.listar({ ...filtros, ...paginacion });

    return {
      items: pagina.items.map((centro) => toCentroCosteDto(centro)),
      nextCursor: pagina.nextCursor,
      hasNextPage: pagina.hasNextPage,
    };
  }

  /** Obtiene un centro de coste por id (404 si no existe). */
  async obtener(id: string): Promise<CentroCosteDto> {
    const centro = await this.centrosCoste.buscarPorId(id);

    if (centro === null) {
      throw new NotFoundError('centro de coste', id);
    }

    return toCentroCosteDto(centro);
  }

  /**
   * Actualiza `nombre` y/o `formato_id` de un centro de coste.
   *
   * `codigo` es inmutable (RF-CC-1.4).
   */
  async actualizar(
    id: string,
    dto: ActualizarCentroCosteDto,
    versionEsperada?: number
  ): Promise<CentroCosteDto> {
    const centro = await this.centrosCoste.buscarPorId(id);

    if (centro === null) {
      throw new NotFoundError('centro de coste', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== centro.version) {
      throw new ConflictError(
        `El centro de coste fue modificado por otra persona (versión actual: ${centro.version}).`
      );
    }

    let actualizado = centro;

    if (dto.nombre !== undefined) {
      actualizado = actualizado.renombrar(dto.nombre);
    }

    if (dto.formatoId !== undefined) {
      await this.exigirFormato(dto.formatoId);
      actualizado = actualizado.cambiarFormato(dto.formatoId);
    }

    const resultado = await this.centrosCoste.actualizar(actualizado, centro.version);

    if (resultado === null) {
      throw new ConflictError('El centro de coste fue modificado por otra persona.');
    }

    return toCentroCosteDto(resultado);
  }

  /**
   * Elimina un centro de coste.
   *
   * Solo se permite si no tiene líneas asociadas (RF-CC-1.5); en caso contrario se responde
   * con conflicto (409).
   *
   * @param versionEsperada versión que el cliente cree tener (cabecera `If-Match`); si no
   * coincide con la almacenada se responde con conflicto (409) y **no** se borra nada
   * (RF-OPT-1.3). Si no se indica, el borrado no verifica la versión.
   */
  async eliminar(id: string, versionEsperada?: number): Promise<void> {
    const centro = await this.centrosCoste.buscarPorId(id);

    if (centro === null) {
      throw new NotFoundError('centro de coste', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== centro.version) {
      throw new ConflictError(
        `El centro de coste fue modificado por otra persona (versión actual: ${centro.version}).`
      );
    }

    const lineasAsociadas = await this.lineas.contarPorCentroCoste(id);

    if (lineasAsociadas > 0) {
      throw new ConflictError(
        `No se puede eliminar el centro de coste "${centro.codigo}": tiene ${lineasAsociadas} línea(s) asociada(s).`
      );
    }

    const eliminado = await this.centrosCoste.eliminar(id, versionEsperada);

    if (!eliminado) {
      // Con versión esperada, no se borró nada porque la fila cambió (o desapareció) entre la
      // lectura y el borrado: es un conflicto de versión, no un recurso inexistente.
      if (versionEsperada !== undefined) {
        throw new ConflictError('El centro de coste fue modificado por otra persona.');
      }

      throw new NotFoundError('centro de coste', id);
    }
  }

  /** Devuelve todos los centros de coste para la exportación (RF-CC-EXP-1.1). */
  async exportar(filtros: FiltrosCentroCoste = {}): Promise<CentroCosteExportDto[]> {
    const centros = await this.centrosCoste.listarTodos(filtros);

    return centros.map((centro) => ({
      codigo: centro.centro.codigo,
      nombre: centro.centro.nombre,
      formatoNombre: centro.formatoNombre,
      createdAt: centro.centro.createdAt.toISOString(),
    }));
  }

  /** Verifica que el formato exista; si no, error de clave foránea (400). */
  private async exigirFormato(formatoId: string): Promise<void> {
    const formato = await this.formatos.buscarPorId(formatoId);

    if (formato === null) {
      throw new ForeignKeyError('formatoId', 'El formato indicado no existe.');
    }
  }
}

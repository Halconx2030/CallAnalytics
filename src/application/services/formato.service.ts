import { Formato } from '@domain/entities/Formato.js';
import { ConflictError, DuplicateError, NotFoundError } from '@domain/errors/DomainError.js';

import type {
  ActualizarFormatoDto,
  CrearFormatoDto,
  FormatoDto,
} from '@application/dto/formato.dto.js';
import { toFormatoDto } from '@application/dto/formato.dto.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { PaginaCursor, PaginacionCursor } from '@application/ports/repositories/paginacion.js';

/**
 * Casos de uso de los formatos de importación (RF-FMT-1.1 a RF-FMT-1.4).
 *
 * El servicio solo conoce los puertos: no importa Drizzle ni Fastify.
 */
export class FormatoService {
  constructor(
    private readonly formatos: FormatoRepository,
    private readonly centrosCoste: CentroCosteRepository
  ) {}

  /** Crea un formato. El nombre debe ser único (409 si ya existe). */
  async crear(dto: CrearFormatoDto): Promise<FormatoDto> {
    const nombre = dto.nombre.trim();

    const existente = await this.formatos.buscarPorNombre(nombre);

    if (existente !== null) {
      throw new DuplicateError('nombre');
    }

    const formato = Formato.crearFormato({ nombre });
    const guardado = await this.formatos.crear(formato);

    return toFormatoDto(guardado);
  }

  /** Lista formatos con paginación por cursor (RF-FMT-1.3). */
  async listar(paginacion: PaginacionCursor): Promise<PaginaCursor<FormatoDto>> {
    const pagina = await this.formatos.listar(paginacion);

    return {
      items: pagina.items.map((formato) => toFormatoDto(formato)),
      nextCursor: pagina.nextCursor,
      hasNextPage: pagina.hasNextPage,
      totalCount: pagina.totalCount,
    };
  }

  /** Obtiene un formato por id (404 si no existe). */
  async obtener(id: string): Promise<FormatoDto> {
    const formato = await this.formatos.buscarPorId(id);

    if (formato === null) {
      throw new NotFoundError('formato', id);
    }

    return toFormatoDto(formato);
  }

  /**
   * Renombra un formato.
   *
   * @param versionEsperada versión que el cliente cree tener; si no coincide con la
   * almacenada se responde con conflicto (409).
   */
  async actualizar(
    id: string,
    dto: ActualizarFormatoDto,
    versionEsperada?: number
  ): Promise<FormatoDto> {
    const formato = await this.formatos.buscarPorId(id);

    if (formato === null) {
      throw new NotFoundError('formato', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== formato.version) {
      throw new ConflictError(
        `El formato fue modificado por otra persona (versión actual: ${formato.version}).`
      );
    }

    const actualizado = formato.renombrar(dto.nombre);
    const resultado = await this.formatos.actualizar(actualizado, formato.version);

    if (resultado === null) {
      throw new ConflictError('El formato fue modificado por otra persona.');
    }

    return toFormatoDto(resultado);
  }

  /**
   * Elimina un formato.
   *
   * Solo se permite si no tiene centros de coste asociados (RF-FMT-1.4); en caso contrario
   * se responde con conflicto (409).
   *
   * @param versionEsperada versión que el cliente cree tener (cabecera `If-Match`); si no
   * coincide con la almacenada se responde con conflicto (409) y **no** se borra nada
   * (RF-OPT-1.3). Si no se indica, el borrado no verifica la versión.
   */
  async eliminar(id: string, versionEsperada?: number): Promise<void> {
    const formato = await this.formatos.buscarPorId(id);

    if (formato === null) {
      throw new NotFoundError('formato', id);
    }

    if (versionEsperada !== undefined && versionEsperada !== formato.version) {
      throw new ConflictError(
        `El formato fue modificado por otra persona (versión actual: ${formato.version}).`
      );
    }

    const asociados = await this.centrosCoste.contarPorFormato(id);

    if (asociados > 0) {
      throw new ConflictError(
        `No se puede eliminar el formato "${formato.nombre}": tiene ${asociados} centro(s) de coste asociado(s).`
      );
    }

    const eliminado = await this.formatos.eliminar(id, versionEsperada);

    if (!eliminado) {
      // Con versión esperada, no se borró nada porque la fila cambió (o desapareció) entre la
      // lectura y el borrado: es un conflicto de versión, no un recurso inexistente.
      if (versionEsperada !== undefined) {
        throw new ConflictError('El formato fue modificado por otra persona.');
      }

      throw new NotFoundError('formato', id);
    }
  }

  /** Devuelve todos los formatos para la exportación (RF-FMT-EXP-1.1). */
  async exportar(): Promise<FormatoDto[]> {
    const formatos = await this.formatos.listarTodos();

    return formatos.map((formato) => toFormatoDto(formato));
  }
}

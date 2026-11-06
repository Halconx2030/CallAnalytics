import type { FiltrosCentroCoste } from '@application/ports/repositories/CentroCosteRepository.js';
import type { CentroCosteService } from '@application/services/centro-coste.service.js';

import { COLUMNAS_EXPORT_CENTROS, construirArchivo, nombreArchivoExport } from '../export.js';
import { toCentroCosteResponse, toPaginaResponse } from '../respuestas.js';

import type { ArchivoExportado, FormatoArchivo } from '../export.js';
import type { CentroCosteResponse, PaginaResponse } from '../respuestas.js';

/** Filtros y paginación del listado de centros de coste, en snake_case. */
export interface QueryCentroCoste {
  readonly codigo?: string | undefined;
  readonly nombre?: string | undefined;
  readonly formato_id?: string | undefined;
  /** Búsqueda libre por código o nombre (buscador de la UI). */
  readonly busqueda?: string | undefined;
  readonly after_id?: string | undefined;
  readonly limit?: number | undefined;
}

/** Controlador HTTP de los centros de coste (`RF-CC-1.1` a `RF-CC-1.6`). */
export class CentroCosteController {
  constructor(private readonly service: CentroCosteService) {}

  /** Lista centros de coste con filtros y paginación (`RF-CC-1.6`). */
  async listar(query: QueryCentroCoste): Promise<PaginaResponse<CentroCosteResponse>> {
    const filtros: FiltrosCentroCoste = {
      codigo: query.codigo,
      nombre: query.nombre,
      formatoId: query.formato_id,
      busqueda: this.normalizarBusqueda(query.busqueda),
    };

    const pagina = await this.service.listar(filtros, {
      afterId: query.after_id,
      limit: query.limit,
    });

    return toPaginaResponse(pagina, toCentroCosteResponse);
  }

  /** Crea un centro de coste (`RF-CC-1.1`). */
  async crear(body: {
    codigo: string;
    nombre: string;
    formato_id: string;
  }): Promise<CentroCosteResponse> {
    return toCentroCosteResponse(
      await this.service.crear({
        codigo: body.codigo,
        nombre: body.nombre,
        formatoId: body.formato_id,
      })
    );
  }

  /** Obtiene un centro de coste por id (`RF-CC-1.2`). */
  async obtener(id: string): Promise<CentroCosteResponse> {
    return toCentroCosteResponse(await this.service.obtener(id));
  }

  /** Actualiza nombre y/o formato (`RF-CC-1.4`). */
  async actualizar(
    id: string,
    body: { nombre?: string | undefined; formato_id?: string | undefined },
    versionEsperada?: number
  ): Promise<CentroCosteResponse> {
    return toCentroCosteResponse(
      await this.service.actualizar(
        id,
        {
          nombre: body.nombre,
          formatoId: body.formato_id,
        },
        versionEsperada
      )
    );
  }

  /**
   * Elimina un centro de coste sin líneas asociadas (`RF-CC-1.5`).
   *
   * @param versionEsperada versión esperada según la cabecera `If-Match` (`RF-OPT-1.1`).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<void> {
    await this.service.eliminar(id, versionEsperada);
  }

  /** Exporta los centros de coste a CSV/Excel (`RF-CC-EXP-1.1`). */
  async exportar(format: FormatoArchivo, query: QueryCentroCoste): Promise<ArchivoExportado> {
    const centros = await this.service.exportar({
      codigo: query.codigo,
      nombre: query.nombre,
      formatoId: query.formato_id,
      busqueda: this.normalizarBusqueda(query.busqueda),
    });

    const filas = centros.map((centro) => [
      centro.codigo,
      centro.nombre,
      centro.formatoNombre,
      centro.createdAt,
    ]);

    return {
      contenido: construirArchivo([...COLUMNAS_EXPORT_CENTROS], filas, format),
      nombreArchivo: nombreArchivoExport('centros_coste', format),
      contentType:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
    };
  }

  /**
   * Normaliza el texto de búsqueda: si viene vacío (o solo espacios) se descarta,
   * de modo que el listado no se filtre.
   */
  private normalizarBusqueda(busqueda: string | undefined): string | undefined {
    if (busqueda === undefined) {
      return undefined;
    }

    const texto = busqueda.trim();

    return texto === '' ? undefined : texto;
  }
}

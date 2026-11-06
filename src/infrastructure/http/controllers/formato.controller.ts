import type { FormatoService } from '@application/services/formato.service.js';

import { COLUMNAS_EXPORT_FORMATOS, construirArchivo, nombreArchivoExport } from '../export.js';
import { toFormatoResponse, toPaginaResponse } from '../respuestas.js';

import type { ArchivoExportado, FormatoArchivo } from '../export.js';
import type { FormatoResponse, PaginaResponse } from '../respuestas.js';

/** Controlador HTTP de los formatos (`RF-FMT-1.1` a `RF-FMT-1.4`). */
export class FormatoController {
  constructor(private readonly service: FormatoService) {}

  /** Lista formatos con paginación por cursor (`RF-FMT-1.3`). */
  async listar(query: {
    after_id?: string | undefined;
    limit?: number | undefined;
  }): Promise<PaginaResponse<FormatoResponse>> {
    const pagina = await this.service.listar({
      afterId: query.after_id,
      limit: query.limit,
    });

    return toPaginaResponse(pagina, toFormatoResponse);
  }

  /** Crea un formato (`RF-FMT-1.1`). */
  async crear(body: { nombre: string }): Promise<FormatoResponse> {
    return toFormatoResponse(await this.service.crear({ nombre: body.nombre }));
  }

  /** Obtiene un formato por id (`RF-FMT-1.2`). */
  async obtener(id: string): Promise<FormatoResponse> {
    return toFormatoResponse(await this.service.obtener(id));
  }

  /** Renombra un formato (`RF-FMT-1.3`). */
  async actualizar(
    id: string,
    body: { nombre: string },
    versionEsperada?: number
  ): Promise<FormatoResponse> {
    return toFormatoResponse(
      await this.service.actualizar(id, { nombre: body.nombre }, versionEsperada)
    );
  }

  /**
   * Elimina un formato si no tiene centros de coste asociados (`RF-FMT-1.4`).
   *
   * @param versionEsperada versión esperada según la cabecera `If-Match` (`RF-OPT-1.1`).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<void> {
    await this.service.eliminar(id, versionEsperada);
  }

  /** Exporta los formatos a CSV/Excel (`RF-FMT-EXP-1.1`). */
  async exportar(format: FormatoArchivo): Promise<ArchivoExportado> {
    const formatos = await this.service.exportar();
    const filas = formatos.map((formato) => [formato.nombre, formato.createdAt]);
    const contenido = construirArchivo([...COLUMNAS_EXPORT_FORMATOS], filas, format);

    return {
      contenido,
      nombreArchivo: nombreArchivoExport('formatos', format),
      contentType:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
    };
  }
}

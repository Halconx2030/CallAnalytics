import type {
  ColumnaOrdenLinea,
  DireccionOrden,
  FiltrosLinea,
} from '@application/ports/repositories/LineaRepository.js';
import type { LineaService } from '@application/services/linea.service.js';

import { COLUMNAS_EXPORT_LINEAS, construirArchivo, nombreArchivoExport } from '../export.js';
import { toLineaResponse, toPaginaResponse } from '../respuestas.js';

import type { ArchivoExportado, FormatoArchivo } from '../export.js';
import type { LineaResponse, PaginaResponse } from '../respuestas.js';

/** Filtros, orden y paginación del listado de líneas, en snake_case. */
export interface QueryLinea {
  readonly numero?: string | undefined;
  readonly proveedor?: string | undefined;
  readonly centro_coste_id?: string | undefined;
  readonly centro_coste_codigo?: string | undefined;
  readonly centro_coste_nombre?: string | undefined;
  /** Búsqueda libre por código o nombre del centro de coste. */
  readonly centro_coste_busqueda?: string | undefined;
  readonly fecha_asignacion?: string | undefined;
  readonly fecha_desde?: string | undefined;
  readonly fecha_hasta?: string | undefined;
  readonly costo_min?: number | undefined;
  readonly costo_max?: number | undefined;
  readonly tipo_linea?: string | undefined;
  readonly empleado?: string | undefined;
  readonly estado?: string | undefined;
  readonly tipo_uso?: string | undefined;
  readonly sort?: ColumnaOrdenLinea | undefined;
  readonly order?: DireccionOrden | undefined;
  readonly after_id?: string | undefined;
  readonly limit?: number | undefined;
}

/** Cuerpo de creación de línea, en snake_case. */
export interface BodyCrearLinea {
  readonly numero: string;
  readonly numero_original?: string | undefined;
  readonly proveedor?: string | undefined;
  readonly centro_coste_id: string;
  readonly fecha_asignacion?: string | undefined;
  readonly costo_mensual?: number | string | undefined;
  readonly tipo_linea?: string | undefined;
  readonly empleado?: string | null | undefined;
  readonly estado?: string | undefined;
  readonly tipo_uso?: string | undefined;
}

/** Cuerpo de actualización de línea, en snake_case. */
export interface BodyActualizarLinea {
  readonly numero_original?: string | undefined;
  readonly proveedor?: string | undefined;
  readonly centro_coste_id?: string | undefined;
  readonly fecha_asignacion?: string | undefined;
  readonly costo_mensual?: number | string | undefined;
  readonly tipo_linea?: string | undefined;
  readonly empleado?: string | null | undefined;
  readonly estado?: string | undefined;
  readonly tipo_uso?: string | undefined;
}

/** Controlador HTTP de las líneas telefónicas (`RF-LIN-1.1` a `RF-LIN-1.9`). */
export class LineaController {
  constructor(private readonly service: LineaService) {}

  /** Traduce la query HTTP a los filtros del servicio. */
  private filtros(query: QueryLinea): FiltrosLinea {
    return {
      numero: query.numero,
      proveedor: query.proveedor,
      centroCosteId: query.centro_coste_id,
      centroCosteCodigo: query.centro_coste_codigo,
      centroCosteNombre: query.centro_coste_nombre,
      centroCosteBusqueda: this.normalizarBusqueda(query.centro_coste_busqueda),
      fechaAsignacion: query.fecha_asignacion,
      fechaDesde: query.fecha_desde,
      fechaHasta: query.fecha_hasta,
      costoMin: query.costo_min,
      costoMax: query.costo_max,
      ...(query.tipo_linea === undefined
        ? {}
        : { tipoLinea: query.tipo_linea as FiltrosLinea['tipoLinea'] }),
      empleado: query.empleado,
      ...(query.estado === undefined ? {} : { estado: query.estado as FiltrosLinea['estado'] }),
      ...(query.tipo_uso === undefined
        ? {}
        : { tipoUso: query.tipo_uso as FiltrosLinea['tipoUso'] }),
    };
  }

  /** Lista líneas con los 14 filtros, orden y paginación por cursor (`RF-LIN-1.9`). */
  async listar(query: QueryLinea): Promise<PaginaResponse<LineaResponse>> {
    const pagina = await this.service.listar({
      ...this.filtros(query),
      afterId: query.after_id,
      limit: query.limit,
      ...(query.sort === undefined ? {} : { sortColumn: query.sort }),
      ...(query.order === undefined ? {} : { sortOrder: query.order }),
    });

    return toPaginaResponse(pagina, toLineaResponse);
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

  /** Crea una línea (`RF-LIN-1.1`). */
  async crear(body: BodyCrearLinea): Promise<LineaResponse> {
    return toLineaResponse(
      await this.service.crear({
        numero: body.numero,
        numeroOriginal: body.numero_original,
        proveedor: body.proveedor,
        centroCosteId: body.centro_coste_id,
        fechaAsignacion: body.fecha_asignacion,
        costoMensual: body.costo_mensual,
        ...(body.tipo_linea === undefined ? {} : { tipoLinea: body.tipo_linea as 'movil' }),
        empleado: body.empleado,
        ...(body.estado === undefined ? {} : { estado: body.estado as 'activa' }),
        ...(body.tipo_uso === undefined ? {} : { tipoUso: body.tipo_uso as 'personal' }),
      })
    );
  }

  /** Obtiene una línea por id (`RF-LIN-1.2`). */
  async obtener(id: string): Promise<LineaResponse> {
    return toLineaResponse(await this.service.obtener(id));
  }

  /** Actualiza los campos modificables de una línea (`RF-LIN-1.5`). */
  async actualizar(
    id: string,
    body: BodyActualizarLinea,
    versionEsperada?: number
  ): Promise<LineaResponse> {
    return toLineaResponse(
      await this.service.actualizar(
        id,
        {
          numeroOriginal: body.numero_original,
          proveedor: body.proveedor,
          centroCosteId: body.centro_coste_id,
          fechaAsignacion: body.fecha_asignacion,
          costoMensual: body.costo_mensual,
          ...(body.tipo_linea === undefined ? {} : { tipoLinea: body.tipo_linea as 'movil' }),
          empleado: body.empleado,
          ...(body.estado === undefined ? {} : { estado: body.estado as 'activa' }),
          ...(body.tipo_uso === undefined ? {} : { tipoUso: body.tipo_uso as 'personal' }),
        },
        versionEsperada
      )
    );
  }

  /** Cambia el estado de una línea (`RF-LIN-1.6`). */
  async cambiarEstado(id: string, estado: 'activa' | 'baja' | 'pendiente' | 'portabilidad') {
    return toLineaResponse(await this.service.cambiarEstado(id, estado));
  }

  /**
   * Da de baja una línea (baja lógica, `RF-LIN-1.8`).
   *
   * @param versionEsperada versión esperada según la cabecera `If-Match` (`RF-OPT-1.1`).
   */
  async eliminar(id: string, versionEsperada?: number): Promise<LineaResponse> {
    return toLineaResponse(await this.service.eliminar(id, versionEsperada));
  }

  /** Cambia el estado de varias líneas (`RF-LIN-1.7`). */
  async cambiarEstadoMasivo(body: {
    ids: string[];
    estado: 'activa' | 'baja' | 'pendiente' | 'portabilidad';
  }) {
    const resultado = await this.service.cambiarEstadoMasivo(body.ids, body.estado);

    return {
      actualizadas: resultado.actualizadas,
      ignoradas: resultado.ignoradas,
      fallidas: resultado.fallidas,
    };
  }

  /** Exporta las líneas filtradas a CSV/Excel (`RF-LIN-EXP-1.1` a `RF-LIN-EXP-1.4`). */
  async exportar(
    format: FormatoArchivo,
    query: QueryLinea,
    incluirBajas = false
  ): Promise<ArchivoExportado> {
    const lineas = await this.service.exportar(this.filtros(query), incluirBajas);

    const filas = lineas.map((linea) => [
      linea.numero,
      linea.numeroOriginal,
      linea.proveedor,
      linea.centroCosteCodigo,
      linea.centroCosteNombre,
      linea.fechaAsignacion,
      linea.costoMensual,
      linea.tipoLinea,
      linea.empleado,
      linea.estado,
      linea.tipoUso,
      linea.createdAt,
    ]);

    return {
      contenido: construirArchivo([...COLUMNAS_EXPORT_LINEAS], filas, format),
      nombreArchivo: nombreArchivoExport('lineas', format),
      contentType:
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
    };
  }
}

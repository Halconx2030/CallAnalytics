import { ValidationError } from '@domain/errors/DomainError.js';

import type {
  OpcionesImportacionCentros,
  ReporteImportacionLineasDto,
} from '@application/dto/import.dto.js';
import type { ImportService } from '@application/services/import.service.js';

import { PLANTILLA_CENTROS_COSTE, PLANTILLA_LINEAS, construirArchivo } from '../export.js';
import { toReporteImportacionCentrosResponse } from '../respuestas.js';

import type { ArchivoExportado } from '../export.js';
import type { ReporteImportacionCentrosResponse } from '../respuestas.js';

/** Tipos de plantilla descargables (`RF-UI-IMP-1.4`). */
export type TipoPlantilla = 'centros-coste' | 'lineas';

/** Archivo recibido por multipart, ya leído a memoria. */
export interface ArchivoRecibido {
  /** Nombre original del archivo; define el formato (csv/xlsx/xls). */
  readonly nombreArchivo: string;
  /** Contenido binario del archivo. */
  readonly contenido: Buffer;
}

/** Extensiones admitidas para la importación. */
const EXTENSIONES_ADMITIDAS = ['.csv', '.xlsx', '.xls'];

/** Controlador HTTP del módulo de importación (`RF-CC-IMP-*`, `RF-LIN-IMP-*`). */
export class ImportController {
  constructor(private readonly service: ImportService) {}

  /** Valida que haya archivo y que su extensión sea admitida. */
  private exigirArchivo(archivo: ArchivoRecibido | undefined): ArchivoRecibido {
    if (archivo === undefined || archivo.contenido.length === 0) {
      throw new ValidationError('archivo', 'No se recibió ningún archivo para importar');
    }

    const nombre = archivo.nombreArchivo.toLowerCase();
    if (!EXTENSIONES_ADMITIDAS.some((extension) => nombre.endsWith(extension))) {
      throw new ValidationError(
        'archivo',
        `Extensión no admitida (${archivo.nombreArchivo}). Use CSV o Excel (.xlsx)`
      );
    }

    return archivo;
  }

  /**
   * Importa centros de coste desde CSV/Excel (todo-o-nada, `RF-CC-IMP-1.1`).
   *
   * @param opciones `crearFormatosFaltantes` permite crear los formatos que no existan
   * (opción opt-in; por defecto un formato inexistente es un error, `RF-CC-IMP-1.2`).
   */
  async importarCentrosCoste(
    archivo: ArchivoRecibido | undefined,
    opciones: OpcionesImportacionCentros = {}
  ): Promise<ReporteImportacionCentrosResponse> {
    const reporte = await this.service.importarCentrosCoste(this.exigirArchivo(archivo), opciones);

    return toReporteImportacionCentrosResponse(reporte);
  }

  /** Importa líneas desde CSV/Excel (`RF-LIN-IMP-1.1`). */
  async importarLineas(archivo: ArchivoRecibido | undefined): Promise<ReporteImportacionLineasDto> {
    return this.service.importarLineas(this.exigirArchivo(archivo));
  }

  /** Descarga la plantilla CSV de importación (`RF-UI-IMP-1.4`). */
  plantilla(tipo: TipoPlantilla): ArchivoExportado {
    const contenido = tipo === 'centros-coste' ? PLANTILLA_CENTROS_COSTE : PLANTILLA_LINEAS;

    return {
      contenido: construirArchivo(
        tipo === 'centros-coste'
          ? ['codigo', 'nombre', 'formato_nombre']
          : [
              'numero',
              'proveedor',
              'centro_coste_codigo',
              'fecha_asignacion',
              'costo_mensual',
              'tipo_linea',
              'empleado',
              'estado',
              'tipo_uso',
            ],
        // La primera línea de la plantilla es la cabecera y `construirArchivo` ya la escribe,
        // por eso se descarta (`slice(1)`) para no duplicarla. Las líneas vacías se filtran.
        contenido
          .split(/\r?\n/)
          .map((linea) => linea.trim())
          .filter((linea) => linea !== '')
          .slice(1)
          .map((linea) => linea.split(',')),
        'csv'
      ),
      nombreArchivo: `plantilla_${tipo === 'centros-coste' ? 'centros_coste' : 'lineas'}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
}

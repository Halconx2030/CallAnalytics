import type {
  ImportarArchivoDto,
  OpcionesImportacionCentros,
  ReporteImportacionCentrosDto,
  ReporteImportacionLineasDto,
} from '@application/dto/import.dto.js';
import type { SpreadsheetParser } from '@application/ports/file-parser/SpreadsheetParser.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import type { UnidadDeTrabajo } from '@application/ports/repositories/UnidadDeTrabajo.js';

import { ImportCentrosService } from './import-centros.service.js';
import { ImportLineasService } from './import-lineas.service.js';

/**
 * Servicio orquestador de importación de centros de coste y líneas desde CSV/Excel.
 *
 * Delega la lógica específica de cada catálogo en {@link ImportCentrosService} e
 * {@link ImportLineasService} manteniendo intacto el contrato público para controladores y tests.
 */
export class ImportService {
  private readonly importadorCentros: ImportCentrosService;
  private readonly importadorLineas: ImportLineasService;

  constructor(
    parser: SpreadsheetParser,
    formatos: FormatoRepository,
    centrosCoste: CentroCosteRepository,
    lineas: LineaRepository,
    unidadDeTrabajo?: UnidadDeTrabajo
  ) {
    this.importadorCentros = new ImportCentrosService(
      parser,
      formatos,
      centrosCoste,
      unidadDeTrabajo
    );
    this.importadorLineas = new ImportLineasService(parser, centrosCoste, lineas);
  }

  /**
   * Importa centros de coste desde un archivo CSV/Excel (RF-CC-IMP-1.1 a RF-CC-IMP-1.5).
   */
  async importarCentrosCoste(
    dto: ImportarArchivoDto,
    opciones: OpcionesImportacionCentros = {}
  ): Promise<ReporteImportacionCentrosDto> {
    return this.importadorCentros.importar(dto, opciones);
  }

  /**
   * Importa líneas telefónicas desde un archivo CSV/Excel (RF-LIN-IMP-1.1 a RF-LIN-IMP-1.10).
   */
  async importarLineas(dto: ImportarArchivoDto): Promise<ReporteImportacionLineasDto> {
    return this.importadorLineas.importar(dto);
  }
}

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';

import type {
  ErrorImportacionCentroDto,
  ImportarArchivoDto,
  OpcionesImportacionCentros,
  ReporteImportacionCentrosDto,
} from '@application/dto/import.dto.js';
import type {
  FilaSpreadsheet,
  SpreadsheetParser,
} from '@application/ports/file-parser/SpreadsheetParser.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { UnidadDeTrabajo } from '@application/ports/repositories/UnidadDeTrabajo.js';

import {
  describirError,
  exigirColumnasArchivo,
  obtenerCelda,
  sanitizarCelda,
  validarCantidadFilasArchivo,
  validarTamanoArchivo,
} from './import-parsers.js';

/** Columnas obligatorias del archivo de centros de coste (RF-CC-IMP-1.1). */
const COLUMNAS_CENTROS = ['codigo', 'nombre', 'formato_nombre'] as const;

/**
 * Id provisional del formato para validar la entidad antes de crear el formato real.
 */
const ID_FORMATO_PROVISIONAL = '__formato_provisional__';

/** Fila de centros de coste ya validada en memoria. */
interface CandidataCentro {
  readonly fila: number;
  readonly codigo: string;
  readonly nombre: string;
  readonly formatoNombre: string;
}

/** Centro de coste validado en memoria, pendiente de asociar al formato definitivo. */
interface PreparacionCentro {
  readonly candidata: CandidataCentro;
  readonly entidad: CentroCoste;
  readonly formatoPendiente: boolean;
}

/** Resultado del preprocesamiento de las filas del archivo de centros. */
interface PreprocesoCentros {
  readonly candidatas: CandidataCentro[];
  readonly errores: ErrorImportacionCentroDto[];
  readonly nombresFormato: Map<string, string>;
}

/** Caso de uso especializado en la importación de centros de coste. */
export class ImportCentrosService {
  constructor(
    private readonly parser: SpreadsheetParser,
    private readonly formatos: FormatoRepository,
    private readonly centrosCoste: CentroCosteRepository,
    private readonly unidadDeTrabajo?: UnidadDeTrabajo
  ) {}

  async importar(
    dto: ImportarArchivoDto,
    opciones: OpcionesImportacionCentros = {}
  ): Promise<ReporteImportacionCentrosDto> {
    validarTamanoArchivo(dto.contenido);

    const { filas, columnas } = await this.parser.parsear(dto.contenido, dto.nombreArchivo);

    exigirColumnasArchivo(columnas, COLUMNAS_CENTROS);
    validarCantidadFilasArchivo(filas.length);

    const crearFormatosFaltantes =
      opciones.crearFormatosFaltantes ?? dto.crearFormatosFaltantes ?? false;

    const { candidatas, errores, nombresFormato } = this.preprocesarFilas(filas);

    if (errores.length > 0) {
      return { insertados: 0, duplicados: 0, errores, formatosCreados: [] };
    }

    if (crearFormatosFaltantes && this.unidadDeTrabajo !== undefined) {
      return this.unidadDeTrabajo.ejecutar((repos) =>
        this.guardarCentrosCoste(
          repos.formatos,
          repos.centrosCoste,
          candidatas,
          nombresFormato,
          true
        )
      );
    }

    return this.guardarCentrosCoste(
      this.formatos,
      this.centrosCoste,
      candidatas,
      nombresFormato,
      crearFormatosFaltantes
    );
  }

  /** Valida campos obligatorios y duplicados internos en las filas del archivo. */
  private preprocesarFilas(filas: FilaSpreadsheet[]): PreprocesoCentros {
    const errores: ErrorImportacionCentroDto[] = [];
    const candidatas: CandidataCentro[] = [];
    const codigosVistos = new Set<string>();
    const nombresFormato = new Map<string, string>();

    for (const [indice, fila] of filas.entries()) {
      const numeroFila = indice + 2;
      const evaluacion = this.evaluarFilaCentro(fila, numeroFila, codigosVistos);

      if ('motivo' in evaluacion) {
        errores.push(evaluacion);
        continue;
      }

      const claveFormato = evaluacion.formatoNombre.toLowerCase();
      if (!nombresFormato.has(claveFormato)) {
        nombresFormato.set(claveFormato, evaluacion.formatoNombre);
      }

      candidatas.push(evaluacion);
    }

    return { candidatas, errores, nombresFormato };
  }

  /** Evalúa una fila individual de centro de coste en memoria. */
  private evaluarFilaCentro(
    fila: FilaSpreadsheet,
    numeroFila: number,
    codigosVistos: Set<string>
  ): CandidataCentro | ErrorImportacionCentroDto {
    const codigo = sanitizarCelda(obtenerCelda(fila, 'codigo'));
    const nombre = sanitizarCelda(obtenerCelda(fila, 'nombre'));
    const formatoNombre = sanitizarCelda(obtenerCelda(fila, 'formato_nombre'));

    const motivoFaltante = validarCamposObligatoriosCentro(codigo, nombre, formatoNombre);
    if (motivoFaltante !== null) {
      return { fila: numeroFila, codigo, motivo: motivoFaltante };
    }

    const clave = codigo.toLowerCase();
    if (codigosVistos.has(clave)) {
      return {
        fila: numeroFila,
        codigo,
        motivo: 'el código está duplicado dentro del archivo',
      };
    }

    codigosVistos.add(clave);
    return { fila: numeroFila, codigo, nombre, formatoNombre };
  }

  /** Resuelve formatos, verifica duplicados en BD y persiste los centros de coste. */
  private async guardarCentrosCoste(
    formatos: FormatoRepository,
    centrosCoste: CentroCosteRepository,
    candidatas: CandidataCentro[],
    nombresFormato: Map<string, string>,
    crearFormatosFaltantes: boolean
  ): Promise<ReporteImportacionCentrosDto> {
    const [formatosEncontrados, centrosExistentes] = await Promise.all([
      formatos.buscarPorNombres([...nombresFormato.keys()]),
      centrosCoste.buscarPorCodigos(candidatas.map((candidata) => candidata.codigo)),
    ]);

    const formatosPorNombre = new Map(
      formatosEncontrados.map((formato) => [formato.nombre.toLowerCase(), formato])
    );
    const codigosExistentes = new Set(
      centrosExistentes.map((centro) => centro.codigo.toLowerCase())
    );

    const { preparacion, errores, duplicados } = this.prepararEntidadesCentro(
      candidatas,
      formatosPorNombre,
      codigosExistentes,
      crearFormatosFaltantes
    );

    if (errores.length > 0 || duplicados > 0) {
      return { insertados: 0, duplicados, errores, formatosCreados: [] };
    }

    const formatosCreados = await this.crearFormatosPendientes(
      formatos,
      nombresFormato,
      formatosPorNombre
    );

    const entidades = preparacion.map(({ candidata, entidad, formatoPendiente }) => {
      if (!formatoPendiente) {
        return entidad;
      }
      const formato = formatosPorNombre.get(candidata.formatoNombre.toLowerCase());
      return entidad.cambiarFormato(formato?.id ?? '');
    });

    const insertados = await centrosCoste.crearMuchos(entidades);
    return { insertados: insertados.length, duplicados: 0, errores: [], formatosCreados };
  }

  /** Construye las entidades de centro de coste o registra errores de referencia/duplicado. */
  private prepararEntidadesCentro(
    candidatas: CandidataCentro[],
    formatosPorNombre: Map<string, Formato>,
    codigosExistentes: Set<string>,
    crearFormatosFaltantes: boolean
  ): {
    preparacion: PreparacionCentro[];
    errores: ErrorImportacionCentroDto[];
    duplicados: number;
  } {
    const preparacion: PreparacionCentro[] = [];
    const errores: ErrorImportacionCentroDto[] = [];
    let duplicados = 0;

    for (const candidata of candidatas) {
      const formato = formatosPorNombre.get(candidata.formatoNombre.toLowerCase());
      const errorFormato = validarReferenciaFormato(candidata, formato, crearFormatosFaltantes);

      if (errorFormato !== null) {
        errores.push(errorFormato);
        continue;
      }

      if (codigosExistentes.has(candidata.codigo.toLowerCase())) {
        duplicados += 1;
        errores.push({
          fila: candidata.fila,
          codigo: candidata.codigo,
          motivo: 'ya existe un centro de coste con este código',
        });
        continue;
      }

      try {
        preparacion.push({
          candidata,
          entidad: CentroCoste.crearCentroCoste({
            codigo: candidata.codigo,
            nombre: candidata.nombre,
            formatoId: formato === undefined ? ID_FORMATO_PROVISIONAL : (formato.id ?? ''),
          }),
          formatoPendiente: formato === undefined,
        });
      } catch (error) {
        errores.push({
          fila: candidata.fila,
          codigo: candidata.codigo,
          motivo: describirError(error),
        });
      }
    }

    return { preparacion, errores, duplicados };
  }

  /** Crea los formatos que no existían en la base de datos y actualiza el mapa en memoria. */
  private async crearFormatosPendientes(
    formatos: FormatoRepository,
    nombresFormato: Map<string, string>,
    formatosPorNombre: Map<string, Formato>
  ): Promise<string[]> {
    const formatosCreados: string[] = [];

    for (const [clave, nombre] of nombresFormato) {
      if (!formatosPorNombre.has(clave)) {
        const creado = await formatos.crear(Formato.crearFormato({ nombre }));
        formatosPorNombre.set(clave, creado);
        formatosCreados.push(nombre);
      }
    }

    return formatosCreados;
  }
}

/** Verifica que los tres campos requeridos del centro de coste no estén vacíos. */
function validarCamposObligatoriosCentro(
  codigo: string,
  nombre: string,
  formatoNombre: string
): string | null {
  if (codigo === '') {
    return 'falta el código del centro de coste';
  }
  if (nombre === '') {
    return 'falta el nombre del centro de coste';
  }
  if (formatoNombre === '') {
    return 'falta el nombre del formato';
  }
  return null;
}

/** Valida que el formato exista o pueda crearse válidamente. */
function validarReferenciaFormato(
  candidata: CandidataCentro,
  formato: Formato | undefined,
  crearFormatosFaltantes: boolean
): ErrorImportacionCentroDto | null {
  if (formato !== undefined) {
    return null;
  }

  if (!crearFormatosFaltantes) {
    return {
      fila: candidata.fila,
      codigo: candidata.codigo,
      motivo: `el formato "${candidata.formatoNombre}" no existe; créalo en "Formatos y centros" o activa la creación automática`,
    };
  }

  if (!formatoEsValido(candidata.formatoNombre)) {
    return {
      fila: candidata.fila,
      codigo: candidata.codigo,
      motivo: `el formato "${candidata.formatoNombre}" no es válido`,
    };
  }

  return null;
}

/** Indica si el nombre de un formato es válido para poder crearlo. */
function formatoEsValido(nombre: string): boolean {
  try {
    Formato.crearFormato({ nombre });
    return true;
  } catch {
    return false;
  }
}

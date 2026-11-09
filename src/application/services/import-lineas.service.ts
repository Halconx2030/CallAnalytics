import type { CentroCoste } from '@domain/entities/CentroCoste.js';
import {
  ESTADOS_LINEA,
  LineaTelefonica,
  TIPOS_LINEA,
  TIPOS_USO,
  type EstadoLinea,
  type TipoUso,
} from '@domain/entities/LineaTelefonica.js';
import { normalizePhone, type TipoLinea } from '@domain/value-objects/PhoneNumber.js';

import type {
  DuplicadoImportacionLineaDto,
  ErrorImportacionLineaDto,
  ImportarArchivoDto,
  ReporteImportacionLineasDto,
} from '@application/dto/import.dto.js';
import type {
  FilaSpreadsheet,
  SpreadsheetParser,
} from '@application/ports/file-parser/SpreadsheetParser.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';

import {
  describirError,
  exigirColumnasArchivo,
  obtenerCelda,
  parsearDecimal,
  parsearFecha,
  sanitizarCelda,
  validarCantidadFilasArchivo,
  validarTamanoArchivo,
} from './import-parsers.js';

/** Columnas obligatorias del archivo de líneas: solo el número (RF-LIN-IMP-1.4). */
const COLUMNAS_LINEAS = ['numero'] as const;

/** Fila de línea ya validada en memoria. */
interface CandidataLinea {
  readonly fila: number;
  readonly numeroOriginal: string;
  readonly numero: string;
  readonly centroCosteCodigo: string;
  readonly centroCosteId: string;
  readonly fechaAsignacion: string | undefined;
  readonly costoMensual: string | undefined;
  readonly tipoLinea: TipoLinea | undefined;
  readonly proveedor: string;
  readonly empleado: string | null;
  readonly estado: EstadoLinea | undefined;
  readonly tipoUso: TipoUso | undefined;
}

/** Resultado del preprocesamiento de las filas del archivo de líneas. */
interface PreprocesoLineas {
  readonly candidatas: CandidataLinea[];
  readonly errores: ErrorImportacionLineaDto[];
  readonly duplicados: DuplicadoImportacionLineaDto[];
  readonly codigosCentro: Set<string>;
}

/** Caso de uso especializado en la importación de líneas telefónicas. */
export class ImportLineasService {
  constructor(
    private readonly parser: SpreadsheetParser,
    private readonly centrosCoste: CentroCosteRepository,
    private readonly lineas: LineaRepository
  ) {}

  async importar(dto: ImportarArchivoDto): Promise<ReporteImportacionLineasDto> {
    validarTamanoArchivo(dto.contenido);

    const { filas, columnas } = await this.parser.parsear(dto.contenido, dto.nombreArchivo);

    exigirColumnasArchivo(columnas, COLUMNAS_LINEAS);
    validarCantidadFilasArchivo(filas.length);

    const { candidatas, errores, duplicados, codigosCentro } = this.preprocesarFilas(filas);

    const [centrosEncontrados, lineasExistentes] = await Promise.all([
      codigosCentro.size > 0
        ? this.centrosCoste.buscarPorCodigos([...codigosCentro])
        : Promise.resolve([]),
      candidatas.length > 0
        ? this.lineas.buscarPorNumeros(candidatas.map((candidata) => candidata.numero))
        : Promise.resolve([]),
    ]);

    const centrosPorCodigo = new Map(
      centrosEncontrados.map((centro) => [centro.codigo.toLowerCase(), centro])
    );
    const numerosExistentes = new Set(lineasExistentes.map((linea) => linea.numero));

    const entidades = await this.construirEntidadesLinea(
      candidatas,
      centrosPorCodigo,
      numerosExistentes,
      errores,
      duplicados
    );

    if (errores.length > 0) {
      return { insertados: 0, duplicados, errores };
    }

    const insertados = entidades.length > 0 ? await this.lineas.crearMuchas(entidades) : [];
    return { insertados: insertados.length, duplicados, errores: [] };
  }

  /** Analiza cada fila del archivo en memoria separando candidatas, duplicados y errores. */
  private preprocesarFilas(filas: FilaSpreadsheet[]): PreprocesoLineas {
    const errores: ErrorImportacionLineaDto[] = [];
    const duplicados: DuplicadoImportacionLineaDto[] = [];
    const candidatas: CandidataLinea[] = [];
    const numerosVistos = new Set<string>();
    const codigosCentro = new Set<string>();

    for (const [indice, fila] of filas.entries()) {
      const numeroFila = indice + 2;
      const evaluacion = evaluarFilaLinea(fila, numeroFila);

      if ('error' in evaluacion) {
        errores.push(evaluacion.error);
        continue;
      }

      const candidata = evaluacion.candidata;
      if (candidata.centroCosteCodigo !== '') {
        codigosCentro.add(candidata.centroCosteCodigo.toLowerCase());
      }

      if (numerosVistos.has(candidata.numero)) {
        duplicados.push({
          fila: numeroFila,
          numero: candidata.numero,
          motivo: 'el número ya aparece en el archivo',
        });
        continue;
      }

      numerosVistos.add(candidata.numero);
      candidatas.push(candidata);
    }

    return { candidatas, errores, duplicados, codigosCentro };
  }

  /** Resuelve referencias contra la base de datos y crea las instancias de `LineaTelefonica`. */
  private async construirEntidadesLinea(
    candidatas: CandidataLinea[],
    centrosPorCodigo: Map<string, CentroCoste>,
    numerosExistentes: Set<string>,
    errores: ErrorImportacionLineaDto[],
    duplicados: DuplicadoImportacionLineaDto[]
  ): Promise<LineaTelefonica[]> {
    const entidades: LineaTelefonica[] = [];

    for (const candidata of candidatas) {
      const centro = await this.resolverCentroCoste(candidata, centrosPorCodigo);

      if (centro === null) {
        const referencia =
          candidata.centroCosteCodigo !== ''
            ? candidata.centroCosteCodigo
            : candidata.centroCosteId;
        errores.push({
          fila: candidata.fila,
          numero: candidata.numeroOriginal,
          motivo: `el centro de coste "${referencia}" no existe`,
        });
        continue;
      }

      if (numerosExistentes.has(candidata.numero)) {
        duplicados.push({
          fila: candidata.fila,
          numero: candidata.numero,
          motivo: 'el número ya existe en la base de datos',
        });
        continue;
      }

      try {
        entidades.push(crearEntidadDesdeCandidata(candidata, centro.id ?? ''));
      } catch (error) {
        errores.push({
          fila: candidata.fila,
          numero: candidata.numeroOriginal,
          motivo: describirError(error),
        });
      }
    }

    return entidades;
  }

  /** Obtiene el centro de coste por id o desde el mapa de códigos precargado. */
  private async resolverCentroCoste(
    candidata: CandidataLinea,
    centrosPorCodigo: Map<string, CentroCoste>
  ): Promise<CentroCoste | null> {
    if (candidata.centroCosteId !== '') {
      return this.centrosCoste.buscarPorId(candidata.centroCosteId);
    }
    return centrosPorCodigo.get(candidata.centroCosteCodigo.toLowerCase()) ?? null;
  }
}

/** Evalúa una fila individual del archivo de líneas y devuelve la candidata o el primer error. */
function evaluarFilaLinea(
  fila: FilaSpreadsheet,
  numeroFila: number
): { candidata: CandidataLinea } | { error: ErrorImportacionLineaDto } {
  const numeroOriginal = obtenerCelda(fila, 'numero');
  if (numeroOriginal === '') {
    return { error: { fila: numeroFila, numero: '', motivo: 'falta el número' } };
  }

  const numero = intentarNormalizarTelefono(numeroOriginal);
  if (numero === null) {
    return {
      error: {
        fila: numeroFila,
        numero: numeroOriginal,
        motivo: 'el número no es un teléfono chileno válido',
      },
    };
  }

  const centroCosteCodigo = obtenerCelda(fila, 'centro_coste_codigo');
  const centroCosteId = obtenerCelda(fila, 'centro_coste_id');
  if (centroCosteCodigo === '' && centroCosteId === '') {
    return {
      error: {
        fila: numeroFila,
        numero: numeroOriginal,
        motivo: 'falta el centro de coste (centro_coste_codigo)',
      },
    };
  }

  return construirAtributosCandidata(fila, {
    fila: numeroFila,
    numeroOriginal,
    numero,
    centroCosteCodigo,
    centroCosteId,
  });
}

/** Valida los campos opcionales de la fila (fecha, costo y enumeraciones) y arma la candidata. */
function construirAtributosCandidata(
  fila: FilaSpreadsheet,
  base: {
    fila: number;
    numeroOriginal: string;
    numero: string;
    centroCosteCodigo: string;
    centroCosteId: string;
  }
): { candidata: CandidataLinea } | { error: ErrorImportacionLineaDto } {
  const fecha = validarCeldaFecha(obtenerCelda(fila, 'fecha_asignacion'));
  if ('motivo' in fecha) {
    return { error: { fila: base.fila, numero: base.numeroOriginal, motivo: fecha.motivo } };
  }

  const costo = validarCeldaCosto(obtenerCelda(fila, 'costo_mensual'));
  if ('motivo' in costo) {
    return { error: { fila: base.fila, numero: base.numeroOriginal, motivo: costo.motivo } };
  }

  const enums = validarCeldasEnumeradas(fila);
  if ('motivo' in enums) {
    return { error: { fila: base.fila, numero: base.numeroOriginal, motivo: enums.motivo } };
  }

  const empleadoBruto = sanitizarCelda(obtenerCelda(fila, 'empleado'));

  return {
    candidata: {
      ...base,
      fechaAsignacion: fecha.valor,
      costoMensual: costo.valor,
      tipoLinea: enums.tipoLinea,
      proveedor: sanitizarCelda(obtenerCelda(fila, 'proveedor')),
      empleado: empleadoBruto === '' ? null : empleadoBruto,
      estado: enums.estado,
      tipoUso: enums.tipoUso,
    },
  };
}

/** Normaliza un teléfono devolviendo `null` cuando no es válido. */
function intentarNormalizarTelefono(numeroOriginal: string): string | null {
  try {
    return normalizePhone(numeroOriginal).normalized;
  } catch {
    return null;
  }
}

/** Valida la celda `fecha_asignacion`. */
function validarCeldaFecha(fechaBruta: string): { valor: string | undefined } | { motivo: string } {
  if (fechaBruta === '') {
    return { valor: undefined };
  }
  const fecha = parsearFecha(fechaBruta);
  if (fecha === null) {
    return { motivo: `fecha_asignacion inválida ("${fechaBruta}")` };
  }
  return { valor: fecha };
}

/** Valida la celda `costo_mensual`. */
function validarCeldaCosto(costoBruto: string): { valor: string | undefined } | { motivo: string } {
  if (costoBruto === '') {
    return { valor: undefined };
  }
  const valor = parsearDecimal(costoBruto);
  if (valor === null) {
    return { motivo: `costo_mensual inválido ("${costoBruto}")` };
  }
  if (valor < 0) {
    return { motivo: 'costo_mensual no puede ser negativo' };
  }
  return { valor: String(valor) };
}

/** Valida las columnas enumeradas `tipo_linea`, `estado` y `tipo_uso`. */
function validarCeldasEnumeradas(fila: FilaSpreadsheet):
  | {
      tipoLinea: TipoLinea | undefined;
      estado: EstadoLinea | undefined;
      tipoUso: TipoUso | undefined;
    }
  | { motivo: string } {
  const tipoLinea = validarOpcionEnum(obtenerCelda(fila, 'tipo_linea'), TIPOS_LINEA, 'tipo_linea');
  if ('motivo' in tipoLinea) {
    return tipoLinea;
  }

  const estado = validarOpcionEnum(obtenerCelda(fila, 'estado'), ESTADOS_LINEA, 'estado');
  if ('motivo' in estado) {
    return estado;
  }

  const tipoUso = validarOpcionEnum(obtenerCelda(fila, 'tipo_uso'), TIPOS_USO, 'tipo_uso');
  if ('motivo' in tipoUso) {
    return tipoUso;
  }

  return {
    tipoLinea: tipoLinea.valor,
    estado: estado.valor,
    tipoUso: tipoUso.valor,
  };
}

/** Valida un valor opcional contra una lista cerrada de opciones en minúsculas. */
function validarOpcionEnum<T extends string>(
  bruto: string,
  permitidos: readonly T[],
  nombreCampo: string
): { valor: T | undefined } | { motivo: string } {
  const normalizado = bruto.toLowerCase();
  if (normalizado === '') {
    return { valor: undefined };
  }
  if (!permitidos.includes(normalizado as T)) {
    return {
      motivo: `${nombreCampo} inválido ("${normalizado}"). Se admiten: ${permitidos.join(', ')}`,
    };
  }
  return { valor: normalizado as T };
}

/** Instancia `LineaTelefonica` omitiendo los atributos opcionales no informados. */
function crearEntidadDesdeCandidata(
  candidata: CandidataLinea,
  centroCosteId: string
): LineaTelefonica {
  return LineaTelefonica.crearLineaTelefonica({
    numero: candidata.numeroOriginal,
    centroCosteId,
    ...(candidata.fechaAsignacion === undefined
      ? {}
      : { fechaAsignacion: candidata.fechaAsignacion }),
    ...(candidata.costoMensual === undefined ? {} : { costoMensual: candidata.costoMensual }),
    ...(candidata.tipoLinea === undefined ? {} : { tipoLinea: candidata.tipoLinea }),
    ...(candidata.proveedor === '' ? {} : { proveedor: candidata.proveedor }),
    ...(candidata.empleado === null ? {} : { empleado: candidata.empleado }),
    ...(candidata.estado === undefined ? {} : { estado: candidata.estado }),
    ...(candidata.tipoUso === undefined ? {} : { tipoUso: candidata.tipoUso }),
  });
}

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import {
  ESTADOS_LINEA,
  LineaTelefonica,
  TIPOS_LINEA,
  TIPOS_USO,
  type EstadoLinea,
  type TipoUso,
} from '@domain/entities/LineaTelefonica.js';
import { ValidationError } from '@domain/errors/DomainError.js';
import { normalizePhone, type TipoLinea } from '@domain/value-objects/PhoneNumber.js';

import type {
  DuplicadoImportacionLineaDto,
  ErrorImportacionCentroDto,
  ErrorImportacionLineaDto,
  ImportarArchivoDto,
  OpcionesImportacionCentros,
  ReporteImportacionCentrosDto,
  ReporteImportacionLineasDto,
} from '@application/dto/import.dto.js';
import { MAX_BYTES_ARCHIVO, MAX_FILAS_ARCHIVO } from '@application/dto/import.dto.js';
import type {
  FilaSpreadsheet,
  SpreadsheetParser,
} from '@application/ports/file-parser/SpreadsheetParser.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import type { UnidadDeTrabajo } from '@application/ports/repositories/UnidadDeTrabajo.js';

/** Columnas obligatorias del archivo de centros de coste (RF-CC-IMP-1.1). */
const COLUMNAS_CENTROS = ['codigo', 'nombre', 'formato_nombre'] as const;

/** Columnas obligatorias del archivo de líneas: solo el número (RF-LIN-IMP-1.4). */
const COLUMNAS_LINEAS = ['numero'] as const;

/** Prefijos que Excel/CSV interpretan como fórmula (regla de sanitización). */
const PREFIJOS_PELIGROSOS = /^[=+\-@]/;

/**
 * Id provisional del formato para validar la entidad antes de crear el formato real.
 *
 * Se usa solo mientras la validación ocurre en memoria; antes de guardar los centros se
 * reemplaza por el id del formato creado.
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
  /** `true` si el formato todavía no existe y se creará durante la importación. */
  readonly formatoPendiente: boolean;
}

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

/**
 * Servicio de importación de centros de coste y líneas desde CSV/Excel.
 *
 * Reglas:
 * - Importación de centros de coste: **todo-o-nada** (RF-CC-IMP-1.2 y RF-CC-IMP-1.3).
 * - Importación de líneas: los duplicados no bloquean, pero cualquier error de validación
 *   cancela toda la importación (RF-LIN-IMP-1.9).
 * - Límites: 10 MB y 50.000 filas por archivo (RF-CC-IMP-1.5, RF-LIN-IMP-1.10).
 * - Las celdas de texto que empiezan por `=`, `+`, `-` o `@` se sanitizan con un apóstrofo
 *   para evitar la inyección de fórmulas al exportar.
 */
export class ImportService {
  constructor(
    private readonly parser: SpreadsheetParser,
    private readonly formatos: FormatoRepository,
    private readonly centrosCoste: CentroCosteRepository,
    private readonly lineas: LineaRepository,
    private readonly unidadDeTrabajo?: UnidadDeTrabajo
  ) {}

  /**
   * Importa centros de coste desde un archivo CSV/Excel (RF-CC-IMP-1.1 a RF-CC-IMP-1.5).
   *
   * Si alguna fila tiene un error (formato inexistente, código duplicado en la base de datos
   * o duplicado dentro del archivo) no se inserta ninguna fila.
   *
   * @param opciones `crearFormatosFaltantes` (opt-in) crea los formatos que no existan en
   * la base de datos; por defecto un formato inexistente es un error (RF-CC-IMP-1.2).
   */
  async importarCentrosCoste(
    dto: ImportarArchivoDto,
    opciones: OpcionesImportacionCentros = {}
  ): Promise<ReporteImportacionCentrosDto> {
    this.validarTamano(dto.contenido);

    const { filas, columnas } = await this.parser.parsear(dto.contenido, dto.nombreArchivo);

    this.exigirColumnas(columnas, COLUMNAS_CENTROS);
    this.validarCantidadFilas(filas.length);

    const crearFormatosFaltantes =
      opciones.crearFormatosFaltantes ?? dto.crearFormatosFaltantes ?? false;

    const errores: ErrorImportacionCentroDto[] = [];
    const candidatas: CandidataCentro[] = [];
    const codigosVistos = new Set<string>();
    /** Nombre del formato en minúsculas -> nombre tal como aparece en el archivo. */
    const nombresFormato = new Map<string, string>();

    for (const [indice, fila] of filas.entries()) {
      const numeroFila = indice + 2;
      const codigo = sanitizar(obtenerCelda(fila, 'codigo'));
      const nombre = sanitizar(obtenerCelda(fila, 'nombre'));
      const formatoNombre = sanitizar(obtenerCelda(fila, 'formato_nombre'));

      if (codigo === '') {
        errores.push({ fila: numeroFila, codigo, motivo: 'falta el código del centro de coste' });
        continue;
      }
      if (nombre === '') {
        errores.push({ fila: numeroFila, codigo, motivo: 'falta el nombre del centro de coste' });
        continue;
      }
      if (formatoNombre === '') {
        errores.push({ fila: numeroFila, codigo, motivo: 'falta el nombre del formato' });
        continue;
      }

      const clave = codigo.toLowerCase();

      if (codigosVistos.has(clave)) {
        errores.push({
          fila: numeroFila,
          codigo,
          motivo: 'el código está duplicado dentro del archivo',
        });
        continue;
      }

      codigosVistos.add(clave);

      const claveFormato = formatoNombre.toLowerCase();

      if (!nombresFormato.has(claveFormato)) {
        nombresFormato.set(claveFormato, formatoNombre);
      }

      candidatas.push({ fila: numeroFila, codigo, nombre, formatoNombre });
    }

    if (errores.length > 0) {
      return { insertados: 0, duplicados: 0, errores, formatosCreados: [] };
    }

    if (crearFormatosFaltantes && this.unidadDeTrabajo !== undefined) {
      // Los formatos que faltan y los centros de coste se guardan en la misma transacción.
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

  /**
   * Resuelve los formatos del archivo, valida las filas y guarda los centros de coste.
   *
   * Todo-o-nada: si alguna fila tiene un error no se inserta ninguna (RF-CC-IMP-1.2/1.3).
   * Cuando `crearFormatosFaltantes` es `true`, los formatos que no existan se crean
   * antes de insertar los centros (en la misma transacción, si hay unidad de trabajo).
   */
  private async guardarCentrosCoste(
    formatos: FormatoRepository,
    centrosCoste: CentroCosteRepository,
    candidatas: CandidataCentro[],
    nombresFormato: Map<string, string>,
    crearFormatosFaltantes: boolean
  ): Promise<ReporteImportacionCentrosDto> {
    const errores: ErrorImportacionCentroDto[] = [];
    let duplicados = 0;

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

    /** Formatos del archivo que todavía no existen: clave (minúsculas) -> nombre del archivo. */
    const formatosFaltantes = new Map<string, string>();

    for (const [clave, nombre] of nombresFormato) {
      if (!formatosPorNombre.has(clave)) {
        formatosFaltantes.set(clave, nombre);
      }
    }

    const preparacion: PreparacionCentro[] = [];

    for (const candidata of candidatas) {
      const claveFormato = candidata.formatoNombre.toLowerCase();
      const formato = formatosPorNombre.get(claveFormato);

      if (formato === undefined && !crearFormatosFaltantes) {
        errores.push({
          fila: candidata.fila,
          codigo: candidata.codigo,
          motivo: `el formato "${candidata.formatoNombre}" no existe; créalo en "Formatos y centros" o activa la creación automática`,
        });
        continue;
      }

      if (formato === undefined && !this.formatoEsValido(candidata.formatoNombre)) {
        errores.push({
          fila: candidata.fila,
          codigo: candidata.codigo,
          motivo: `el formato "${candidata.formatoNombre}" no es válido`,
        });
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
            // Si el formato se creará más adelante se usa un id provisional, que se
            // reemplaza por el id real antes de guardar los centros.
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

    if (errores.length > 0 || duplicados > 0) {
      return { insertados: 0, duplicados, errores, formatosCreados: [] };
    }

    const formatosCreados: string[] = [];

    for (const [clave, nombre] of formatosFaltantes) {
      const creado = await formatos.crear(Formato.crearFormato({ nombre }));

      formatosPorNombre.set(clave, creado);
      formatosCreados.push(nombre);
    }

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

  /** Indica si el nombre de un formato es válido para poder crearlo. */
  private formatoEsValido(nombre: string): boolean {
    try {
      Formato.crearFormato({ nombre });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Importa líneas telefónicas desde un archivo CSV/Excel (RF-LIN-IMP-1.1 a RF-LIN-IMP-1.10).
   *
   * Solo se insertan los números que no existen (RF-LIN-IMP-1.2); los duplicados se reportan
   * pero no bloquean (RF-LIN-IMP-1.9). Si alguna fila tiene un error de validación, no se
   * inserta ninguna línea.
   */
  async importarLineas(dto: ImportarArchivoDto): Promise<ReporteImportacionLineasDto> {
    this.validarTamano(dto.contenido);

    const { filas, columnas } = await this.parser.parsear(dto.contenido, dto.nombreArchivo);

    this.exigirColumnas(columnas, COLUMNAS_LINEAS);
    this.validarCantidadFilas(filas.length);

    const errores: ErrorImportacionLineaDto[] = [];
    const duplicados: DuplicadoImportacionLineaDto[] = [];
    const candidatas: CandidataLinea[] = [];
    const numerosVistos = new Set<string>();
    const codigosCentro = new Set<string>();

    for (const [indice, fila] of filas.entries()) {
      const numeroFila = indice + 2;
      const numeroOriginal = obtenerCelda(fila, 'numero');

      if (numeroOriginal === '') {
        errores.push({ fila: numeroFila, numero: '', motivo: 'falta el número' });
        continue;
      }

      let numero: string;

      try {
        numero = normalizePhone(numeroOriginal).normalized;
      } catch {
        errores.push({
          fila: numeroFila,
          numero: numeroOriginal,
          motivo: 'el número no es un teléfono chileno válido',
        });
        continue;
      }

      const centroCosteCodigo = obtenerCelda(fila, 'centro_coste_codigo');
      const centroCosteId = obtenerCelda(fila, 'centro_coste_id');

      if (centroCosteCodigo === '' && centroCosteId === '') {
        errores.push({
          fila: numeroFila,
          numero: numeroOriginal,
          motivo: 'falta el centro de coste (centro_coste_codigo)',
        });
        continue;
      }

      if (centroCosteCodigo !== '') {
        codigosCentro.add(centroCosteCodigo.toLowerCase());
      }

      const fechaBruta = obtenerCelda(fila, 'fecha_asignacion');
      let fechaAsignacion: string | undefined;

      if (fechaBruta !== '') {
        const fecha = parsearFecha(fechaBruta);

        if (fecha === null) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: `fecha_asignacion inválida ("${fechaBruta}")`,
          });
          continue;
        }

        fechaAsignacion = fecha;
      }

      const costoBruto = obtenerCelda(fila, 'costo_mensual');
      let costoMensual: string | undefined;

      if (costoBruto !== '') {
        const valor = parsearDecimal(costoBruto);

        if (valor === null) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: `costo_mensual inválido ("${costoBruto}")`,
          });
          continue;
        }

        if (valor < 0) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: 'costo_mensual no puede ser negativo',
          });
          continue;
        }

        costoMensual = String(valor);
      }

      const tipoBruto = obtenerCelda(fila, 'tipo_linea').toLowerCase();
      let tipoLinea: TipoLinea | undefined;

      if (tipoBruto !== '') {
        if (!TIPOS_LINEA.includes(tipoBruto as TipoLinea)) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: `tipo_linea inválido ("${tipoBruto}"). Se admiten: ${TIPOS_LINEA.join(', ')}`,
          });
          continue;
        }

        tipoLinea = tipoBruto as TipoLinea;
      }

      const estadoBruto = obtenerCelda(fila, 'estado').toLowerCase();
      let estado: EstadoLinea | undefined;

      if (estadoBruto !== '') {
        if (!ESTADOS_LINEA.includes(estadoBruto as EstadoLinea)) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: `estado inválido ("${estadoBruto}"). Se admiten: ${ESTADOS_LINEA.join(', ')}`,
          });
          continue;
        }

        estado = estadoBruto as EstadoLinea;
      }

      const usoBruto = obtenerCelda(fila, 'tipo_uso').toLowerCase();
      let tipoUso: TipoUso | undefined;

      if (usoBruto !== '') {
        if (!TIPOS_USO.includes(usoBruto as TipoUso)) {
          errores.push({
            fila: numeroFila,
            numero: numeroOriginal,
            motivo: `tipo_uso inválido ("${usoBruto}"). Se admiten: ${TIPOS_USO.join(', ')}`,
          });
          continue;
        }

        tipoUso = usoBruto as TipoUso;
      }

      if (numerosVistos.has(numero)) {
        duplicados.push({
          fila: numeroFila,
          numero,
          motivo: 'el número ya aparece en el archivo',
        });
        continue;
      }

      numerosVistos.add(numero);

      const empleadoBruto = sanitizar(obtenerCelda(fila, 'empleado'));

      candidatas.push({
        fila: numeroFila,
        numeroOriginal,
        numero,
        centroCosteCodigo,
        centroCosteId,
        fechaAsignacion,
        costoMensual,
        tipoLinea,
        proveedor: sanitizar(obtenerCelda(fila, 'proveedor')),
        empleado: empleadoBruto === '' ? null : empleadoBruto,
        estado,
        tipoUso,
      });
    }

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

    const entidades: LineaTelefonica[] = [];

    for (const candidata of candidatas) {
      const centro =
        candidata.centroCosteId !== ''
          ? await this.centrosCoste.buscarPorId(candidata.centroCosteId)
          : centrosPorCodigo.get(candidata.centroCosteCodigo.toLowerCase());

      if (centro === undefined || centro === null) {
        errores.push({
          fila: candidata.fila,
          numero: candidata.numeroOriginal,
          motivo: `el centro de coste "${
            candidata.centroCosteCodigo !== ''
              ? candidata.centroCosteCodigo
              : candidata.centroCosteId
          }" no existe`,
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
        entidades.push(
          LineaTelefonica.crearLineaTelefonica({
            numero: candidata.numeroOriginal,
            centroCosteId: centro.id ?? '',
            ...(candidata.fechaAsignacion === undefined
              ? {}
              : { fechaAsignacion: candidata.fechaAsignacion }),
            ...(candidata.costoMensual === undefined
              ? {}
              : { costoMensual: candidata.costoMensual }),
            ...(candidata.tipoLinea === undefined ? {} : { tipoLinea: candidata.tipoLinea }),
            ...(candidata.proveedor === '' ? {} : { proveedor: candidata.proveedor }),
            ...(candidata.empleado === null ? {} : { empleado: candidata.empleado }),
            ...(candidata.estado === undefined ? {} : { estado: candidata.estado }),
            ...(candidata.tipoUso === undefined ? {} : { tipoUso: candidata.tipoUso }),
          })
        );
      } catch (error) {
        errores.push({
          fila: candidata.fila,
          numero: candidata.numeroOriginal,
          motivo: describirError(error),
        });
      }
    }

    if (errores.length > 0) {
      return { insertados: 0, duplicados, errores };
    }

    const insertados = entidades.length > 0 ? await this.lineas.crearMuchas(entidades) : [];

    return { insertados: insertados.length, duplicados, errores: [] };
  }

  /** Valida el tamaño máximo del archivo (10 MB). */
  private validarTamano(contenido: Buffer): void {
    if (contenido.length > MAX_BYTES_ARCHIVO) {
      throw new ValidationError(
        'archivo',
        `el archivo supera el máximo de ${Math.floor(MAX_BYTES_ARCHIVO / (1024 * 1024))} MB`
      );
    }
  }

  /** Valida que el archivo tenga todas las columnas obligatorias. */
  private exigirColumnas(columnas: string[], requeridas: readonly string[]): void {
    const faltantes = requeridas.filter((columna) => !columnas.includes(columna));

    if (faltantes.length > 0) {
      throw new ValidationError(
        'archivo',
        `faltan las columnas obligatorias: ${faltantes.join(', ')}`
      );
    }
  }

  /** Valida la cantidad máxima de filas (50.000). */
  private validarCantidadFilas(cantidad: number): void {
    if (cantidad > MAX_FILAS_ARCHIVO) {
      throw new ValidationError(
        'archivo',
        `el archivo supera el máximo de ${MAX_FILAS_ARCHIVO.toLocaleString('es-CL')} filas`
      );
    }
  }
}

/** Lee una celda del archivo; devuelve cadena vacía si la columna no existe. */
function obtenerCelda(fila: FilaSpreadsheet, columna: string): string {
  const valor = fila[columna];
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Sanitiza una celda de texto: si empieza por `=`, `+`, `-` o `@` se le antepone un
 * apóstrofo para que no se interprete como fórmula.
 */
function sanitizar(valor: string): string {
  return PREFIJOS_PELIGROSOS.test(valor) ? `'${valor}` : valor;
}

/**
 * Interpreta un decimal escrito en el archivo.
 *
 * Acepta `1234.56`, `1234,56`, `1.234,56` y `1,234.56`.
 */
function parsearDecimal(valor: string): number | null {
  const texto = valor.replace(/[$\s\u00a0]/g, '');

  if (texto === '') {
    return null;
  }

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)) {
    return Number(texto.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(texto)) {
    return Number(texto.replace(/,/g, ''));
  }

  if (/^\d+,\d+$/.test(texto)) {
    return Number(texto.replace(',', '.'));
  }

  if (/^\d+(\.\d+)?$/.test(texto)) {
    return Number(texto);
  }

  return null;
}

/**
 * Interpreta una fecha escrita en el archivo.
 *
 * Acepta `YYYY-MM-DD` y el formato chileno `DD/MM/YYYY` (y `DD-MM-YYYY`).
 */
function parsearFecha(valor: string): string | null {
  const texto = valor.trim();

  if (texto === '') {
    return null;
  }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);

  if (iso !== null) {
    return componerFecha(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const latino = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(texto);

  if (latino !== null) {
    return componerFecha(Number(latino[3]), Number(latino[2]), Number(latino[1]));
  }

  return null;
}

/** Construye una fecha `YYYY-MM-DD` verificando que exista en el calendario. */
function componerFecha(anio: number, mes: number, dia: number): string | null {
  if (anio < 1900 || anio > 2999 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }

  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Extrae un mensaje legible de un error de dominio o de infraestructura. */
function describirError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'error inesperado';
}

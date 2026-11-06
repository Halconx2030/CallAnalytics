import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';
import { ValidationError } from '@domain/errors/DomainError.js';

import { MAX_BYTES_ARCHIVO, MAX_FILAS_ARCHIVO } from '@application/dto/import.dto.js';
import type { SpreadsheetParser } from '@application/ports/file-parser/SpreadsheetParser.js';
import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import type { LineaRepository } from '@application/ports/repositories/LineaRepository.js';
import type { UnidadDeTrabajo } from '@application/ports/repositories/UnidadDeTrabajo.js';
import { ImportService } from '@application/services/import.service.js';

const ID_FORMATO = '11111111-1111-1111-1111-111111111111';
const ID_CENTRO = '22222222-2222-2222-2222-222222222222';
const ID_LINEA = '33333333-3333-3333-3333-333333333333';

function formato(nombre: string): Formato {
  return Formato.crearFormato({ nombre }).conId(ID_FORMATO);
}

function centro(codigo: string, nombre = 'Centro'): CentroCoste {
  return CentroCoste.crearCentroCoste({ codigo, nombre, formatoId: ID_FORMATO }).conId(ID_CENTRO);
}

function linea(numero: string): LineaTelefonica {
  return LineaTelefonica.crearLineaTelefonica({ numero, centroCosteId: ID_CENTRO }).conId(ID_LINEA);
}

describe('ImportService', () => {
  let parser: MockProxy<SpreadsheetParser>;
  let formatos: MockProxy<FormatoRepository>;
  let centrosCoste: MockProxy<CentroCosteRepository>;
  let lineas: MockProxy<LineaRepository>;
  let service: ImportService;

  beforeEach(() => {
    parser = mock<SpreadsheetParser>();
    formatos = mock<FormatoRepository>();
    centrosCoste = mock<CentroCosteRepository>();
    lineas = mock<LineaRepository>();
    service = new ImportService(parser, formatos, centrosCoste, lineas);
  });

  describe('importarCentrosCoste', () => {
    it('inserta los centros de coste válidos', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [
          { codigo: '510', nombre: 'RENDIC', formato_nombre: 'SMU' },
          { codigo: 'C059102801', nombre: 'FALABELLA TOTTUS', formato_nombre: 'FALABELLA' },
        ],
      });
      formatos.buscarPorNombres.mockResolvedValue([formato('SMU'), formato('FALABELLA')]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      centrosCoste.crearMuchos.mockImplementation((centros) =>
        Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
      );

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from('codigo,nombre,formato_nombre'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(2);
      expect(reporte.duplicados).toBe(0);
      expect(reporte.errores).toEqual([]);
      expect(centrosCoste.crearMuchos).toHaveBeenCalledTimes(1);
    });

    it('no importa nada si el formato no existe', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [{ codigo: '510', nombre: 'RENDIC', formato_nombre: 'INEXISTENTE' }],
      });
      formatos.buscarPorNombres.mockResolvedValue([]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from('x'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.fila).toBe(2);
      expect(reporte.errores[0]?.motivo).toContain('INEXISTENTE');
      expect(reporte.errores[0]?.motivo).toContain('no existe');
      expect(reporte.formatosCreados).toEqual([]);
      expect(formatos.crear).not.toHaveBeenCalled();
      expect(centrosCoste.crearMuchos).not.toHaveBeenCalled();
    });

    it('reporta los códigos que ya existen en la base de datos y no importa nada', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [
          { codigo: '510', nombre: 'RENDIC', formato_nombre: 'SMU' },
          { codigo: '777', nombre: 'OTRO', formato_nombre: 'SMU' },
        ],
      });
      formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from('x'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.duplicados).toBe(1);
      expect(reporte.errores[0]?.codigo).toBe('510');
      expect(centrosCoste.crearMuchos).not.toHaveBeenCalled();
    });

    it('detecta códigos duplicados dentro del archivo', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [
          { codigo: '510', nombre: 'RENDIC', formato_nombre: 'SMU' },
          { codigo: '510', nombre: 'RENDIC BIS', formato_nombre: 'SMU' },
        ],
      });

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from('x'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.motivo).toContain('duplicado');
    });

    it('exige las columnas obligatorias', async () => {
      parser.parsear.mockResolvedValue({ columnas: ['codigo'], filas: [{ codigo: '510' }] });

      await expect(
        service.importarCentrosCoste({
          contenido: Buffer.from('x'),
          nombreArchivo: 'centros.csv',
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('rechaza archivos de más de 10 MB', async () => {
      await expect(
        service.importarCentrosCoste({
          contenido: Buffer.alloc(MAX_BYTES_ARCHIVO + 1),
          nombreArchivo: 'centros.csv',
        })
      ).rejects.toBeInstanceOf(ValidationError);
      expect(parser.parsear).not.toHaveBeenCalled();
    });

    it('sanitiza las celdas de texto que empiezan con signo de fórmula', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [{ codigo: '510', nombre: '=CMD(calc)', formato_nombre: 'SMU' }],
      });
      formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      centrosCoste.crearMuchos.mockImplementation((centros) =>
        Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
      );

      await service.importarCentrosCoste({
        contenido: Buffer.from('x'),
        nombreArchivo: 'centros.csv',
      });

      const entidades = centrosCoste.crearMuchos.mock.calls[0]?.[0] ?? [];
      expect(entidades[0]?.nombre).toBe("'=CMD(calc)");
    });
  });

  describe('importarCentrosCoste con creación automática de formatos', () => {
    it('crea los formatos que faltan y guarda los centros de coste', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [
          { codigo: '510', nombre: 'RENDIC', formato_nombre: 'SMU' },
          { codigo: '900', nombre: 'ADMINISTRACION', formato_nombre: 'ADMINISTRACION' },
          { codigo: '901', nombre: 'EDUCACION', formato_nombre: 'EDUCACION' },
        ],
      });
      formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      formatos.crear.mockImplementation((item) => Promise.resolve(item.conId(ID_FORMATO)));
      centrosCoste.crearMuchos.mockImplementation((centros) =>
        Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
      );

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(3);
      expect(reporte.duplicados).toBe(0);
      expect(reporte.errores).toEqual([]);
      expect(reporte.formatosCreados).toEqual(['ADMINISTRACION', 'EDUCACION']);

      expect(formatos.crear).toHaveBeenCalledTimes(2);
      const creados = formatos.crear.mock.calls.map(([item]) => item.nombre);
      expect(creados).toEqual(['ADMINISTRACION', 'EDUCACION']);

      expect(centrosCoste.crearMuchos).toHaveBeenCalledTimes(1);
      const entidades = centrosCoste.crearMuchos.mock.calls[0]?.[0] ?? [];
      expect(entidades).toHaveLength(3);
      expect(entidades.every((entidad) => entidad.formatoId === ID_FORMATO)).toBe(true);
    });

    it('no crea formatos si la importación tiene errores', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [
          { codigo: '510', nombre: 'RENDIC', formato_nombre: 'SMU' },
          { codigo: '777', nombre: 'OTRO', formato_nombre: 'INEXISTENTE' },
        ],
      });
      formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(0);
      expect(reporte.formatosCreados).toEqual([]);
      expect(formatos.crear).not.toHaveBeenCalled();
      expect(centrosCoste.crearMuchos).not.toHaveBeenCalled();
    });

    it('recorta el nombre del formato del archivo', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [{ codigo: '900', nombre: 'OTROS', formato_nombre: 'OTROS ' }],
      });
      formatos.buscarPorNombres.mockResolvedValue([]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      formatos.crear.mockImplementation((item) => Promise.resolve(item.conId(ID_FORMATO)));
      centrosCoste.crearMuchos.mockImplementation((centros) =>
        Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
      );

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(1);
      expect(reporte.formatosCreados).toEqual(['OTROS']);
      expect(formatos.crear.mock.calls[0]?.[0]?.nombre).toBe('OTROS');
    });

    it('no crea el formato si el nombre no es válido', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [{ codigo: '900', nombre: 'LARGO', formato_nombre: 'X'.repeat(120) }],
      });
      formatos.buscarPorNombres.mockResolvedValue([]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.motivo).toContain('no es válido');
      expect(formatos.crear).not.toHaveBeenCalled();
    });

    it('usa la unidad de trabajo para crear los formatos y los centros juntos', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['codigo', 'nombre', 'formato_nombre'],
        filas: [{ codigo: '900', nombre: 'ADMIN', formato_nombre: 'ADMINISTRACION' }],
      });
      formatos.buscarPorNombres.mockResolvedValue([]);
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      formatos.crear.mockImplementation((item) => Promise.resolve(item.conId(ID_FORMATO)));
      centrosCoste.crearMuchos.mockImplementation((centros) =>
        Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
      );

      const unidadDeTrabajo = mock<UnidadDeTrabajo>();
      unidadDeTrabajo.ejecutar.mockImplementation((operacion) =>
        operacion({ formatos, centrosCoste })
      );

      const servicioConTransaccion = new ImportService(
        parser,
        formatos,
        centrosCoste,
        lineas,
        unidadDeTrabajo
      );

      const reporte = await servicioConTransaccion.importarCentrosCoste(
        { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(unidadDeTrabajo.ejecutar).toHaveBeenCalledTimes(1);
      expect(reporte.insertados).toBe(1);
      expect(reporte.formatosCreados).toEqual(['ADMINISTRACION']);
      expect(formatos.crear).toHaveBeenCalledTimes(1);
      expect(centrosCoste.crearMuchos).toHaveBeenCalledTimes(1);
    });
  });

  describe('importarLineas', () => {
    it('inserta una línea con solo el número usando los valores por defecto', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo'],
        filas: [{ numero: '912345678', centro_coste_codigo: '510' }],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
      lineas.buscarPorNumeros.mockResolvedValue([]);
      lineas.crearMuchas.mockImplementation((items) =>
        Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
      );

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.duplicados).toEqual([]);
      expect(reporte.errores).toEqual([]);

      const entidades = lineas.crearMuchas.mock.calls[0]?.[0] ?? [];
      expect(entidades[0]?.numero).toBe('+56912345678');
      expect(entidades[0]?.estado).toBe('pendiente');
      expect(entidades[0]?.tipoUso).toBe('personal');
      expect(entidades[0]?.tipoLinea).toBe('movil');
      expect(entidades[0]?.costoMensual.valor).toBe(0);
    });

    it('no importa nada si el número no es chileno', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo'],
        filas: [{ numero: '123', centro_coste_codigo: '510' }],
      });

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.motivo).toContain('chileno');
      expect(lineas.crearMuchas).not.toHaveBeenCalled();
    });

    it('reporta el centro de coste inexistente', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo'],
        filas: [{ numero: '912345678', centro_coste_codigo: 'NO_EXISTE' }],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([]);
      lineas.buscarPorNumeros.mockResolvedValue([]);

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores[0]?.motivo).toContain('no existe');
    });

    it('reporta la fila sin centro de coste', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero'],
        filas: [{ numero: '912345678' }],
      });

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores[0]?.motivo).toContain('centro de coste');
    });

    it('reporta los duplicados sin bloquear la importación', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo'],
        filas: [
          { numero: '912345678', centro_coste_codigo: '510' },
          { numero: '912345679', centro_coste_codigo: '510' },
        ],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
      lineas.buscarPorNumeros.mockResolvedValue([linea('+56912345678')]);
      lineas.crearMuchas.mockImplementation((items) =>
        Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
      );

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.duplicados).toHaveLength(1);
      expect(reporte.duplicados[0]?.numero).toBe('+56912345678');
      expect(reporte.errores).toEqual([]);
    });

    it('cancela toda la importación si alguna fila tiene un error', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo', 'costo_mensual'],
        filas: [
          { numero: '912345678', centro_coste_codigo: '510', costo_mensual: '10' },
          { numero: '912345679', centro_coste_codigo: '510', costo_mensual: 'abc' },
        ],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
      lineas.buscarPorNumeros.mockResolvedValue([]);

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.motivo).toContain('costo_mensual');
      expect(lineas.crearMuchas).not.toHaveBeenCalled();
    });

    it('valida los campos enumerados y las fechas', async () => {
      parser.parsear.mockResolvedValue({
        columnas: [
          'numero',
          'centro_coste_codigo',
          'fecha_asignacion',
          'tipo_linea',
          'estado',
          'tipo_uso',
        ],
        filas: [
          {
            numero: '912345678',
            centro_coste_codigo: '510',
            fecha_asignacion: '2024-01-15',
            tipo_linea: 'movil',
            estado: 'activa',
            tipo_uso: 'geovictoria',
          },
          {
            numero: '912345679',
            centro_coste_codigo: '510',
            fecha_asignacion: '15/01/2024',
            tipo_linea: 'satelite',
            estado: 'activa',
            tipo_uso: 'personal',
          },
          {
            numero: '912345680',
            centro_coste_codigo: '510',
            fecha_asignacion: '2024-01-15',
            tipo_linea: 'movil',
            estado: 'inventado',
            tipo_uso: 'personal',
          },
          {
            numero: '912345681',
            centro_coste_codigo: '510',
            fecha_asignacion: '2024-01-15',
            tipo_linea: 'movil',
            estado: 'activa',
            tipo_uso: 'otro',
          },
        ],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
      lineas.buscarPorNumeros.mockResolvedValue([]);
      lineas.crearMuchas.mockImplementation((items) =>
        Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
      );

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(3);
      expect(reporte.errores.map((error) => error.motivo).join(' ')).toContain('tipo_linea');
      expect(reporte.errores.map((error) => error.motivo).join(' ')).toContain('estado');
      expect(reporte.errores.map((error) => error.motivo).join(' ')).toContain('tipo_uso');
    });

    it('acepta el formato de fecha chileno y el costo con coma decimal', async () => {
      parser.parsear.mockResolvedValue({
        columnas: ['numero', 'centro_coste_codigo', 'fecha_asignacion', 'costo_mensual'],
        filas: [
          {
            numero: '912345678',
            centro_coste_codigo: '510',
            fecha_asignacion: '15/01/2024',
            costo_mensual: '1.234,56',
          },
        ],
      });
      centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
      lineas.buscarPorNumeros.mockResolvedValue([]);
      lineas.crearMuchas.mockImplementation((items) =>
        Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
      );

      const reporte = await service.importarLineas({
        contenido: Buffer.from('x'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.errores).toEqual([]);

      const entidades = lineas.crearMuchas.mock.calls[0]?.[0] ?? [];
      expect(entidades[0]?.fechaAsignacion).toBe('2024-01-15');
      expect(entidades[0]?.costoMensual.aString()).toBe('1234.56');
    });

    it('rechaza archivos con más de 50.000 filas', async () => {
      const filas = Array.from({ length: MAX_FILAS_ARCHIVO + 1 }, (_, indice) => ({
        numero: `91234567${String(indice % 10)}`,
      }));

      parser.parsear.mockResolvedValue({ columnas: ['numero'], filas });

      await expect(
        service.importarLineas({
          contenido: Buffer.from('x'),
          nombreArchivo: 'lineas.csv',
        })
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('sanitización de fórmulas (RF-VAL-1.4)', () => {
    /** Prefijos que Excel/CSV interpretan como fórmula. */
    const PREFIJOS = ['=', '+', '-', '@'] as const;

    describe('centros de coste', () => {
      it.each(PREFIJOS)('antepone el apóstrofo al código que empieza por "%s"', async (prefijo) => {
        parser.parsear.mockResolvedValue({
          columnas: ['codigo', 'nombre', 'formato_nombre'],
          filas: [{ codigo: `${prefijo}510`, nombre: 'RENDIC', formato_nombre: 'SMU' }],
        });
        formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
        centrosCoste.buscarPorCodigos.mockResolvedValue([]);
        centrosCoste.crearMuchos.mockImplementation((centros) =>
          Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
        );

        const reporte = await service.importarCentrosCoste({
          contenido: Buffer.from('x'),
          nombreArchivo: 'centros.csv',
        });

        expect(reporte.insertados).toBe(1);

        const entidades = centrosCoste.crearMuchos.mock.calls[0]?.[0] ?? [];
        expect(entidades[0]?.codigo).toBe(`'${prefijo}510`);
      });

      it.each(PREFIJOS)('antepone el apóstrofo al nombre que empieza por "%s"', async (prefijo) => {
        parser.parsear.mockResolvedValue({
          columnas: ['codigo', 'nombre', 'formato_nombre'],
          filas: [{ codigo: '510', nombre: `${prefijo}PELIGRO`, formato_nombre: 'SMU' }],
        });
        formatos.buscarPorNombres.mockResolvedValue([formato('SMU')]);
        centrosCoste.buscarPorCodigos.mockResolvedValue([]);
        centrosCoste.crearMuchos.mockImplementation((centros) =>
          Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
        );

        const reporte = await service.importarCentrosCoste({
          contenido: Buffer.from('x'),
          nombreArchivo: 'centros.csv',
        });

        expect(reporte.insertados).toBe(1);

        const entidades = centrosCoste.crearMuchos.mock.calls[0]?.[0] ?? [];
        expect(entidades[0]?.nombre).toBe(`'${prefijo}PELIGRO`);
      });

      it.each(PREFIJOS)(
        'antepone el apóstrofo al formato creado que empieza por "%s"',
        async (prefijo) => {
          parser.parsear.mockResolvedValue({
            columnas: ['codigo', 'nombre', 'formato_nombre'],
            filas: [{ codigo: '900', nombre: 'OTROS', formato_nombre: `${prefijo}PELIGRO` }],
          });
          formatos.buscarPorNombres.mockResolvedValue([]);
          centrosCoste.buscarPorCodigos.mockResolvedValue([]);
          formatos.crear.mockImplementation((item) => Promise.resolve(item.conId(ID_FORMATO)));
          centrosCoste.crearMuchos.mockImplementation((centros) =>
            Promise.resolve(centros.map((item) => item.conId(ID_CENTRO)))
          );

          const reporte = await service.importarCentrosCoste(
            { contenido: Buffer.from('x'), nombreArchivo: 'centros.csv' },
            { crearFormatosFaltantes: true }
          );

          expect(reporte.insertados).toBe(1);
          expect(reporte.errores).toEqual([]);
          expect(reporte.formatosCreados).toEqual([`'${prefijo}PELIGRO`]);
          expect(formatos.crear.mock.calls[0]?.[0]?.nombre).toBe(`'${prefijo}PELIGRO`);
        }
      );
    });

    describe('líneas', () => {
      it.each(PREFIJOS)(
        'antepone el apóstrofo al proveedor que empieza por "%s"',
        async (prefijo) => {
          parser.parsear.mockResolvedValue({
            columnas: ['numero', 'centro_coste_codigo', 'proveedor'],
            filas: [
              { numero: '912345678', centro_coste_codigo: '510', proveedor: `${prefijo}PELIGRO` },
            ],
          });
          centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
          lineas.buscarPorNumeros.mockResolvedValue([]);
          lineas.crearMuchas.mockImplementation((items) =>
            Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
          );

          const reporte = await service.importarLineas({
            contenido: Buffer.from('x'),
            nombreArchivo: 'lineas.csv',
          });

          expect(reporte.insertados).toBe(1);

          const entidades = lineas.crearMuchas.mock.calls[0]?.[0] ?? [];
          expect(entidades[0]?.proveedor).toBe(`'${prefijo}PELIGRO`);
        }
      );

      it.each(PREFIJOS)(
        'antepone el apóstrofo al empleado que empieza por "%s"',
        async (prefijo) => {
          parser.parsear.mockResolvedValue({
            columnas: ['numero', 'centro_coste_codigo', 'empleado'],
            filas: [
              { numero: '912345678', centro_coste_codigo: '510', empleado: `${prefijo}PELIGRO` },
            ],
          });
          centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
          lineas.buscarPorNumeros.mockResolvedValue([]);
          lineas.crearMuchas.mockImplementation((items) =>
            Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
          );

          const reporte = await service.importarLineas({
            contenido: Buffer.from('x'),
            nombreArchivo: 'lineas.csv',
          });

          expect(reporte.insertados).toBe(1);

          const entidades = lineas.crearMuchas.mock.calls[0]?.[0] ?? [];
          expect(entidades[0]?.empleado).toBe(`'${prefijo}PELIGRO`);
        }
      );
    });

    describe('campos que NO se sanitizan', () => {
      it('no sanitiza el número de teléfono', async () => {
        // El número empieza por `+` (prefijo peligroso): si se sanitizara, la
        // normalización fallaría y la fila sería un error.
        parser.parsear.mockResolvedValue({
          columnas: ['numero', 'centro_coste_codigo'],
          filas: [{ numero: '+56912345678', centro_coste_codigo: '510' }],
        });
        centrosCoste.buscarPorCodigos.mockResolvedValue([centro('510')]);
        lineas.buscarPorNumeros.mockResolvedValue([]);
        lineas.crearMuchas.mockImplementation((items) =>
          Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
        );

        const reporte = await service.importarLineas({
          contenido: Buffer.from('x'),
          nombreArchivo: 'lineas.csv',
        });

        expect(reporte.insertados).toBe(1);
        expect(reporte.errores).toEqual([]);

        const entidades = lineas.crearMuchas.mock.calls[0]?.[0] ?? [];
        expect(entidades[0]?.numero).toBe('+56912345678');
        expect(entidades[0]?.numeroOriginal).toBe('+56912345678');
      });

      it('no sanitiza el código de centro de coste', async () => {
        parser.parsear.mockResolvedValue({
          columnas: ['numero', 'centro_coste_codigo'],
          filas: [{ numero: '912345678', centro_coste_codigo: '=PELIGRO' }],
        });

        // El mock se comporta como el repositorio real: solo devuelve el centro
        // cuyo código coincide (sin distinguir mayúsculas). Si el código se
        // sanitizara, la búsqueda sería por `'=PELIGRO'` y no habría coincidencia.
        centrosCoste.buscarPorCodigos.mockImplementation((codigos) =>
          Promise.resolve(
            codigos.some((codigo) => codigo.toLowerCase() === '=peligro')
              ? [centro('=PELIGRO')]
              : []
          )
        );
        lineas.buscarPorNumeros.mockResolvedValue([]);
        lineas.crearMuchas.mockImplementation((items) =>
          Promise.resolve(items.map((item) => item.conId(ID_LINEA)))
        );

        const reporte = await service.importarLineas({
          contenido: Buffer.from('x'),
          nombreArchivo: 'lineas.csv',
        });

        expect(reporte.insertados).toBe(1);
        expect(reporte.errores).toEqual([]);
        expect(centrosCoste.buscarPorCodigos).toHaveBeenCalledWith(['=peligro']);
      });
    });
  });
});

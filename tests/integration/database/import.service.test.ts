import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';

import { ImportService } from '@application/services/import.service.js';

import { DrizzleCentroCosteRepository } from '@infrastructure/database/repositories/centro-coste.repository.js';
import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';
import { DrizzleLineaRepository } from '@infrastructure/database/repositories/linea.repository.js';
import { DrizzleUnidadDeTrabajo } from '@infrastructure/database/repositories/unidad-de-trabajo.repository.js';
import * as schema from '@infrastructure/database/schema/index.js';
import { XlsxParser } from '@infrastructure/external/spreadsheet/xlsx-parser.js';

import { crearBaseDePruebas, type BaseDePruebas } from './test-db.js';

/** Construye un buffer XLSX a partir de una matriz de celdas. */
function bufferXlsx(matriz: unknown[][]): Buffer {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(matriz);
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('ImportService (integración)', () => {
  let base: BaseDePruebas;
  let service: ImportService;
  let formatos: DrizzleFormatoRepository;
  let centros: DrizzleCentroCosteRepository;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    const parser = new XlsxParser();
    formatos = new DrizzleFormatoRepository(base.db);
    centros = new DrizzleCentroCosteRepository(base.db);
    const lineas = new DrizzleLineaRepository(base.db);

    service = new ImportService(
      parser,
      formatos,
      centros,
      lineas,
      new DrizzleUnidadDeTrabajo(base.db)
    );
  });

  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();
    await formatos.crear(Formato.crearFormato({ nombre: 'SMU' }));
    await formatos.crear(Formato.crearFormato({ nombre: 'FALABELLA' }));
  });

  describe('importarCentrosCoste', () => {
    it('importa centros desde un CSV', async () => {
      const csv = [
        'codigo,nombre,formato_nombre',
        '510,RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO,SMU',
        'C059102801,FALABELLA TOTTUS Av. Alessandri 4025,FALABELLA',
        '',
      ].join('\n');

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(2);
      expect(reporte.duplicados).toBe(0);
      expect(reporte.errores).toEqual([]);

      const guardados = await centros.listarTodos();
      expect(guardados).toHaveLength(2);
      expect(guardados.map((fila) => fila.centro.codigo).sort()).toEqual(['510', 'C059102801']);
      expect(guardados.find((fila) => fila.centro.codigo === '510')?.formatoNombre).toBe('SMU');
    });

    it('importa centros desde un XLSX', async () => {
      const buffer = bufferXlsx([
        ['codigo', 'nombre', 'formato_nombre'],
        ['777', 'CENTRO FALABELLA', 'FALABELLA'],
      ]);

      const reporte = await service.importarCentrosCoste({
        contenido: buffer,
        nombreArchivo: 'centros.xlsx',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.errores).toEqual([]);
    });

    it('no importa nada si una fila referencia un formato inexistente', async () => {
      const csv = [
        'codigo,nombre,formato_nombre',
        '510,RENDIC,SMU',
        '777,OTRO,FORMATO QUE NO EXISTE',
        '',
      ].join('\n');

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);
      expect(await centros.listarTodos()).toHaveLength(0);
    });

    it('no importa nada si el código ya existe', async () => {
      const formato = await formatos.buscarPorNombre('SMU');
      await centros.crear(
        CentroCoste.crearCentroCoste({
          codigo: '510',
          nombre: 'RENDIC',
          formatoId: formato?.id ?? '',
        })
      );

      const csv = ['codigo,nombre,formato_nombre', '510,OTRO RENDIC,SMU', ''].join('\n');

      const reporte = await service.importarCentrosCoste({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'centros.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.duplicados).toBe(1);
      expect(await centros.listarTodos()).toHaveLength(1);
    });

    it('crea el formato que falta e importa los centros', async () => {
      const csv = [
        'codigo,nombre,formato_nombre',
        '900,ADMINISTRACION CENTRAL,ADMINISTRACION',
        '901,ESCUELA CENTRAL,EDUCACION',
        '',
      ].join('\n');

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from(csv, 'utf8'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(2);
      expect(reporte.errores).toEqual([]);
      expect(reporte.formatosCreados).toEqual(['ADMINISTRACION', 'EDUCACION']);

      const formatosGuardados = await formatos.listarTodos();

      expect(formatosGuardados.map((item) => item.nombre)).toEqual(
        expect.arrayContaining(['SMU', 'FALABELLA', 'ADMINISTRACION', 'EDUCACION'])
      );

      const guardados = await centros.listarTodos();

      expect(guardados).toHaveLength(2);
      expect(guardados.find((fila) => fila.centro.codigo === '900')?.formatoNombre).toBe(
        'ADMINISTRACION'
      );
      expect(guardados.find((fila) => fila.centro.codigo === '901')?.formatoNombre).toBe(
        'EDUCACION'
      );
    });

    it('no crea el formato si la importación falla', async () => {
      const formato = await formatos.buscarPorNombre('SMU');
      await centros.crear(
        CentroCoste.crearCentroCoste({
          codigo: '510',
          nombre: 'RENDIC',
          formatoId: formato?.id ?? '',
        })
      );

      const csv = ['codigo,nombre,formato_nombre', '510,OTRO RENDIC,ADMINISTRACION', ''].join('\n');

      const reporte = await service.importarCentrosCoste(
        { contenido: Buffer.from(csv, 'utf8'), nombreArchivo: 'centros.csv' },
        { crearFormatosFaltantes: true }
      );

      expect(reporte.insertados).toBe(0);
      expect(reporte.duplicados).toBe(1);
      expect(reporte.formatosCreados).toEqual([]);

      const formatosGuardados = await formatos.listarTodos();

      expect(formatosGuardados.map((item) => item.nombre)).toEqual(['FALABELLA', 'SMU']);
    });
  });

  describe('importarLineas', () => {
    beforeEach(async () => {
      const formato = await formatos.buscarPorNombre('SMU');
      await centros.crear(
        CentroCoste.crearCentroCoste({
          codigo: '510',
          nombre: 'RENDIC',
          formatoId: formato?.id ?? '',
        })
      );
    });

    it('importa líneas solo con el número usando los valores por defecto', async () => {
      const csv = [
        'numero,proveedor,centro_coste_codigo,fecha_asignacion,costo_mensual,tipo_linea,empleado,estado,tipo_uso',
        '912345678,Movistar,510,2024-01-15,1500.50,movil,Ana Perez,activa,geovictoria',
        '987654321,,510,,,,,,',
        '',
      ].join('\n');

      const reporte = await service.importarLineas({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(2);
      expect(reporte.errores).toEqual([]);
      expect(reporte.duplicados).toEqual([]);

      const lineas = await new DrizzleLineaRepository(base.db).listar({});
      expect(lineas.items).toHaveLength(2);

      const primera = lineas.items.find((item) => item.linea.numero === '+56912345678');
      expect(primera?.linea.proveedor).toBe('Movistar');
      expect(primera?.linea.empleado).toBe('Ana Perez');
      expect(primera?.linea.estado).toBe('activa');
      expect(primera?.linea.tipoUso).toBe('geovictoria');
      expect(primera?.linea.costoMensual.aString()).toBe('1500.50');
      expect(primera?.centroCosteCodigo).toBe('510');

      const segunda = lineas.items.find((item) => item.linea.numero === '+56987654321');
      expect(segunda?.linea.estado).toBe('pendiente');
      expect(segunda?.linea.tipoUso).toBe('personal');
      expect(segunda?.linea.costoMensual.aString()).toBe('0.00');
      expect(segunda?.linea.proveedor).toBe('');
      expect(segunda?.linea.empleado).toBeNull();
    });

    it('reporta los duplicados y no vuelve a insertar la línea', async () => {
      const csv = ['numero,centro_coste_codigo', '912345678,510', ''].join('\n');

      const primero = await service.importarLineas({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'lineas.csv',
      });
      expect(primero.insertados).toBe(1);

      const segundo = await service.importarLineas({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'lineas.csv',
      });

      expect(segundo.insertados).toBe(0);
      expect(segundo.duplicados).toHaveLength(1);
      expect(segundo.duplicados[0]?.numero).toBe('+56912345678');
      expect(segundo.errores).toEqual([]);
    });

    it('no inserta ninguna línea si una fila tiene un error de validación', async () => {
      const csv = [
        'numero,centro_coste_codigo,costo_mensual',
        '912345678,510,1000',
        '912345679,510,-5',
        '',
      ].join('\n');

      const reporte = await service.importarLineas({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(0);
      expect(reporte.errores).toHaveLength(1);

      const lineas = await new DrizzleLineaRepository(base.db).listar({});
      expect(lineas.items).toHaveLength(0);
    });

    it('importa líneas desde un XLSX', async () => {
      const buffer = bufferXlsx([
        ['numero', 'centro_coste_codigo', 'costo_mensual'],
        ['912345678', '510', 2500],
      ]);

      const reporte = await service.importarLineas({
        contenido: buffer,
        nombreArchivo: 'lineas.xlsx',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.errores).toEqual([]);
    });

    it('persiste en la base de datos el valor sanitizado con apóstrofo inicial (RF-VAL-1.4)', async () => {
      const csv = [
        'numero,proveedor,empleado,centro_coste_codigo',
        '912345678,=PELIGRO,@PELIGRO,510',
        '',
      ].join('\n');

      const reporte = await service.importarLineas({
        contenido: Buffer.from(csv, 'utf8'),
        nombreArchivo: 'lineas.csv',
      });

      expect(reporte.insertados).toBe(1);
      expect(reporte.errores).toEqual([]);

      // Se lee la fila cruda de la tabla (sin pasar por la entidad) para comprobar el
      // **valor persistido**: la sanitización ocurre en el servicio de importación y debe
      // llegar a la base de datos.
      const filas = await base.db
        .select({
          proveedor: schema.lineasTelefonicas.proveedor,
          empleado: schema.lineasTelefonicas.empleado,
        })
        .from(schema.lineasTelefonicas);

      expect(filas).toHaveLength(1);
      expect(filas[0]?.proveedor.startsWith("'")).toBe(true);
      expect(filas[0]?.empleado?.startsWith("'")).toBe(true);
      expect(filas[0]?.proveedor).toBe("'=PELIGRO");
      expect(filas[0]?.empleado).toBe("'@PELIGRO");
    });
  });
});

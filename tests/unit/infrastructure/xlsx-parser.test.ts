import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { ValidationError } from '@domain/errors/DomainError.js';

import { XlsxParser } from '@infrastructure/external/spreadsheet/xlsx-parser.js';

/** Construye un buffer XLSX a partir de una matriz de celdas. */
function bufferXlsx(matriz: unknown[][]): Buffer {
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.aoa_to_sheet(matriz);
  XLSX.utils.book_append_sheet(libro, hoja, 'Hoja1');
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('XlsxParser', () => {
  const parser = new XlsxParser();

  it('parsea un CSV normalizando las cabeceras', async () => {
    const csv = 'Numero,Centro de Coste,Proveedor\n900000001,510,Entel\n900000002,777,Movistar\n';

    const resultado = await parser.parsear(Buffer.from(csv, 'utf8'), 'lineas.csv');

    expect(resultado.columnas).toEqual(['numero', 'centro_de_coste', 'proveedor']);
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filas[0]).toEqual({
      numero: '900000001',
      centro_de_coste: '510',
      proveedor: 'Entel',
    });
  });

  it('parsea un archivo XLSX', async () => {
    const buffer = bufferXlsx([
      ['numero', 'proveedor'],
      ['900000001', 'Entel'],
    ]);

    const resultado = await parser.parsear(buffer, 'lineas.xlsx');

    expect(resultado.columnas).toEqual(['numero', 'proveedor']);
    expect(resultado.filas).toEqual([{ numero: '900000001', proveedor: 'Entel' }]);
  });

  it('ignora filas vacías y resuelve cabeceras duplicadas', async () => {
    const csv = 'numero,numero,proveedor\n900000001,900000002,Entel\n,,\n';

    const resultado = await parser.parsear(Buffer.from(csv, 'utf8'), 'lineas.csv');

    expect(resultado.columnas).toEqual(['numero', 'numero_2', 'proveedor']);
    expect(resultado.filas).toHaveLength(1);
  });

  it('rechaza un formato no soportado', async () => {
    await expect(parser.parsear(Buffer.from('contenido'), 'archivo.pdf')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rechaza un archivo vacío', async () => {
    await expect(parser.parsear(Buffer.from(''), 'archivo.csv')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rechaza un archivo sin filas de datos', async () => {
    await expect(
      parser.parsear(Buffer.from('numero,proveedor\n', 'utf8'), 'archivo.csv')
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

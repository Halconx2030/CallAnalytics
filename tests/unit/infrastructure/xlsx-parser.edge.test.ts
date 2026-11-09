import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

import { ValidationError } from '@domain/errors/DomainError.js';

import { XlsxParser } from '@infrastructure/external/spreadsheet/xlsx-parser.js';

// Se envuelve `read` para poder simular libros corruptos o sin hojas, que SheetJS no genera solo.
vi.mock('xlsx', async (importOriginal) => {
  const original = await importOriginal<typeof XLSX>();
  return { ...original, read: vi.fn(original.read) };
});

describe('XlsxParser — casos límite', () => {
  const parser = new XlsxParser();
  const leer = vi.mocked(XLSX.read);

  beforeEach(() => {
    leer.mockClear();
  });

  it('traduce un fallo de lectura de SheetJS a ValidationError', async () => {
    leer.mockImplementationOnce(() => {
      throw new Error('corrupto');
    });

    await expect(parser.parsear(Buffer.from('x'), 'a.xlsx')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rechaza un libro sin hojas', async () => {
    leer.mockReturnValueOnce({ SheetNames: [], Sheets: {} } as XLSX.WorkBook);

    await expect(parser.parsear(Buffer.from('x'), 'a.xlsx')).rejects.toThrow('no contiene hojas');
  });

  it('rechaza una hoja sin cabeceras', async () => {
    const hoja = XLSX.utils.aoa_to_sheet([]);
    leer.mockReturnValueOnce({ SheetNames: ['H'], Sheets: { H: hoja } } as XLSX.WorkBook);

    await expect(parser.parsear(Buffer.from('x'), 'a.xlsx')).rejects.toThrow('no tiene cabeceras');
  });

  it('rechaza una cabecera vacía', async () => {
    const hoja = XLSX.utils.aoa_to_sheet([[]]);
    leer.mockReturnValueOnce({ SheetNames: ['H'], Sheets: { H: hoja } } as XLSX.WorkBook);

    await expect(parser.parsear(Buffer.from('x'), 'a.xlsx')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('formatea fechas como ISO y trata null/undefined como vacío', async () => {
    const hoja = XLSX.utils.aoa_to_sheet([['fecha', 'otro'], ['x']]);
    leer.mockReturnValueOnce({ SheetNames: ['H'], Sheets: { H: hoja } } as XLSX.WorkBook);
    const spy = vi.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValueOnce([
      ['fecha', 'otro'],
      [new Date('2025-03-04T00:00:00Z'), null],
    ]);

    const resultado = await parser.parsear(Buffer.from('x'), 'a.xlsx');

    expect(resultado.filas).toEqual([{ fecha: '2025-03-04', otro: '' }]);
    spy.mockRestore();
  });

  it('nombra las columnas sin título como "columna"', async () => {
    const resultado = await parser.parsear(Buffer.from('a,,\n1,2,3\n'), 'a.csv');

    expect(resultado.columnas).toEqual(['a', 'columna', 'columna_2']);
  });
});

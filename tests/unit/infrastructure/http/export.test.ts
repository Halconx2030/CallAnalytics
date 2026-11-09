import { describe, expect, it } from 'vitest';

import { construirCsv, construirXlsx, sanitizarCeldaExport } from '@infrastructure/http/export.js';

describe('export — sanitización de celdas contra inyección de fórmulas', () => {
  it('antepone comilla simple a valores que comienzan con =, +, -, @, tab o retorno de carro', () => {
    expect(sanitizarCeldaExport('=CMD()')).toBe("'=CMD()");
    expect(sanitizarCeldaExport('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(sanitizarCeldaExport('-1+2')).toBe("'-1+2");
    expect(sanitizarCeldaExport('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(sanitizarCeldaExport('\t=1')).toBe("'\t=1");
    expect(sanitizarCeldaExport('\r=1')).toBe("'\r=1");
  });

  it('conserva intactos teléfonos E.164 chilenos, números y valores normales o vacíos', () => {
    expect(sanitizarCeldaExport('+56912345678')).toBe('+56912345678');
    expect(sanitizarCeldaExport(25000)).toBe(25000);
    expect(sanitizarCeldaExport('Movistar')).toBe('Movistar');
    expect(sanitizarCeldaExport(null)).toBe('');
    expect(sanitizarCeldaExport(undefined)).toBe('');
  });

  it('escapa fórmulas al construir CSV y XLSX', () => {
    const csv = construirCsv(
      ['numero', 'empleado'],
      [['+56912345678', '=HYPERLINK("http://evil.test","click")']]
    ).toString('utf8');

    expect(csv).toContain('+56912345678');
    expect(csv).toContain("'=HYPERLINK");

    const xlsx = construirXlsx(['numero', 'empleado'], [['+56912345678', '@SUM(1,2)']]);
    expect(xlsx.byteLength).toBeGreaterThan(0);
  });
});

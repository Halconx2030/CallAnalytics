import { describe, expect, it } from 'vitest';

import { DomainError, InvalidPhoneNumberError } from '../../../src/domain/errors/DomainError.js';
import {
  normalizePhone,
  PREFIJO_FIJO_SANTIAGO,
  PREFIJOS_FIJOS_REGIONES,
} from '../../../src/domain/value-objects/PhoneNumber.js';

const MOVIL_NORMALIZADO = '+56912345678';

type CasoNormalizacion = [entrada: string, normalizado: string, tipo: 'movil' | 'fijo'];

function capturarError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la función lanzara un error');
}

describe('normalizePhone — tabla de la spec 4.3', () => {
  const casos: CasoNormalizacion[] = [
    ['9 1234 5678', MOVIL_NORMALIZADO, 'movil'],
    ['+56 9 1234 5678', MOVIL_NORMALIZADO, 'movil'],
    ['56912345678', MOVIL_NORMALIZADO, 'movil'],
    ['2 1234 5678', '+56212345678', 'fijo'],
    ['+56 2 1234 5678', '+56212345678', 'fijo'],
    ['56212345678', '+56212345678', 'fijo'],
    ['09 1234 5678', MOVIL_NORMALIZADO, 'movil'],
    ['32 1234 5678', '+563212345678', 'fijo'],
    ['41 1234 5678', '+564112345678', 'fijo'],
  ];

  it.each(casos)('normaliza "%s" a "%s" (tipo %s)', (entrada, normalizado, tipo) => {
    expect(normalizePhone(entrada)).toEqual({ normalized: normalizado, tipo });
  });
});

describe('normalizePhone — casos límite de RF-VAL-1.5', () => {
  /**
   * Casos que la tabla de la spec 4.3 no cubría y que RF-VAL-1.5 fija.
   *
   * - `"+560 9 1234 5678"` y `"056 9 1234 5678"`: el `0` sobrante tras el
   *   prefijo de país se descarta y el móvil queda normalizado.
   * - `"5612345678"`: 10 dígitos que empiezan por `56` se resuelven como
   *   **fijo regional** de área 56 (decisión Q5 de la spec), no como prefijo
   *   de país mal escrito.
   */
  const casos: CasoNormalizacion[] = [
    ['+560 9 1234 5678', MOVIL_NORMALIZADO, 'movil'],
    ['056 9 1234 5678', MOVIL_NORMALIZADO, 'movil'],
    ['5612345678', '+565612345678', 'fijo'],
  ];

  it.each(casos)('normaliza "%s" a "%s" (tipo %s)', (entrada, normalizado, tipo) => {
    expect(normalizePhone(entrada)).toEqual({ normalized: normalizado, tipo });
  });

  it('resuelve "5612345678" como fijo regional de área 56 y no como móvil', () => {
    const resultado = normalizePhone('5612345678');

    expect(resultado.tipo).toBe('fijo');
    expect(resultado.normalized).toBe('+565612345678');
    expect(resultado.normalized).not.toBe(MOVIL_NORMALIZADO);
  });
});

describe('normalizePhone — separadores y formatos aceptados', () => {
  const variantesMovil = [
    '9-1234-5678',
    '9.1234.5678',
    '(9) 1234 5678',
    ' 9 1234 5678 ',
    '+56 (9) 1234 5678',
    '+56-9-1234-5678',
    '+56912345678',
    '56912345678',
    '0 9 1234 5678',
  ];

  it.each(variantesMovil)('normaliza la variante móvil "%s"', (entrada) => {
    expect(normalizePhone(entrada)).toEqual({
      normalized: MOVIL_NORMALIZADO,
      tipo: 'movil',
    });
  });

  const variantesFijo = [
    '2-1234-5678',
    '(2) 1234 5678',
    '+56 (2) 1234 5678',
    '56212345678',
    '02 1234 5678',
    '+56 2 1234 5678',
  ];

  it.each(variantesFijo)('normaliza la variante fija "%s"', (entrada) => {
    expect(normalizePhone(entrada)).toEqual({ normalized: '+56212345678', tipo: 'fijo' });
  });
});

describe('normalizePhone — prefijos fijos', () => {
  it(`reconoce Santiago (prefijo ${PREFIJO_FIJO_SANTIAGO})`, () => {
    expect(normalizePhone(`${PREFIJO_FIJO_SANTIAGO} 1234 5678`)).toEqual({
      normalized: '+56212345678',
      tipo: 'fijo',
    });
  });

  for (const prefijo of PREFIJOS_FIJOS_REGIONES) {
    it(`reconoce la región con prefijo ${prefijo}`, () => {
      expect(normalizePhone(`${prefijo} 1234 5678`)).toEqual({
        normalized: `+56${prefijo}12345678`,
        tipo: 'fijo',
      });
    });

    it(`reconoce la región ${prefijo} con +56`, () => {
      expect(normalizePhone(`+56 ${prefijo} 1234 5678`)).toEqual({
        normalized: `+56${prefijo}12345678`,
        tipo: 'fijo',
      });
    });
  }
});

describe('normalizePhone — idempotencia', () => {
  it.each([MOVIL_NORMALIZADO, '+56212345678', '+563212345678'])(
    'no altera el número ya normalizado "%s"',
    (normalizado) => {
      const primera = normalizePhone(normalizado);

      expect(primera.normalized).toBe(normalizado);
      expect(normalizePhone(primera.normalized)).toEqual(primera);
    }
  );
});

describe('normalizePhone — entradas inválidas', () => {
  const invalidos = [
    '1234567',
    '812345678',
    '123',
    '',
    '   ',
    'abcdefghi',
    '+56 99 1234 5678',
    '22 1234 5678',
    '32 1234 567',
    '+',
    '9 1234 56789',
    '9 1234 56789 0',
    '9-1234-567a',
    '++56912345678',
    '9+12345678',
    '+1 5551234567',
    '@912345678',
    '33 1234 567',
  ];

  it.each(invalidos)('rechaza "%s" con InvalidPhoneNumberError', (entrada) => {
    expect(() => normalizePhone(entrada)).toThrow(InvalidPhoneNumberError);
  });

  it.each(invalidos)('reporta el valor rechazado "%s" en el mensaje', (entrada) => {
    expect(() => normalizePhone(entrada)).toThrow(new RegExp(escaparRegex(entrada)));
  });

  it('rechaza valores que no son strings', () => {
    const noStrings: unknown[] = [null, undefined, 912345678, true, { numero: '912345678' }, []];

    for (const valor of noStrings) {
      expect(() => normalizePhone(valor as string)).toThrow(InvalidPhoneNumberError);
    }
  });

  it('expone un error tipado con código estable y detalles del valor recibido', () => {
    const error = capturarError(() => normalizePhone('1234567'));

    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);

    const errorTipado = error as InvalidPhoneNumberError;

    expect(errorTipado.name).toBe('InvalidPhoneNumberError');
    expect(errorTipado.code).toBe('INVALID_PHONE_NUMBER');
    expect(errorTipado.message).toContain('1234567');
    expect(errorTipado.details).toEqual({ valor: '1234567' });
  });
});

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

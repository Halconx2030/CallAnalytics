import { describe, expect, it } from 'vitest';

import { DomainError, InvalidCostoError } from '../../../src/domain/errors/DomainError.js';
import { CostoMensual } from '../../../src/domain/value-objects/CostoMensual.js';

describe('CostoMensual — creación', () => {
  it('acepta números finitos mayores o iguales a cero', () => {
    expect(CostoMensual.create(0).valor).toBe(0);
    expect(CostoMensual.create(1234.5).valor).toBe(1234.5);
    expect(CostoMensual.create(99_999_999.99).valor).toBe(99_999_999.99);
  });

  it('acepta strings decimales y los convierte a número', () => {
    expect(CostoMensual.create('0').valor).toBe(0);
    expect(CostoMensual.create('1234.5').valor).toBe(1234.5);
    expect(CostoMensual.create(' 12.30 ').valor).toBe(12.3);
  });

  it('redondea a dos decimales (half-up)', () => {
    expect(CostoMensual.create(1234.567).valor).toBe(1234.57);
    expect(CostoMensual.create('1234.564').valor).toBe(1234.56);
    expect(CostoMensual.create('10.005').valor).toBe(10.01);
    expect(CostoMensual.create(0.30000000000000004).valor).toBe(0.3);
  });

  it('expone cero() como instancia con valor 0', () => {
    const cero = CostoMensual.cero();

    expect(cero.valor).toBe(0);
    expect(cero.aString()).toBe('0.00');
    expect(cero.equals(CostoMensual.create(0))).toBe(true);
  });
});

describe('CostoMensual — aString', () => {
  it('siempre devuelve dos decimales', () => {
    expect(CostoMensual.create(0).aString()).toBe('0.00');
    expect(CostoMensual.create(5).aString()).toBe('5.00');
    expect(CostoMensual.create(5.1).aString()).toBe('5.10');
    expect(CostoMensual.create('1234.567').aString()).toBe('1234.57');
    expect(CostoMensual.create(99_999_999.99).aString()).toBe('99999999.99');
  });
});

describe('CostoMensual — equals', () => {
  it('compara por valor', () => {
    expect(CostoMensual.create(10).equals(CostoMensual.create('10.00'))).toBe(true);
    expect(CostoMensual.create(10).equals(CostoMensual.create(10.01))).toBe(false);
    expect(CostoMensual.create(0).equals(CostoMensual.cero())).toBe(true);
  });
});

describe('CostoMensual — inmutabilidad', () => {
  it('no permite mutar el valor en runtime', () => {
    const costo = CostoMensual.create(10);

    expect(Reflect.set(costo, 'valor', 99)).toBe(false);
    expect(costo.valor).toBe(10);
  });
});

describe('CostoMensual — valores inválidos', () => {
  it('rechaza negativos', () => {
    expect(() => CostoMensual.create(-0.01)).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('-10')).toThrow(InvalidCostoError);
  });

  it('rechaza valores que exceden el máximo de decimal(10,2)', () => {
    expect(() => CostoMensual.create(100_000_000)).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create(99_999_999.995)).toThrow(InvalidCostoError);
    expect(CostoMensual.create(99_999_999.989).valor).toBe(99_999_999.99);
  });

  it('rechaza NaN e Infinity', () => {
    expect(() => CostoMensual.create(Number.NaN)).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create(Number.POSITIVE_INFINITY)).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create(Number.NEGATIVE_INFINITY)).toThrow(InvalidCostoError);
  });

  it('rechaza strings no numéricos', () => {
    expect(() => CostoMensual.create('')).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('   ')).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('abc')).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('10abc')).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('1e5')).toThrow(InvalidCostoError);
    expect(() => CostoMensual.create('0x10')).toThrow(InvalidCostoError);
  });

  it('rechaza valores que no son number ni string', () => {
    const invalidos: unknown[] = [null, undefined, true, {}, []];

    for (const valor of invalidos) {
      expect(() => CostoMensual.create(valor as number)).toThrow(InvalidCostoError);
    }
  });

  it('expone un error tipado con código estable', () => {
    try {
      CostoMensual.create(-1);
      throw new Error('Se esperaba InvalidCostoError');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as InvalidCostoError).code).toBe('INVALID_COSTO');
      expect((error as InvalidCostoError).name).toBe('InvalidCostoError');
      expect((error as InvalidCostoError).message).toContain('-1');
    }
  });
});

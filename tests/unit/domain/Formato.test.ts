import { describe, expect, it } from 'vitest';

import { Formato } from '../../../src/domain/entities/Formato.js';
import { ValidationError } from '../../../src/domain/errors/DomainError.js';

const AHORA = new Date('2026-11-04T12:00:00.000Z');
const DESPUES = new Date('2026-11-05T08:30:00.000Z');

describe('Formato — creación', () => {
  it('crea un formato sin id y con version 1', () => {
    const formato = Formato.crearFormato({ nombre: '  SMU  ' }, AHORA);

    expect(formato.id).toBeNull();
    expect(formato.nombre).toBe('SMU');
    expect(formato.version).toBe(1);
    expect(formato.createdAt).toBe(AHORA);
    expect(formato.updatedAt).toBe(AHORA);
  });

  it('usa la fecha actual por defecto', () => {
    const formato = Formato.crearFormato({ nombre: 'FALABELLA' });

    expect(formato.createdAt).toBeInstanceOf(Date);
    expect(formato.updatedAt).toBe(formato.createdAt);
  });

  it.each(['', '   ', '\n\t'])('rechaza el nombre vacío %j', (nombre) => {
    expect(() => Formato.crearFormato({ nombre }, AHORA)).toThrow(ValidationError);
  });

  it('rechaza nombres de más de 100 caracteres', () => {
    expect(() => Formato.crearFormato({ nombre: 'x'.repeat(101) }, AHORA)).toThrow(ValidationError);
  });

  it('acepta un nombre de exactamente 100 caracteres', () => {
    const nombre = 'x'.repeat(100);

    expect(Formato.crearFormato({ nombre }, AHORA).nombre).toBe(nombre);
  });
});

describe('Formato — renombrar', () => {
  it('devuelve una instancia nueva sin mutar la original', () => {
    const original = Formato.crearFormato({ nombre: 'SMU' }, AHORA);
    const renombrado = original.renombrar('  SMU CHILE  ', DESPUES);

    expect(renombrado).not.toBe(original);
    expect(renombrado.nombre).toBe('SMU CHILE');
    expect(renombrado.updatedAt).toBe(DESPUES);
    expect(renombrado.createdAt).toBe(AHORA);
    expect(original.nombre).toBe('SMU');
    expect(original.updatedAt).toBe(AHORA);
  });

  it('valida el nuevo nombre', () => {
    const formato = Formato.crearFormato({ nombre: 'SMU' }, AHORA);

    expect(() => formato.renombrar('   ', DESPUES)).toThrow(ValidationError);
  });
});

describe('Formato — conId y reconstitución', () => {
  it('conId devuelve una copia con id asignado', () => {
    const formato = Formato.crearFormato({ nombre: 'SMU' }, AHORA);
    const persistido = formato.conId('11111111-1111-1111-1111-111111111111');

    expect(persistido.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(persistido.nombre).toBe('SMU');
    expect(formato.id).toBeNull();
    expect(() => formato.conId('   ')).toThrow(ValidationError);
  });

  it('reconstituye desde una fila de persistencia con timestamps string', () => {
    const formato = Formato.reconstituirFormato({
      id: '22222222-2222-2222-2222-222222222222',
      nombre: 'FALABELLA',
      version: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    expect(formato.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(formato.nombre).toBe('FALABELLA');
    expect(formato.version).toBe(3);
    expect(formato.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(formato.updatedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
  });

  it('reconstituye desde una fila con fechas Date', () => {
    const formato = Formato.reconstituirFormato({
      id: '33333333-3333-3333-3333-333333333333',
      nombre: 'SMU',
      version: 1,
      createdAt: AHORA,
      updatedAt: AHORA,
    });

    expect(formato.createdAt).toBe(AHORA);
  });

  it('rechaza filas con nombre inválido', () => {
    expect(() =>
      Formato.reconstituirFormato({
        id: '44444444-4444-4444-4444-444444444444',
        nombre: '',
        version: 1,
        createdAt: AHORA,
        updatedAt: AHORA,
      })
    ).toThrow(ValidationError);

    expect(() =>
      Formato.reconstituirFormato({
        id: '44444444-4444-4444-4444-444444444444',
        nombre: 'SMU',
        version: 0,
        createdAt: AHORA,
        updatedAt: AHORA,
      })
    ).toThrow(ValidationError);

    expect(() =>
      Formato.reconstituirFormato({
        id: '44444444-4444-4444-4444-444444444444',
        nombre: 'SMU',
        version: 1,
        createdAt: 'fecha-invalida',
        updatedAt: AHORA,
      })
    ).toThrow(ValidationError);
  });

  it('expone el nombre recortado', () => {
    const formato = Formato.reconstituirFormato({
      id: '55555555-5555-5555-5555-555555555555',
      nombre: '  SMU  ',
      version: 1,
      createdAt: AHORA,
      updatedAt: AHORA,
    });

    expect(formato.nombre).toBe('SMU');
  });
});

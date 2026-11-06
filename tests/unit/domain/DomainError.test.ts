import { describe, expect, it } from 'vitest';

import {
  DomainError,
  DuplicateError,
  ForeignKeyError,
  InvalidCostoError,
  InvalidPhoneNumberError,
  NotFoundError,
  ValidationError,
} from '../../../src/domain/errors/DomainError.js';

describe('DomainError — jerarquía y códigos estables', () => {
  it('la base conserva mensaje, código y detalles', () => {
    const error = new DomainError('Algo falló', 'FALLO', { campo: 'x' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe('DomainError');
    expect(error.message).toBe('Algo falló');
    expect(error.code).toBe('FALLO');
    expect(error.details).toEqual({ campo: 'x' });
    expect(error.stack).toBeDefined();
  });

  it('permite omitir los detalles', () => {
    const error = new DomainError('Sin detalles', 'SIN_DETALLES');

    expect(error.details).toBeUndefined();
  });

  it.each<[DomainError, string, string]>([
    [new InvalidPhoneNumberError('123'), 'InvalidPhoneNumberError', 'INVALID_PHONE_NUMBER'],
    [new InvalidCostoError('-1'), 'InvalidCostoError', 'INVALID_COSTO'],
    [new DuplicateError('numero'), 'DuplicateError', 'DUPLICATE'],
    [new NotFoundError('linea'), 'NotFoundError', 'NOT_FOUND'],
    [new ForeignKeyError('formatoId'), 'ForeignKeyError', 'FOREIGN_KEY'],
    [new ValidationError('nombre', 'vacío'), 'ValidationError', 'VALIDATION_ERROR'],
  ])('%s expone name y code correctos', (error, name, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.name).toBe(name);
    expect(error.code).toBe(code);
  });
});

describe('DomainError — subclases con metadatos', () => {
  it('DuplicateError describe el campo duplicado', () => {
    const error = new DuplicateError('codigo');

    expect(error.field).toBe('codigo');
    expect(error.message).toContain('codigo');
    expect(error.details).toEqual({ field: 'codigo' });
  });

  it('DuplicateError permite un mensaje propio', () => {
    const error = new DuplicateError('numero', 'El número ya existe entre las líneas activas.');

    expect(error.message).toBe('El número ya existe entre las líneas activas.');
    expect(error.field).toBe('numero');
  });

  it('NotFoundError describe el recurso y el id', () => {
    const error = new NotFoundError('linea', 'abc-123');

    expect(error.resource).toBe('linea');
    expect(error.message).toContain('linea');
    expect(error.message).toContain('abc-123');
    expect(error.details).toEqual({ resource: 'linea', id: 'abc-123' });
  });

  it('ForeignKeyError describe el campo inexistente', () => {
    const error = new ForeignKeyError('centroCosteId');

    expect(error.field).toBe('centroCosteId');
    expect(error.message).toContain('centroCosteId');
    expect(error.details).toEqual({ field: 'centroCosteId' });
  });

  it('ValidationError describe el campo y el motivo', () => {
    const error = new ValidationError('nombre', 'no puede estar vacío');

    expect(error.field).toBe('nombre');
    expect(error.message).toContain('nombre');
    expect(error.message).toContain('no puede estar vacío');
    expect(error.details).toEqual({ field: 'nombre', motivo: 'no puede estar vacío' });
  });
});

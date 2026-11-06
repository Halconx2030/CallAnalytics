import { describe, expect, it } from 'vitest';

import { ValidationError } from '@domain/errors/DomainError.js';

import {
  codificarCursor,
  decodificarCursor,
} from '@infrastructure/database/repositories/cursor.js';

/** Id de prueba (uuid v4 con formato válido). */
const ID = '3f1c2a9e-0000-4000-8000-000000000001';

describe('cursor de paginación', () => {
  it('codifica y decodifica el cursor con la columna de orden', () => {
    const cursor = codificarCursor('ALFA', ID, 'nombre');

    expect(decodificarCursor(cursor, 'nombre')).toEqual({ v: 'ALFA', id: ID, c: 'nombre' });
  });

  it('escribe el sobre { v, id, c } en base64url', () => {
    const cursor = codificarCursor('ALFA', ID, 'nombre');
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;

    expect(payload).toEqual({ v: 'ALFA', id: ID, c: 'nombre' });
  });

  it('rechaza un cursor emitido para otra columna de orden', () => {
    const cursor = codificarCursor('2026-01-01T00:00:00.000Z', ID, 'created_at');

    expect(() => decodificarCursor(cursor, 'nombre')).toThrow(ValidationError);
  });

  it('rechaza un cursor legado sin columna de orden', () => {
    const legado = Buffer.from(JSON.stringify({ v: 'ALFA', id: ID }), 'utf8').toString('base64url');

    expect(() => decodificarCursor(legado, 'nombre')).toThrow(ValidationError);
  });

  it('rechaza un cursor que no es base64url de un JSON válido', () => {
    expect(() => decodificarCursor('no-es-un-cursor', 'nombre')).toThrow(ValidationError);
  });
});

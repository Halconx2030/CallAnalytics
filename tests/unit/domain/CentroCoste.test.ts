import { describe, expect, it } from 'vitest';

import { CentroCoste } from '../../../src/domain/entities/CentroCoste.js';
import { ValidationError } from '../../../src/domain/errors/DomainError.js';

const AHORA = new Date('2026-11-04T12:00:00.000Z');
const DESPUES = new Date('2026-11-05T08:30:00.000Z');
const FORMATO_ID = '11111111-1111-1111-1111-111111111111';
const OTRO_FORMATO_ID = '22222222-2222-2222-2222-222222222222';

describe('CentroCoste — creación', () => {
  it('crea un centro sin id, con version 1 y textos recortados', () => {
    const centro = CentroCoste.crearCentroCoste(
      {
        codigo: '  510  ',
        nombre: '  RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO  ',
        formatoId: `  ${FORMATO_ID}  `,
      },
      AHORA
    );

    expect(centro.id).toBeNull();
    expect(centro.codigo).toBe('510');
    expect(centro.nombre).toBe('RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO');
    expect(centro.formatoId).toBe(FORMATO_ID);
    expect(centro.version).toBe(1);
    expect(centro.createdAt).toBe(AHORA);
    expect(centro.updatedAt).toBe(AHORA);
  });

  it('no fuerza mayúsculas en el código', () => {
    const centro = CentroCoste.crearCentroCoste(
      { codigo: 'c059102801', nombre: 'Curicó', formatoId: FORMATO_ID },
      AHORA
    );

    expect(centro.codigo).toBe('c059102801');
  });

  it.each<[string, { codigo: string; nombre: string; formatoId: string }]>([
    ['codigo vacío', { codigo: '   ', nombre: 'Curicó', formatoId: FORMATO_ID }],
    ['nombre vacío', { codigo: '510', nombre: '   ', formatoId: FORMATO_ID }],
    ['formatoId vacío', { codigo: '510', nombre: 'Curicó', formatoId: '   ' }],
    [
      'codigo de 51 caracteres',
      { codigo: 'x'.repeat(51), nombre: 'Curicó', formatoId: FORMATO_ID },
    ],
    ['nombre de 201 caracteres', { codigo: '510', nombre: 'x'.repeat(201), formatoId: FORMATO_ID }],
  ])('rechaza %s', (_caso, input) => {
    expect(() => CentroCoste.crearCentroCoste(input, AHORA)).toThrow(ValidationError);
  });

  it('acepta los límites exactos de longitud', () => {
    const centro = CentroCoste.crearCentroCoste(
      { codigo: 'x'.repeat(50), nombre: 'y'.repeat(200), formatoId: FORMATO_ID },
      AHORA
    );

    expect(centro.codigo).toHaveLength(50);
    expect(centro.nombre).toHaveLength(200);
  });
});

describe('CentroCoste — mutaciones puras', () => {
  it('cambiarFormato devuelve una instancia nueva sin mutar la original', () => {
    const original = CentroCoste.crearCentroCoste(
      { codigo: '510', nombre: 'Curicó', formatoId: FORMATO_ID },
      AHORA
    );
    const cambiado = original.cambiarFormato(OTRO_FORMATO_ID, DESPUES);

    expect(cambiado).not.toBe(original);
    expect(cambiado.formatoId).toBe(OTRO_FORMATO_ID);
    expect(cambiado.updatedAt).toBe(DESPUES);
    expect(cambiado.createdAt).toBe(AHORA);
    expect(original.formatoId).toBe(FORMATO_ID);
    expect(original.updatedAt).toBe(AHORA);
  });

  it('cambiarFormato valida que el formato no sea vacío', () => {
    const centro = CentroCoste.crearCentroCoste(
      { codigo: '510', nombre: 'Curicó', formatoId: FORMATO_ID },
      AHORA
    );

    expect(() => centro.cambiarFormato('   ', DESPUES)).toThrow(ValidationError);
  });

  it('renombrar devuelve una instancia nueva sin mutar la original', () => {
    const original = CentroCoste.crearCentroCoste(
      { codigo: '510', nombre: 'Curicó', formatoId: FORMATO_ID },
      AHORA
    );
    const renombrado = original.renombrar('  Curicó Centro  ', DESPUES);

    expect(renombrado.nombre).toBe('Curicó Centro');
    expect(renombrado.updatedAt).toBe(DESPUES);
    expect(original.nombre).toBe('Curicó');
  });
});

describe('CentroCoste — conId y reconstitución', () => {
  const fila = {
    id: '33333333-3333-3333-3333-333333333333',
    codigo: '510',
    nombre: 'Curicó',
    formatoId: FORMATO_ID,
    version: 2,
    createdAt: AHORA,
    updatedAt: AHORA,
  };

  it('conId devuelve una copia con id asignado', () => {
    const centro = CentroCoste.crearCentroCoste(
      { codigo: '510', nombre: 'Curicó', formatoId: FORMATO_ID },
      AHORA
    );
    const persistido = centro.conId('44444444-4444-4444-4444-444444444444');

    expect(persistido.id).toBe('44444444-4444-4444-4444-444444444444');
    expect(centro.id).toBeNull();
  });

  it('reconstituye desde una fila de persistencia', () => {
    const centro = CentroCoste.reconstituirCentroCoste({
      ...fila,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    expect(centro.id).toBe(fila.id);
    expect(centro.codigo).toBe('510');
    expect(centro.nombre).toBe('Curicó');
    expect(centro.formatoId).toBe(FORMATO_ID);
    expect(centro.version).toBe(2);
    expect(centro.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  it('rechaza filas con datos obligatorios vacíos', () => {
    expect(() => CentroCoste.reconstituirCentroCoste({ ...fila, codigo: '' })).toThrow(
      ValidationError
    );
    expect(() => CentroCoste.reconstituirCentroCoste({ ...fila, id: '   ' })).toThrow(
      ValidationError
    );
    expect(() => CentroCoste.reconstituirCentroCoste({ ...fila, version: 0 })).toThrow(
      ValidationError
    );
    expect(() => CentroCoste.reconstituirCentroCoste({ ...fila, createdAt: 'invalida' })).toThrow(
      ValidationError
    );
  });
});

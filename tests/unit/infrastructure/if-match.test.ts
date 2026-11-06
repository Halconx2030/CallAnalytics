import { describe, expect, it } from 'vitest';

import { ValidationError } from '@domain/errors/DomainError.js';

import { versionEsperadaDe } from '@infrastructure/http/if-match.js';

import type { FastifyRequest } from 'fastify';

/** Construye una petición mínima con la cabecera `If-Match` indicada. */
function peticionConIfMatch(valor: string | string[] | undefined): FastifyRequest {
  return {
    headers: valor === undefined ? {} : { 'if-match': valor },
  } as unknown as FastifyRequest;
}

describe('versionEsperadaDe', () => {
  it('devuelve undefined si no viene la cabecera', () => {
    expect(versionEsperadaDe(peticionConIfMatch(undefined))).toBeUndefined();
  });

  it('acepta la etiqueta fuerte y la débil (RF-OPT-1.1)', () => {
    expect(versionEsperadaDe(peticionConIfMatch('"3"'))).toBe(3);
    expect(versionEsperadaDe(peticionConIfMatch('W/"3"'))).toBe(3);
  });

  it('usa el primer valor si la cabecera llega repetida', () => {
    expect(versionEsperadaDe(peticionConIfMatch(['W/"5"', '"9"']))).toBe(5);
  });

  it('rechaza un valor que no es un entero mayor o igual a 1 (RF-OPT-1.2)', () => {
    for (const valor of ['abc', '0', 'W/"x"', '-1', '', 'W/"0"']) {
      expect(() => versionEsperadaDe(peticionConIfMatch(valor)), valor).toThrow(ValidationError);
    }
  });

  it('rechaza los valores que solo empiezan por un entero (parseo estricto)', () => {
    // `Number.parseInt` los aceptaría como 3, 3 y 1: RF-OPT-1.2 exige un entero ≥ 1.
    for (const valor of ['3abc', '3.5', '1e3', '"3abc"', 'W/"3.5"']) {
      expect(() => versionEsperadaDe(peticionConIfMatch(valor)), valor).toThrow(ValidationError);
    }
  });

  it('rechaza una cabecera repetida y vacía', () => {
    expect(() => versionEsperadaDe(peticionConIfMatch([]))).toThrow(ValidationError);
  });
});

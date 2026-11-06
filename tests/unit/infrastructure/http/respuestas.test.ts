import { describe, expect, it } from 'vitest';

import type { PaginaCursor } from '@application/ports/repositories/paginacion.js';

import { toPaginaResponse } from '@infrastructure/http/respuestas.js';
import type { PaginaResponse } from '@infrastructure/http/respuestas.js';

/** Construye una página de dominio con `totalCount` conocido. */
function paginaDePrueba(totalCount: number): PaginaCursor<string> {
  return {
    items: ['L1', 'L2'],
    nextCursor: 'cursor-3',
    hasNextPage: true,
    totalCount,
  };
}

describe('toPaginaResponse (delta v1.4)', () => {
  it('propaga total_count del dominio a la respuesta HTTP (RF-PAG-1.5)', () => {
    const respuesta: PaginaResponse<string> = toPaginaResponse(
      paginaDePrueba(57),
      (item) => item,
    );

    expect(respuesta.total_count).toBe(57);
  });

  it('mapea los items e conserva next_cursor y has_next_page', () => {
    const respuesta = toPaginaResponse(paginaDePrueba(3), (item) => `id:${item}`);

    expect(respuesta.items).toEqual(['id:L1', 'id:L2']);
    expect(respuesta.next_cursor).toBe('cursor-3');
    expect(respuesta.has_next_page).toBe(true);
  });

  it('devuelve total_count 0 cuando la página está vacía (RF-PAG-1.2)', () => {
    const vacia: PaginaCursor<string> = {
      items: [],
      nextCursor: null,
      hasNextPage: false,
      totalCount: 0,
    };
    const respuesta = toPaginaResponse(vacia, (item) => item);

    expect(respuesta.total_count).toBe(0);
    expect(respuesta.items).toEqual([]);
    expect(respuesta.next_cursor).toBeNull();
    expect(respuesta.has_next_page).toBe(false);
  });
});

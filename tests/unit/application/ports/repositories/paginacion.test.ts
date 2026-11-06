import { describe, expect, it } from 'vitest';

import type { PaginaCursor } from '../../../../../src/application/ports/repositories/paginacion.js';

describe('PaginaCursor — RF-PAG-1.1 (totalCount)', () => {
  it('expone totalCount con el total de elementos que coinciden con los filtros', () => {
    const pagina: PaginaCursor<{ id: string; numero: string }> = {
      items: [
        { id: '1', numero: '+56912345678' },
        { id: '2', numero: '+56212345678' },
      ],
      nextCursor: 'abc123',
      hasNextPage: true,
      totalCount: 42,
    };

    expect(pagina.totalCount).toBe(42);
    expect(typeof pagina.totalCount).toBe('number');
    expect(pagina.items).toHaveLength(2);
  });
});

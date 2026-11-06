import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { paginaSchema } from '@infrastructure/http/schemas/comunes.js';

describe('paginaSchema (delta v1.4)', () => {
  const schema = paginaSchema(z.string());

  it('acepta total_count válido entero >= 0 (RF-PAG-1.3)', () => {
    for (const totalCount of [0, 1, 57, 1000]) {
      const resultado = schema.safeParse({
        items: ['L1'],
        next_cursor: null,
        has_next_page: false,
        total_count: totalCount,
      });

      expect(resultado.success).toBe(true);
      if (resultado.success) {
        expect(resultado.data.total_count).toBe(totalCount);
      }
    }
  });

  it('rechaza total_count negativo (RF-PAG-1.3)', () => {
    const resultado = schema.safeParse({
      items: [],
      next_cursor: null,
      has_next_page: false,
      total_count: -1,
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]!.path).toContain('total_count');
    }
  });

  it('rechaza total_count no entero (RF-PAG-1.3)', () => {
    const resultado = schema.safeParse({
      items: [],
      next_cursor: null,
      has_next_page: false,
      total_count: 3.5,
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]!.path).toContain('total_count');
    }
  });

  it('rechaza total_count ausente', () => {
    const resultado = schema.safeParse({
      items: [],
      next_cursor: null,
      has_next_page: false,
    });

    expect(resultado.success).toBe(false);
  });
});

import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

interface PaginaCentroCoste {
  readonly items: readonly { readonly id: string; readonly codigo: string }[];
  readonly next_cursor: string | null;
  readonly has_next_page: boolean;
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('la segunda página de centros de coste devuelve filas nuevas sin repetir la primera', async ({
  request,
}) => {
  const formatoId = await crearFormato(request, 'FMT-PAGINACION');

  // 25 centros de coste: la página 1 trae 20 y la página 2 el resto.
  for (let i = 0; i < 25; i++) {
    await crearCentroCoste(request, {
      codigo: `CCP-${String(i + 1).padStart(3, '0')}`,
      nombre: `CENTRO PAGINACION ${i + 1}`,
      formato_id: formatoId,
    });
  }

  // Página 1: limit=20, sin cursor (página 1).
  const respuesta1 = await request.get('/api/v1/centros-coste?limit=20');
  expect(respuesta1.status()).toBe(200);

  const pagina1 = (await respuesta1.json()) as PaginaCentroCoste;

  expect(pagina1.items).toHaveLength(20);
  expect(pagina1.has_next_page).toBe(true);
  expect(pagina1.next_cursor).not.toBeNull();

  const idsPagina1 = new Set(pagina1.items.map((centro) => centro.id));

  // Página 2: se reenvía el cursor de la última fila de la primera página.
  const respuesta2 = await request.get(
    `/api/v1/centros-coste?limit=20&after_id=${encodeURIComponent(pagina1.next_cursor!)}`
  );
  expect(respuesta2.status()).toBe(200);

  const pagina2 = (await respuesta2.json()) as PaginaCentroCoste;

  expect(pagina2.items.length).toBeGreaterThan(0);
  expect(pagina2.items.length).toBeLessThanOrEqual(20);
  // Última página: no hay más filas tras el cursor.
  expect(pagina2.has_next_page).toBe(false);
  expect(pagina2.next_cursor).toBeNull();

  // No se repite ningún centro de la primera página.
  const idsPagina2 = pagina2.items.map((centro) => centro.id);
  expect(idsPagina2.filter((id) => idsPagina1.has(id))).toEqual([]);
});

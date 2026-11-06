import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Page } from '@playwright/test';

/** Centros de coste creados: supera el límite de página (20) para forzar la página 2. */
const CANTIDAD_CENTROS = 25;

/** Panel de centros de coste dentro de /catalogos. */
function panelCentros(page: Page) {
  return page.locator('section.panel').filter({ hasText: 'Centros de coste' });
}

/** Filas de datos de la tabla de centros de coste (excluye filas de carga o "vacío"). */
function filasCentros(page: Page) {
  return panelCentros(page).locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/** Códigos de centro de coste de las filas visibles (primera columna de la tabla). */
function codigosCentros(page: Page) {
  return filasCentros(page).locator('td:nth-child(1)');
}

/** Texto informativo del paginador ("Página X de Y"). */
function infoPaginacion(page: Page) {
  return panelCentros(page).locator('.paginacion__info');
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('la segunda página de centros muestra filas distintas y aplicar/limpiar filtros reinicia la paginación', async ({
  page,
  request,
}) => {
  // Setup: 25 centros de coste por API (mismo formato) para forzar paginación (20 filas/página).
  const formatoId = await crearFormato(request, 'FMT-T28-PAGINACION');

  for (let i = 0; i < CANTIDAD_CENTROS; i++) {
    await crearCentroCoste(request, {
      codigo: `T28-${String(i + 1).padStart(3, '0')}`,
      nombre: `CENTRO T-28 ${i + 1}`,
      formato_id: formatoId,
    });
  }

  await page.goto('/catalogos');

  // --- Página 1: 20 filas, códigos distintos. ---
  await expect(filasCentros(page)).toHaveCount(20);

  const pagina1 = await codigosCentros(page).allInnerTexts();
  expect(pagina1).toHaveLength(20);
  expect(new Set(pagina1).size).toBe(20);

  // --- RF-QUAL-1.14: página 2 con filas distintas y sin repetir la página 1. ---
  await panelCentros(page).getByRole('button', { name: 'Siguiente ›' }).click();

  await expect(filasCentros(page)).toHaveCount(CANTIDAD_CENTROS - 20);
  await expect(infoPaginacion(page)).toHaveText(/Página 2/);

  const pagina2 = await codigosCentros(page).allInnerTexts();
  expect(pagina2.length).toBeGreaterThan(0);
  expect(pagina2.length).toBeLessThanOrEqual(20);
  expect(pagina2.filter((codigo) => pagina1.includes(codigo))).toEqual([]);

  // --- RF-QUAL-1.16: aplicar un filtro desde la página 2 vuelve a la página 1. ---
  const codigoFiltro = pagina1[0]!; // un centro que está en la página 1 (longitud 20 afirmada en la línea 56)

  await panelCentros(page).getByLabel('Código').fill(codigoFiltro);
  await panelCentros(page).getByRole('button', { name: 'Aplicar filtros' }).click();

  // La tabla vuelve a la página 1 con solo el centro que coincide con el filtro.
  await expect(filasCentros(page)).toHaveCount(1);
  await expect(codigosCentros(page)).toHaveText([codigoFiltro]);
  await expect(infoPaginacion(page)).toHaveText(/Página 1/);
  await expect(panelCentros(page).getByRole('button', { name: '‹ Anterior' })).toBeDisabled();

  // --- RF-QUAL-1.16: limpiar también vuelve a la página 1. ---
  await panelCentros(page).getByRole('button', { name: 'Limpiar' }).click();

  await expect(filasCentros(page)).toHaveCount(20);
  await expect(infoPaginacion(page)).toHaveText(/Página 1/);
  await expect(panelCentros(page).getByRole('button', { name: '‹ Anterior' })).toBeDisabled();
});

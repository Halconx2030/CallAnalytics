import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearFormato } from './helpers.js';

import type { Locator, Page } from '@playwright/test';

/** Cantidad de formatos creados: supera el límite de página (20) para forzar la página 2. */
const CANTIDAD_FORMATOS = 25;

/** Opciones esperadas en un select de formato: un placeholder + un option por formato. */
const OPCIONES_SELECT_ESPERADAS = CANTIDAD_FORMATOS + 1;

/** Panel de formatos dentro de /catalogos. */
function panelFormatos(page: Page) {
  return page.locator('section.panel').filter({ hasText: 'Formatos de centro de coste' });
}

/** Panel de centros de coste dentro de /catalogos. */
function panelCentros(page: Page) {
  return page.locator('section.panel').filter({ hasText: 'Centros de coste' });
}

/** Filas de datos de la tabla de formatos (excluye filas de carga o "vacío"). */
function filasFormatos(page: Page) {
  return panelFormatos(page).locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/** Nombres de formato de las filas visibles (primera columna de la tabla). */
function nombresFormatos(page: Page) {
  return filasFormatos(page).locator('td:nth-child(1)');
}

/** Opciones del select de formato dentro de un alcance (formulario o filtro). */
function opcionesDeFormato(scope: Locator) {
  return scope.getByLabel('Formato').locator('option');
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('la segunda página de formatos muestra filas distintas y los selects de formato no se vacían al paginar', async ({
  page,
  request,
}) => {
  // Setup: 25 formatos por API para forzar paginación (20 filas por página).
  for (let i = 0; i < CANTIDAD_FORMATOS; i++) {
    await crearFormato(request, `FMT-PAG-${String(i + 1).padStart(2, '0')}`);
  }

  await page.goto('/catalogos');

  // --- Página 1 de la tabla de formatos: 20 filas, todas distintas. ---
  await expect(filasFormatos(page)).toHaveCount(20);

  const pagina1 = await nombresFormatos(page).allInnerTexts();
  expect(pagina1).toHaveLength(20);
  expect(new Set(pagina1).size).toBe(20);

  // --- RF-QUAL-1.15 (antes de paginar): el select de formato del formulario
  // de centro de coste trae el catálogo completo, independiente de la tabla. ---
  await page.getByRole('button', { name: 'Nuevo centro de coste' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  await expect(opcionesDeFormato(modal)).toHaveCount(OPCIONES_SELECT_ESPERADAS);

  await modal.getByRole('button', { name: 'Cancelar' }).click();

  // --- RF-QUAL-1.13: página 2 con filas distintas y sin repetir la página 1. ---
  await panelFormatos(page).getByRole('button', { name: 'Siguiente ›' }).click();

  await expect(filasFormatos(page)).toHaveCount(CANTIDAD_FORMATOS - 20);

  const pagina2 = await nombresFormatos(page).allInnerTexts();
  expect(pagina2.length).toBeGreaterThan(0);
  expect(pagina2.filter((nombre) => pagina1.includes(nombre))).toEqual([]);

  // --- RF-QUAL-1.15 (después de paginar): los selects de formato siguen con
  // el catálogo completo, ni el del formulario de centro de coste ni el del
  // filtro de la tabla de centros de coste. ---
  await page.getByRole('button', { name: 'Nuevo centro de coste' }).click();
  const modalDespues = page.getByRole('dialog');
  await expect(modalDespues).toBeVisible();

  await expect(opcionesDeFormato(modalDespues)).toHaveCount(OPCIONES_SELECT_ESPERADAS);
  await modalDespues.getByRole('button', { name: 'Cancelar' }).click();

  await expect(opcionesDeFormato(panelCentros(page))).toHaveCount(OPCIONES_SELECT_ESPERADAS);
});

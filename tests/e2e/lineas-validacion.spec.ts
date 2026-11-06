import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Page } from '@playwright/test';

/** Peticiones `POST /api/v1/lineas` que salen del navegador. */
function contarAltasDeLinea(page: Page): { total: number } {
  const contador = { total: 0 };

  page.on('request', (peticion) => {
    const url = new URL(peticion.url());

    if (peticion.method() === 'POST' && url.pathname === '/api/v1/lineas') {
      contador.total += 1;
    }
  });

  return contador;
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('el formulario valida en cliente y no envía nada al servidor', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');

  await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  const altas = contarAltasDeLinea(page);

  await page.goto('/lineas');

  await page.getByRole('button', { name: 'Nueva línea' }).click();

  const modal = page.getByRole('dialog');

  await expect(modal).toBeVisible();

  // Sin datos: el número y el centro de coste son obligatorios.
  await modal.getByRole('button', { name: 'Crear línea' }).click();

  await expect(modal.getByText('El número es obligatorio')).toBeVisible();
  await expect(modal.getByText('Selecciona un centro de coste')).toBeVisible();

  // Número y centro válidos, pero costo negativo.
  await modal.getByLabel('Número *').fill('+56912345678');
  await modal.getByLabel('Centro de coste *', { exact: true }).fill('510');
  await modal.locator('.combobox__opcion', { hasText: '510 · Central' }).click();
  await modal.getByLabel('Costo mensual').fill('-1');

  await modal.getByRole('button', { name: 'Crear línea' }).click();

  await expect(modal.getByText('El costo no puede ser negativo')).toBeVisible();

  // Los errores de número y centro ya no se muestran (esos campos son válidos).
  await expect(modal.getByText('El número es obligatorio')).toHaveCount(0);
  await expect(modal.getByText('Selecciona un centro de coste')).toHaveCount(0);

  // Ninguna alta salió a la API: la validación es del lado del cliente.
  expect(altas.total).toBe(0);
});

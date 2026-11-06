import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato, crearLinea } from './helpers.js';

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('muestra los cuatro KPIs con los valores de la base de datos', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await crearLinea(request, {
    numero: '+56911111111',
    centro_coste_id: centroId,
    estado: 'activa',
  });
  await crearLinea(request, {
    numero: '+56922222222',
    centro_coste_id: centroId,
    estado: 'pendiente',
    tipo_uso: 'geovictoria',
  });

  await page.goto('/');

  await expect(page.getByText('Total de líneas')).toBeVisible();
  await expect(page.getByText('Líneas activas')).toBeVisible();
  await expect(page.getByText('Uso personal')).toBeVisible();
  await expect(page.getByText('Uso Geovictoria')).toBeVisible();

  const valores = page.locator('.kpi__valor');

  await expect(valores.nth(0)).toHaveText('2');
  await expect(valores.nth(1)).toHaveText('1');
  await expect(valores.nth(2)).toHaveText('1');
  await expect(valores.nth(3)).toHaveText('1');
});

test('permite navegar a los módulos del menú lateral', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'Líneas' }).click();
  await expect(page).toHaveURL(/\/lineas$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Líneas telefónicas' })).toBeVisible();

  await page.getByRole('link', { name: 'Formatos y centros' }).click();
  await expect(page).toHaveURL(/\/catalogos$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Formatos de centro de coste' })
  ).toBeVisible();

  await page.getByRole('link', { name: 'Importación' }).click();
  await expect(page).toHaveURL(/\/importacion$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Importar Centros de coste' })
  ).toBeVisible();
});

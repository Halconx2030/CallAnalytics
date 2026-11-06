import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Page } from '@playwright/test';

/** Panel de formatos de centro de coste (la página tiene dos tablas). */
function panelFormatos(page: Page) {
  return page.locator('section.panel').filter({ hasText: 'Formatos de centro de coste' });
}

/** Panel de centros de coste. */
function panelCentros(page: Page) {
  return page.locator('section.panel').filter({ hasText: 'Centros de coste' });
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('crea un formato y un centro de coste desde la interfaz', async ({ page }) => {
  await page.goto('/catalogos');

  await page.getByRole('button', { name: 'Nuevo formato' }).click();

  const modalFormato = page.getByRole('dialog');
  await modalFormato.getByLabel('Nombre').fill('SMU');
  await modalFormato.getByRole('button', { name: 'Guardar' }).click();

  await expect(panelFormatos(page).locator('tbody tr').filter({ hasText: 'SMU' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Nuevo centro de coste' }).click();

  const modalCentro = page.getByRole('dialog');
  await modalCentro.getByLabel('Código').fill('510 RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO');
  await modalCentro.getByLabel('Nombre').fill('RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO');
  await modalCentro.getByLabel('Formato').selectOption({ label: 'SMU' });
  await modalCentro.getByRole('button', { name: 'Guardar' }).click();

  const filaCentro = panelCentros(page)
    .locator('tbody tr')
    .filter({ hasText: '510 RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO' });

  await expect(filaCentro).toHaveCount(1);
  await expect(filaCentro).toContainText('SMU');
});

test('no permite eliminar un formato con centros de coste asociados', async ({ page, request }) => {
  await request.post('/api/v1/formatos', { data: { nombre: 'SMU' } });

  const formatos = (await (await request.get('/api/v1/formatos')).json()) as {
    items: { id: string; nombre: string }[];
  };

  await request.post('/api/v1/centros-coste', {
    data: {
      codigo: '510',
      nombre: 'Central',
      formato_id: formatos.items.find((formato) => formato.nombre === 'SMU')?.id,
    },
  });

  await page.goto('/catalogos');

  page.once('dialog', (dialogo) => {
    void dialogo.accept();
  });

  const fila = panelFormatos(page).locator('tbody tr').filter({ hasText: 'SMU' });
  await fila.getByRole('button', { name: 'Eliminar' }).click();

  await expect(page.locator('.estado--error')).toBeVisible();
  await expect(panelFormatos(page).locator('tbody tr').filter({ hasText: 'SMU' })).toHaveCount(1);
});

test('filtra los centros de coste por código', async ({ page, request }) => {
  await request.post('/api/v1/formatos', { data: { nombre: 'SMU' } });

  const formatos = (await (await request.get('/api/v1/formatos')).json()) as {
    items: { id: string; nombre: string }[];
  };

  const formatoId = formatos.items.find((formato) => formato.nombre === 'SMU')?.id ?? '';

  await request.post('/api/v1/centros-coste', {
    data: { codigo: '510', nombre: 'Central', formato_id: formatoId },
  });
  await request.post('/api/v1/centros-coste', {
    data: { codigo: 'C059102801', nombre: 'FALABELLA TOTTUS', formato_id: formatoId },
  });

  await page.goto('/catalogos');

  await expect(panelFormatos(page).locator('tbody tr')).toHaveCount(1); // 1 formato
  await expect(panelCentros(page).locator('tbody tr')).toHaveCount(2); // 2 centros

  await panelCentros(page).getByLabel('Código', { exact: true }).fill('510');
  await panelCentros(page).getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(
    panelCentros(page).locator('tbody tr').filter({ hasText: 'C059102801' })
  ).toHaveCount(0);
});

test('elimina un centro de coste y un formato sin dependencias desde la interfaz', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');
  await crearCentroCoste(request, {
    codigo: 'E2E-TMP-001',
    nombre: 'Centro temporal E2E',
    formato_id: formatoId,
  });
  await crearFormato(request, 'E2E-FMT-TMP');

  await page.goto('/catalogos');

  const filaCentro = panelCentros(page).locator('tbody tr').filter({ hasText: 'E2E-TMP-001' });
  await expect(filaCentro).toHaveCount(1);

  page.once('dialog', (dialogo) => {
    void dialogo.accept();
  });

  await filaCentro.getByRole('button', { name: 'Eliminar' }).click();

  await expect(
    panelCentros(page).locator('tbody tr').filter({ hasText: 'E2E-TMP-001' })
  ).toHaveCount(0);
  await expect(page.locator('.estado--error')).toHaveCount(0);

  const filaFormato = panelFormatos(page).locator('tbody tr').filter({ hasText: 'E2E-FMT-TMP' });
  await expect(filaFormato).toHaveCount(1);

  page.once('dialog', (dialogo) => {
    void dialogo.accept();
  });

  await filaFormato.getByRole('button', { name: 'Eliminar' }).click();

  await expect(
    panelFormatos(page).locator('tbody tr').filter({ hasText: 'E2E-FMT-TMP' })
  ).toHaveCount(0);
  await expect(page.locator('.estado--error')).toHaveCount(0);
});

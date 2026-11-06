import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Download } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Filas reales de la tabla (excluye la fila de estado vacío "Sin registros"). */
function filas(page: Page) {
  return page.locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/** Lee el contenido textual de un archivo descargado. */
async function contenidoDe(descarga: Download): Promise<string> {
  const flujo = await descarga.createReadStream();
  const trozos: Buffer[] = [];

  for await (const trozo of flujo) {
    trozos.push(trozo as Buffer);
  }

  return Buffer.concat(trozos).toString('utf8');
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('crea una línea, la edita y la muestra en la tabla', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await page.goto('/lineas');

  await page.getByRole('button', { name: 'Nueva línea' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();

  await modal.getByLabel('Número *').fill('+56911111111');
  await modal.getByLabel('Centro de coste *').fill('510');
  await modal.locator('.combobox__opcion', { hasText: '510 · Central' }).click();
  await modal.getByLabel('Costo mensual').fill('5000');
  await modal.getByLabel('Tipo de uso').selectOption('geovictoria');

  await modal.getByRole('button', { name: 'Crear línea' }).click();

  const fila = page.locator('table tbody tr').filter({ hasText: '+56911111111' });
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText('geovictoria');
  await expect(fila).toContainText('pendiente');

  await fila.getByRole('button', { name: 'Editar' }).click();

  const modalEdicion = page.getByRole('dialog');
  await modalEdicion.getByLabel('Proveedor').fill('Entel');
  await modalEdicion.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(fila).toContainText('Entel');
});

test('cambia el estado de una línea y la da de baja', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: centroId },
  });

  await page.goto('/lineas');

  const fila = page.locator('table tbody tr').filter({ hasText: '+56911111111' });
  await expect(fila).toHaveCount(1);

  await fila.getByLabel('Estado de +56911111111').selectOption('activa');
  await expect(fila.locator('.estado-badge')).toHaveText('activa');

  page.once('dialog', (dialogo) => {
    void dialogo.accept();
  });

  await fila.getByRole('button', { name: 'Dar de baja' }).click();

  await expect(page.locator('table tbody tr').filter({ hasText: '+56911111111' })).toHaveCount(0);
});

test('filtra el listado por número', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: centroId },
  });
  await request.post('/api/v1/lineas', {
    data: { numero: '+56922222222', centro_coste_id: centroId },
  });

  await page.goto('/lineas');

  await expect(filas(page)).toHaveCount(2);

  await page.locator('.filtros').getByLabel('Número', { exact: true }).fill('11111111');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page)).toContainText('+56911111111');

  await page.getByRole('button', { name: 'Limpiar' }).first().click();

  await expect(filas(page)).toHaveCount(2);
});

test('cambia el estado de varias líneas seleccionadas', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: centroId },
  });
  await request.post('/api/v1/lineas', {
    data: { numero: '+56922222222', centro_coste_id: centroId },
  });

  await page.goto('/lineas');

  await page.getByLabel('Seleccionar +56911111111').check();
  await page.getByLabel('Seleccionar +56922222222').check();

  await expect(page.locator('.bulk__info')).toHaveText('2 línea(s) seleccionada(s)');

  await page.locator('.bulk select').selectOption('activa');
  await page.getByRole('button', { name: 'Aplicar a seleccionadas' }).click();

  await expect(page.locator('.bulk__resultado')).toContainText('Actualizadas: 2');
});

test('exporta el listado a CSV', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: centroId },
  });

  await page.goto('/lineas');

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);

  expect(descarga.suggestedFilename()).toMatch(/^lineas_\d{8}_\d{6}\.csv$/);
});

test('exporta las líneas dadas de baja cuando se marca "incluir bajas"', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  const creacion = await request.post('/api/v1/lineas', {
    data: { numero: '+56912345678', centro_coste_id: centroId },
  });

  expect(creacion.status()).toBe(201);

  const id = ((await creacion.json()) as { id: string }).id;

  // Baja lógica por la API.
  const baja = await request.delete(`/api/v1/lineas/${id}`);

  expect(baja.status()).toBe(200);

  await page.goto('/lineas');

  // La UI no lista las bajas: la línea no aparece en la tabla.
  await expect(filas(page)).toHaveCount(0);

  // Sin marcar la opción, el CSV no incluye la línea de baja.
  const [sinBajas] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);

  expect(await contenidoDe(sinBajas)).not.toContain('+56912345678');

  // Marcando "incluir bajas", el CSV sí la incluye.
  await page
    .locator('.toolbar')
    .getByLabel('Incluir líneas dadas de baja en la exportación')
    .check();

  const [conBajas] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);

  expect(await contenidoDe(conBajas)).toContain('+56912345678');
});

test('reactiva por la API una línea dada de baja y esta vuelve al listado', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  const creacion = await request.post('/api/v1/lineas', {
    data: { numero: '+56912345678', centro_coste_id: centroId },
  });

  expect(creacion.status()).toBe(201);

  const id = ((await creacion.json()) as { id: string }).id;

  const baja = await request.delete(`/api/v1/lineas/${id}`);

  expect(baja.status()).toBe(200);

  await page.goto('/lineas');

  // Con la línea de baja, el listado no la muestra.
  await expect(filas(page)).toHaveCount(0);

  // Reactivación por la API (la UI no lista las bajas, así que no se puede
  // reactivar desde la tabla).
  const reactivacion = await request.patch(`/api/v1/lineas/${id}/estado`, {
    data: { estado: 'activa' },
  });

  expect(reactivacion.status()).toBe(200);

  await page.reload();

  // La línea vuelve a aparecer y su selector de estado muestra "activa".
  const fila = page.locator('table tbody tr').filter({ hasText: '+56912345678' });

  await expect(fila).toHaveCount(1);
  await expect(fila.getByLabel('Estado de +56912345678')).toHaveValue('activa');
});

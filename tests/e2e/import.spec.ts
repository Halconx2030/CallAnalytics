import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato, csvCentrosCoste, csvLineas } from './helpers.js';

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

/** CSV de centros de coste que referencia un formato que no existe en la base de datos. */
function csvCentroConFormatoNuevo(): string {
  return ['codigo,nombre,formato_nombre', '900,ADMINISTRACION CENTRAL,ADMINISTRACION'].join('\n');
}

test('importa centros de coste desde un CSV y muestra el reporte', async ({ page, request }) => {
  await crearFormato(request, 'SMU');
  await crearFormato(request, 'FALABELLA');

  await page.goto('/importacion');

  const seccion = page.locator('section.panel').filter({ hasText: 'Importar Centros de coste' });

  await seccion.locator('input[type="file"]').setInputFiles({
    name: 'centros.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvCentrosCoste(), 'utf8'),
  });

  await seccion.getByRole('button', { name: 'Importar centros de coste' }).click();

  await expect(seccion.getByRole('tab', { name: 'Insertados' })).toBeVisible();
  await expect(seccion.locator('.reporte__dato').first()).toContainText('2');

  const respuesta = await request.get('/api/v1/centros-coste');
  const centros = (await respuesta.json()) as { items: { codigo: string }[] };

  expect(centros.items).toHaveLength(2);
  expect(centros.items.map((centro) => centro.codigo)).toContain(
    '510 RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO'
  );
});

test('importa centros de coste con un formato nuevo y crea el formato automáticamente', async ({
  page,
  request,
}) => {
  await crearFormato(request, 'SMU');

  await page.goto('/importacion');

  const seccion = page.locator('section.panel').filter({ hasText: 'Importar Centros de coste' });

  // La opción viene activada por defecto.
  const casilla = seccion.locator('input[name="crear_formatos_faltantes"]');
  await expect(casilla).toBeChecked();

  await seccion.locator('input[type="file"]').setInputFiles({
    name: 'centros.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvCentroConFormatoNuevo(), 'utf8'),
  });

  await seccion.getByRole('button', { name: 'Importar centros de coste' }).click();

  await expect(seccion.getByText('Formatos creados:')).toBeVisible();
  await expect(seccion.getByText('ADMINISTRACION', { exact: false })).toBeVisible();
  await expect(seccion.getByRole('tab', { name: 'Insertados' })).toBeVisible();
  await expect(seccion.locator('.reporte__dato').first()).toContainText('1');

  const formatos = await request.get('/api/v1/formatos?limit=100');
  const listaFormatos = (await formatos.json()) as { items: { nombre: string }[] };

  expect(listaFormatos.items.map((formato) => formato.nombre)).toContain('ADMINISTRACION');

  const centros = await request.get('/api/v1/centros-coste');
  const listaCentros = (await centros.json()) as { items: { codigo: string }[] };

  expect(listaCentros.items).toHaveLength(1);
  expect(listaCentros.items[0]?.codigo).toBe('900');
});

test('importa líneas desde un CSV y reporta los duplicados', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: '510',
    nombre: 'Central',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: centroId },
  });

  await page.goto('/importacion');

  const seccion = page.locator('section.panel').filter({ hasText: 'Importar Líneas' });

  await seccion.locator('input[type="file"]').setInputFiles({
    name: 'lineas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvLineas(), 'utf8'),
  });

  await seccion.getByRole('button', { name: 'Importar líneas' }).click();

  await expect(seccion.getByRole('tab', { name: 'Duplicados' })).toBeVisible();

  const respuesta = await request.get('/api/v1/lineas');
  const lineas = (await respuesta.json()) as { items: { numero: string }[] };

  expect(lineas.items).toHaveLength(2);
});

test('rechaza un archivo con extensión no soportada', async ({ page }) => {
  await page.goto('/importacion');

  const seccion = page.locator('section.panel').filter({ hasText: 'Importar Centros de coste' });

  await seccion.locator('input[type="file"]').setInputFiles({
    name: 'centros.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('codigo,nombre,formato_nombre', 'utf8'),
  });

  await expect(
    seccion.getByText('El archivo debe ser CSV (.csv) o Excel (.xlsx, .xls)')
  ).toBeVisible();
});

test('descarga la plantilla de centros de coste', async ({ page }) => {
  await page.goto('/importacion');

  const seccion = page.locator('section.panel').filter({ hasText: 'Importar Centros de coste' });

  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    seccion.getByRole('button', { name: 'Descargar plantilla' }).click(),
  ]);

  expect(descarga.suggestedFilename()).toBe('plantilla_centros_coste.csv');
});

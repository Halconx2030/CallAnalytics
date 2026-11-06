import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Page } from '@playwright/test';

/** Filas reales de la tabla (excluye la fila de estado vacío "Sin registros"). */
function filas(page: Page) {
  return page.locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/** Coincidencias individuales del buscador (excluye la opción "todos los que coincidan"). */
function opcionesIndividuales(page: Page) {
  return page.locator('.filtros .combobox__opcion:not(.combobox__opcion--multiple)');
}

/** Opción especial "Todos los centros que coincidan con …". */
function opcionMultiple(page: Page) {
  return page.locator('.filtros .combobox__opcion--multiple');
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('busca un centro de coste por texto y filtra el listado de líneas', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');

  const idObjetivo = await crearCentroCoste(request, {
    codigo: 'BUSCA-UNO',
    nombre: 'CENTRO UNICO DE PRUEBA',
    formato_id: formatoId,
  });
  const idOtro = await crearCentroCoste(request, {
    codigo: 'BUSCA-DOS',
    nombre: 'CENTRO DISTINTO DE PRUEBA',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: idObjetivo },
  });
  await request.post('/api/v1/lineas', {
    data: { numero: '+56922222222', centro_coste_id: idOtro },
  });

  await page.goto('/lineas');
  await expect(filas(page)).toHaveCount(2);

  const buscador = page.locator('.filtros').getByLabel('Centro de coste', { exact: true });
  await buscador.fill('UNICO');

  const opciones = opcionesIndividuales(page);
  await expect(opciones).toHaveCount(1);
  await expect(opciones.first()).toContainText('BUSCA-UNO · CENTRO UNICO DE PRUEBA');

  await opciones.first().click();
  await expect(buscador).toHaveValue('BUSCA-UNO · CENTRO UNICO DE PRUEBA');

  await page.locator('.filtros').getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page)).toContainText('+56911111111');
});

test('el panel de filtros expone un único control de centro de coste', async ({ page }) => {
  await page.goto('/lineas');

  const panel = page.locator('.filtros');

  // Un solo buscador por código o nombre (los `select` de enums usan otro rol).
  await expect(panel.locator('input[role="combobox"]')).toHaveCount(1);
  await expect(panel.getByLabel('Centro de coste', { exact: true })).toHaveCount(1);

  // Ya no existen los inputs de texto "Centro de coste (código)" y "(nombre)".
  await expect(panel.locator('input[name="centro_coste_codigo"]')).toHaveCount(0);
  await expect(panel.locator('input[name="centro_coste_nombre"]')).toHaveCount(0);
});

test('el buscador muestra "Sin resultados" y permite limpiar la selección', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');

  await crearCentroCoste(request, {
    codigo: 'BUSCA-TRES',
    nombre: 'CENTRO TRES DE PRUEBA',
    formato_id: formatoId,
  });

  await page.goto('/lineas');

  const buscador = page.locator('.filtros').getByLabel('Centro de coste', { exact: true });

  await buscador.fill('NOEXISTE');
  await expect(page.locator('.filtros .combobox__estado')).toHaveText('Sin resultados');
  await expect(opcionesIndividuales(page)).toHaveCount(0);

  // El modo "todos los que coincidan" sigue disponible aunque no haya coincidencias.
  await expect(opcionMultiple(page)).toHaveCount(1);

  await buscador.fill('TRES');
  await opcionesIndividuales(page).first().click();
  await expect(buscador).toHaveValue('BUSCA-TRES · CENTRO TRES DE PRUEBA');

  await page.getByRole('button', { name: 'Limpiar centro de coste' }).click();
  await expect(buscador).toHaveValue('');
});

test('filtra por todos los centros que coincidan o por uno concreto', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');

  const idAlfa = await crearCentroCoste(request, {
    codigo: 'ZZTEST-A',
    nombre: 'CENTRO ZZTEST ALFA',
    formato_id: formatoId,
  });
  const idBeta = await crearCentroCoste(request, {
    codigo: 'ZZTEST-B',
    nombre: 'CENTRO ZZTEST BETA',
    formato_id: formatoId,
  });

  await request.post('/api/v1/lineas', {
    data: { numero: '+56911111111', centro_coste_id: idAlfa },
  });
  await request.post('/api/v1/lineas', {
    data: { numero: '+56922222222', centro_coste_id: idBeta },
  });

  await page.goto('/lineas');
  await expect(filas(page)).toHaveCount(2);

  const buscador = page.locator('.filtros').getByLabel('Centro de coste', { exact: true });
  await buscador.fill('ZZTEST');

  // La opción múltiple aparece encima de las coincidencias individuales.
  const multiple = opcionMultiple(page);
  await expect(multiple).toHaveCount(1);
  await expect(multiple).toContainText('Todos los centros que coincidan con «ZZTEST»');
  await expect(opcionesIndividuales(page)).toHaveCount(2);

  // Modo "todos los que coincidan": aparecen las líneas de los dos centros.
  await multiple.click();
  await expect(buscador).toHaveValue('ZZTEST');

  await page.locator('.filtros').getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(filas(page)).toHaveCount(2);
  await expect(page.locator('table')).toContainText('+56911111111');
  await expect(page.locator('table')).toContainText('+56922222222');

  // Modo "un centro concreto": solo aparece su línea.
  await buscador.fill('ZZTEST-A');
  await expect(opcionesIndividuales(page)).toHaveCount(1);
  await opcionesIndividuales(page).first().click();
  await expect(buscador).toHaveValue('ZZTEST-A · CENTRO ZZTEST ALFA');

  await page.locator('.filtros').getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(filas(page)).toHaveCount(1);
  await expect(page.locator('table')).toContainText('+56911111111');
  await expect(page.locator('table')).not.toContainText('+56922222222');
});

test('el formulario de línea no ofrece el modo "todos los que coincidan"', async ({ page }) => {
  await page.goto('/lineas');

  await page.getByRole('button', { name: 'Nueva línea' }).click();

  const modal = page.locator('.modal');
  const buscador = modal.getByLabel('Centro de coste *', { exact: true });

  await buscador.fill('ZZTEST');

  await expect(modal.locator('.combobox__opcion--multiple')).toHaveCount(0);
  await expect(modal.locator('.combobox__estado')).toHaveText('Sin resultados');
});

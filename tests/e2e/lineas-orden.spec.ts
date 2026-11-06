import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { APIRequestContext, Page } from '@playwright/test';

/** Filas reales de la tabla (excluye la fila de estado vacío "Sin registros"). */
function filas(page: Page) {
  return page.locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/**
 * Columna del número de cada fila.
 *
 * La primera columna de la tabla es la casilla de selección, así que el número
 * es la segunda celda (`td:nth-child(2)`).
 */
function numeros(page: Page) {
  return filas(page).locator('td:nth-child(2)');
}

/** Botones de ordenamiento de las cabeceras de la tabla. */
function cabecerasOrdenables(page: Page) {
  return page.locator('thead th button');
}

/**
 * Espera la petición al listado de líneas.
 *
 * Si `sort` es `undefined` espera cualquier petición del listado; si se
 * indica, espera la que lleva esa columna de orden.
 */
function esperarPeticion(page: Page, sort?: string) {
  return page.waitForRequest((peticion) => {
    const url = new URL(peticion.url());

    if (url.pathname !== '/api/v1/lineas') {
      return false;
    }

    return sort === undefined || url.searchParams.get('sort') === sort;
  });
}

/**
 * Crea tres líneas con proveedores y centros de coste distintos.
 *
 * El orden de los proveedores y de los códigos de centro de coste es
 * deliberadamente distinto del orden de creación, para que la comprobación de
 * las filas ordenadas distinga el orden pedido del orden por defecto
 * (`created_at DESC`).
 */
async function crearLineas(request: APIRequestContext): Promise<void> {
  const formatoId = await crearFormato(request, 'SMU');

  const centroA = await crearCentroCoste(request, {
    codigo: 'ORD-A',
    nombre: 'CENTRO ORDEN A',
    formato_id: formatoId,
  });
  const centroB = await crearCentroCoste(request, {
    codigo: 'ORD-B',
    nombre: 'CENTRO ORDEN B',
    formato_id: formatoId,
  });
  const centroC = await crearCentroCoste(request, {
    codigo: 'ORD-C',
    nombre: 'CENTRO ORDEN C',
    formato_id: formatoId,
  });

  const lineas = [
    { numero: '+56911111111', centro_coste_id: centroA, proveedor: 'Zeta' },
    { numero: '+56922222222', centro_coste_id: centroB, proveedor: 'Alfa' },
    { numero: '+56933333333', centro_coste_id: centroC, proveedor: 'Medio' },
  ];

  for (const linea of lineas) {
    await request.post('/api/v1/lineas', { data: linea });

    // Separa las inserciones para que `created_at` (orden por defecto) sea
    // distinto en cada línea.
    await new Promise((resolver) => {
      setTimeout(resolver, 20);
    });
  }
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('ordena por proveedor al pulsar la cabecera de la tabla', async ({ page, request }) => {
  await crearLineas(request);

  await page.goto('/lineas');
  await expect(filas(page)).toHaveCount(3);

  // Orden por defecto: `created_at DESC` (la última creada primero).
  await expect(numeros(page)).toHaveText(['+56933333333', '+56922222222', '+56911111111']);

  const peticion = esperarPeticion(page, 'proveedor');

  await page.locator('thead').getByRole('button', { name: 'Proveedor' }).click();

  const url = new URL((await peticion).url());

  expect(url.searchParams.get('sort')).toBe('proveedor');
  expect(url.searchParams.get('order')).toBe('asc');

  // Orden por proveedor ascendente: Alfa, Medio, Zeta.
  await expect(numeros(page)).toHaveText(['+56922222222', '+56933333333', '+56911111111']);
});

test('ordena por centro de coste usando el código de la API', async ({ page, request }) => {
  await crearLineas(request);

  await page.goto('/lineas');
  await expect(filas(page)).toHaveCount(3);

  const peticion = esperarPeticion(page, 'centro_coste_codigo');

  await page.locator('thead').getByRole('button', { name: 'Centro de Coste' }).click();

  const url = new URL((await peticion).url());

  // La columna de la tabla se llama "Centro de Coste", pero la API espera
  // `centro_coste_codigo` (enviar `centro_coste` respondería 400).
  expect(url.searchParams.get('sort')).toBe('centro_coste_codigo');
  expect(url.searchParams.get('order')).toBe('asc');

  // Orden por código de centro de coste ascendente: ORD-A, ORD-B, ORD-C.
  await expect(numeros(page)).toHaveText(['+56911111111', '+56922222222', '+56933333333']);
});

test('ofrece ordenamiento en todas las columnas visibles menos empleado', async ({ page }) => {
  await page.goto('/lineas');

  // 8 columnas ordenables: las 9 visibles de la tabla menos `empleado`
  // (admite NULL y rompería el cursor *keyset*, decisión Q4 de la spec).
  await expect(cabecerasOrdenables(page)).toHaveCount(8);

  const titulos = (await cabecerasOrdenables(page).allInnerTexts()).map((titulo) =>
    titulo.replace(/[▲▼]\s*$/, '').trim()
  );

  expect(titulos).toEqual([
    'Número',
    'Proveedor',
    'Centro de Coste',
    'Fecha Asignación',
    'Costo',
    'Tipo',
    'Estado',
    'Uso',
  ]);

  // `empleado` sigue siendo una columna visible, pero no es ordenable.
  await expect(page.locator('thead').getByRole('button', { name: 'Empleado' })).toHaveCount(0);
  await expect(page.locator('thead th', { hasText: 'Empleado' })).toHaveCount(1);
});

test('al cambiar de orden se reinicia la paginación', async ({ page, request }) => {
  const formatoId = await crearFormato(request, 'SMU');
  const centroId = await crearCentroCoste(request, {
    codigo: 'ORD-PAG',
    nombre: 'CENTRO PAGINACION',
    formato_id: formatoId,
  });

  // 21 líneas: obligan a una segunda página.
  for (let indice = 1; indice <= 21; indice += 1) {
    const numero = `+569${String(indice).padStart(8, '0')}`;

    const respuesta = await request.post('/api/v1/lineas', {
      data: { numero, centro_coste_id: centroId, proveedor: 'Entel' },
    });

    expect(respuesta.status()).toBe(201);
  }

  await page.goto('/lineas');
  await expect(filas(page)).toHaveCount(20);

  // La segunda página viaja con un cursor (`after_id`) ligado al orden actual.
  const conCursor = esperarPeticion(page);
  await page.getByRole('button', { name: 'Siguiente ›' }).click();

  const urlConCursor = new URL((await conCursor).url());

  expect(urlConCursor.searchParams.get('after_id')).not.toBeNull();
  await expect(filas(page)).toHaveCount(1);

  // Al cambiar de columna de orden el cursor se reinicia: el cursor emitido
  // para otra columna sería rechazado por la API con un 400.
  const peticion = esperarPeticion(page, 'centro_coste_codigo');
  await page.locator('thead').getByRole('button', { name: 'Centro de Coste' }).click();

  const url = new URL((await peticion).url());

  expect(url.searchParams.get('sort')).toBe('centro_coste_codigo');
  expect(url.searchParams.get('after_id')).toBeNull();
  await expect(filas(page)).toHaveCount(20);
});

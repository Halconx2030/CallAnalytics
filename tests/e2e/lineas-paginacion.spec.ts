import { expect, test } from '@playwright/test';

import { vaciarBaseDePruebas } from './db.js';
import { crearCentroCoste, crearFormato } from './helpers.js';

import type { Page } from '@playwright/test';

/** Filas reales de la tabla (excluye la fila de estado vacío "Sin registros"). */
function filas(page: Page) {
  return page.locator('table tbody tr:not(:has(td.tabla__vacia))');
}

/**
 * Números de teléfono de las filas visibles.
 *
 * La primera columna de la tabla es la casilla de selección, así que el número
 * es la segunda celda (`td:nth-child(2)`).
 */
function numeros(page: Page) {
  return filas(page).locator('td:nth-child(2)');
}

/**
 * CSV con `cantidad` líneas para el centro de coste dado.
 *
 * Los números son correlativos y válidos (móvil chileno) y el centro existe, así
 * que la importación es todo-o-nada y no debe reportar errores.
 */
function csvConLineas(centroCosteCodigo: string, cantidad: number): string {
  const cabecera = 'numero,proveedor,centro_coste_codigo,costo_mensual,tipo_uso';

  const cuerpo = Array.from({ length: cantidad }, (_, indice) => {
    const numero = `+569${String(10000001 + indice)}`;

    return `${numero},Entel,${centroCosteCodigo},5000,personal`;
  });

  return [cabecera, ...cuerpo].join('\n');
}

test.beforeEach(async () => {
  await vaciarBaseDePruebas();
});

test('la segunda página muestra líneas nuevas sin repetir las de la primera', async ({
  page,
  request,
}) => {
  const formatoId = await crearFormato(request, 'SMU');

  await crearCentroCoste(request, {
    codigo: 'PAG-001',
    nombre: 'CENTRO PAGINACION',
    formato_id: formatoId,
  });

  // Las 21 líneas se preparan con **una sola** importación CSV: 21 altas por
  // API serían lentas (riesgo señalado por la tarea).
  const importacion = await request.post('/api/v1/import/lineas', {
    multipart: {
      file: {
        name: 'lineas.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvConLineas('PAG-001', 21), 'utf8'),
      },
    },
  });

  expect(importacion.status()).toBe(200);

  const reporte = (await importacion.json()) as { insertados: number; errores: unknown[] };

  expect(reporte.insertados).toBe(21);
  expect(reporte.errores).toEqual([]);

  await page.goto('/lineas');

  // La primera página muestra 20 filas (el tamaño de página de la UI).
  await expect(filas(page)).toHaveCount(20);

  const primeraPagina = await numeros(page).allInnerTexts();

  expect(primeraPagina).toHaveLength(20);
  expect(new Set(primeraPagina).size).toBe(20);

  await page.getByRole('button', { name: 'Siguiente ›' }).click();

  // La segunda página no está vacía y no repite ninguna línea de la primera.
  await expect(filas(page)).toHaveCount(1);

  const segundaPagina = await numeros(page).allInnerTexts();

  expect(segundaPagina.length).toBeGreaterThan(0);
  expect(segundaPagina.filter((numero) => primeraPagina.includes(numero))).toEqual([]);
});

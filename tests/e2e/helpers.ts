import { expect } from '@playwright/test';

import type { APIRequestContext } from '@playwright/test';

/** Crea un formato de centro de coste y devuelve su id. */
export async function crearFormato(request: APIRequestContext, nombre: string): Promise<string> {
  const respuesta = await request.post('/api/v1/formatos', { data: { nombre } });

  expect(respuesta.status()).toBe(201);

  const cuerpo = (await respuesta.json()) as { id: string };

  return cuerpo.id;
}

/** Crea un centro de coste y devuelve su id. */
export async function crearCentroCoste(
  request: APIRequestContext,
  datos: { codigo: string; nombre: string; formato_id: string }
): Promise<string> {
  const respuesta = await request.post('/api/v1/centros-coste', { data: datos });

  expect(respuesta.status()).toBe(201);

  const cuerpo = (await respuesta.json()) as { id: string };

  return cuerpo.id;
}

/** Crea una línea telefónica y devuelve su id. */
export async function crearLinea(
  request: APIRequestContext,
  datos: {
    numero: string;
    centro_coste_id: string;
    proveedor?: string;
    estado?: string;
    tipo_uso?: string;
    costo_mensual?: number;
  }
): Promise<string> {
  const respuesta = await request.post('/api/v1/lineas', { data: datos });

  expect(respuesta.status()).toBe(201);

  const cuerpo = (await respuesta.json()) as { id: string };

  return cuerpo.id;
}

/** CSV de centros de coste con las columnas esperadas por la importación. */
export function csvCentrosCoste(): string {
  return [
    'codigo,nombre,formato_nombre',
    '510 RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO,RENDIC,SMU',
    'C059102801 FALABELLA TOTTUS Av. Alessandri 4025,FALABELLA TOTTUS,FALABELLA',
  ].join('\n');
}

/** CSV de líneas con las columnas esperadas por la importación. */
export function csvLineas(centroCosteCodigo = '510'): string {
  return [
    'numero,proveedor,centro_coste_codigo,costo_mensual,tipo_uso',
    `+56911111111,Entel,${centroCosteCodigo},5000,personal`,
    `+56922222222,Movistar,${centroCosteCodigo},7500,geovictoria`,
  ].join('\n');
}

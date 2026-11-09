import * as XLSX from 'xlsx';

import { buildApp } from '@/app.js';

import { MAX_BYTES_ARCHIVO } from '@application/dto/import.dto.js';

import { crearBaseDePruebas, type BaseDePruebas } from '../database/test-db.js';

import type { FastifyInstance } from 'fastify';

/** Construye un cuerpo multipart/form-data con un archivo y, opcionalmente, campos de texto. */
function cuerpoMultipart(
  nombreArchivo: string,
  contenido: string,
  tipoContenido = 'text/csv',
  campos: Record<string, string> = {}
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----telefono2Test';
  const partes: string[] = [];

  for (const [nombre, valor] of Object.entries(campos)) {
    partes.push(`--${boundary}`, `Content-Disposition: form-data; name="${nombre}"`, '', valor);
  }

  partes.push(
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${nombreArchivo}"`,
    `Content-Type: ${tipoContenido}`,
    '',
    contenido,
    `--${boundary}--`,
    ''
  );

  const cuerpo = partes.join('\r\n');

  return {
    payload: Buffer.from(cuerpo, 'utf8'),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

/**
 * Indica si el contenido es realmente un archivo `.xlsx`.
 *
 * Un `.xlsx` es un contenedor OOXML (un ZIP), cuya firma son los bytes
 * `PK\x03\x04`. **No basta con releer el archivo con `XLSX.read`**: esa función
 * detecta el formato automáticamente y también lee un CSV, así que el test
 * pasaría aunque la API devolviera un CSV con nombre de `.xlsx`.
 */
function esArchivoXlsx(contenido: Buffer): boolean {
  return contenido.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
}

/** Lee la primera fila (las cabeceras) de un archivo `.xlsx` generado por la API. */
function primeraFilaXlsx(contenido: Buffer): string[] {
  const libro = XLSX.read(contenido, { type: 'buffer' });
  const nombreHoja = libro.SheetNames[0];

  if (nombreHoja === undefined) {
    throw new Error('El archivo .xlsx no tiene ninguna hoja');
  }

  const hoja = libro.Sheets[nombreHoja];

  if (hoja === undefined) {
    throw new Error(`El archivo .xlsx no tiene la hoja "${nombreHoja}"`);
  }

  const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1 });

  return (filas[0] ?? []).map((valor) => String(valor ?? ''));
}

describe('API HTTP de TELEFONO 2', () => {
  let base: BaseDePruebas;
  let app: FastifyInstance;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    app = await buildApp({ db: base.db, silencioso: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();
  });

  /** Crea un formato y devuelve su id. */
  async function crearFormato(nombre = 'SMU'): Promise<string> {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/v1/formatos',
      payload: { nombre },
    });

    expect(respuesta.statusCode).toBe(201);

    return respuesta.json<{ id: string }>().id;
  }

  /** Crea un centro de coste y devuelve su id. */
  async function crearCentroCoste(
    formatoId: string,
    codigo = 'CC-001',
    nombre = 'Centro de prueba'
  ): Promise<string> {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/v1/centros-coste',
      payload: { codigo, nombre, formato_id: formatoId },
    });

    expect(respuesta.statusCode).toBe(201);

    return respuesta.json<{ id: string }>().id;
  }

  describe('infraestructura', () => {
    it('responde el health check', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/health' });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<{ status: string }>().status).toBe('ok');
    });

    it('expone el documento OpenAPI', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/openapi.json' });

      expect(respuesta.statusCode).toBe(200);

      const documento = respuesta.json<{ paths: Record<string, unknown> }>();
      expect(documento.paths['/api/v1/lineas']).toBeDefined();
      expect(documento.paths['/api/v1/import/lineas']).toBeDefined();
    });

    it('devuelve 404 en formato RFC 7807 para rutas desconocidas', async () => {
      const respuesta = await app.inject({ method: 'GET', url: '/api/v1/no-existe' });

      expect(respuesta.statusCode).toBe(404);
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
      expect(respuesta.json<{ status: number }>().status).toBe(404);
    });

    it('devuelve 400 con detalle de validación', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/formatos',
        payload: { nombre: '' },
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json<{ errors: unknown[] }>().errors.length).toBeGreaterThan(0);
    });

    it('devuelve 400 (no 500) cuando el JSON del body está malformado', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/formatos',
        headers: { 'content-type': 'application/json' },
        payload: '{nombre: "SMU"',
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
      expect(respuesta.json<{ status: number }>().status).toBe(400);
    });

    it('propaga el correlation id en la respuesta', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-correlation-id': 'abc-123' },
      });

      expect(respuesta.headers['x-correlation-id']).toBe('abc-123');
    });
  });

  describe('formatos', () => {
    it('crea, lista y obtiene un formato', async () => {
      const id = await crearFormato('FALABELLA');

      const listado = await app.inject({ method: 'GET', url: '/api/v1/formatos' });
      expect(listado.statusCode).toBe(200);
      expect(listado.json<{ items: { nombre: string }[] }>().items).toHaveLength(1);

      const detalle = await app.inject({ method: 'GET', url: `/api/v1/formatos/${id}` });
      expect(detalle.statusCode).toBe(200);
      expect(detalle.json<{ nombre: string }>().nombre).toBe('FALABELLA');
    });

    it('rechaza un nombre duplicado con 409', async () => {
      await crearFormato('SMU');

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/formatos',
        payload: { nombre: 'SMU' },
      });

      expect(respuesta.statusCode).toBe(409);
      expect(respuesta.json<{ status: number }>().status).toBe(409);
    });

    it('no permite eliminar un formato con centros de coste asociados', async () => {
      const formatoId = await crearFormato();
      await crearCentroCoste(formatoId);

      const respuesta = await app.inject({
        method: 'DELETE',
        url: `/api/v1/formatos/${formatoId}`,
      });

      expect(respuesta.statusCode).toBe(409);
    });

    it('exporta los formatos en CSV con nombre de archivo', async () => {
      await crearFormato();

      const respuesta = await app.inject({ method: 'GET', url: '/api/v1/formatos/export' });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['content-disposition']).toContain('attachment; filename="formatos_');
      expect(respuesta.rawPayload.toString('utf8')).toContain('nombre');
    });

    it('lista los formatos por nombre y continúa la página con el cursor', async () => {
      for (const nombre of ['ZETA', 'ALFA', 'MU']) {
        await crearFormato(nombre);
      }

      const primera = await app.inject({ method: 'GET', url: '/api/v1/formatos?limit=2' });

      expect(primera.statusCode).toBe(200);

      const pagina1 = primera.json<{
        items: { nombre: string }[];
        next_cursor: string | null;
        has_next_page: boolean;
      }>();

      expect(pagina1.items.map((item) => item.nombre)).toEqual(['ALFA', 'MU']);
      expect(pagina1.has_next_page).toBe(true);
      expect(pagina1.next_cursor).not.toBeNull();

      const segunda = await app.inject({
        method: 'GET',
        url: `/api/v1/formatos?limit=2&after_id=${encodeURIComponent(pagina1.next_cursor ?? '')}`,
      });

      expect(segunda.statusCode).toBe(200);

      const pagina2 = segunda.json<{
        items: { nombre: string }[];
        next_cursor: string | null;
        has_next_page: boolean;
      }>();

      expect(pagina2.items.map((item) => item.nombre)).toEqual(['ZETA']);
      expect(pagina2.has_next_page).toBe(false);
      expect(pagina2.next_cursor).toBeNull();
    });

    it('rechaza con 400 un cursor emitido para otra columna de orden', async () => {
      const id = await crearFormato('ALFA');
      const cursorDeOtraColumna = Buffer.from(
        JSON.stringify({ v: '2026-01-01T00:00:00.000Z', id, c: 'created_at' }),
        'utf8'
      ).toString('base64url');

      const respuesta = await app.inject({
        method: 'GET',
        url: `/api/v1/formatos?after_id=${cursorDeOtraColumna}`,
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
      expect(respuesta.json<{ detail: string }>().detail).toContain('cursor de paginación');
    });

    it('rechaza con 400 un cursor legado sin columna de orden', async () => {
      const id = await crearFormato('ALFA');
      const cursorLegado = Buffer.from(JSON.stringify({ v: 'ALFA', id }), 'utf8').toString(
        'base64url'
      );

      const respuesta = await app.inject({
        method: 'GET',
        url: `/api/v1/formatos?after_id=${cursorLegado}`,
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.headers['content-type']).toContain('application/problem+json');
    });

    it('incluye total_count en la respuesta paginada (RF-PAG-1.10)', async () => {
      for (const nombre of ['ZETA', 'ALFA', 'MU']) {
        await crearFormato(nombre);
      }

      const respuesta = await app.inject({ method: 'GET', url: '/api/v1/formatos?limit=2' });

      expect(respuesta.statusCode).toBe(200);

      const cuerpo = respuesta.json<{
        items: { nombre: string }[];
        next_cursor: string | null;
        has_next_page: boolean;
        total_count: number;
      }>();

      expect(cuerpo.items).toHaveLength(2);
      expect(cuerpo.total_count).toBe(3);
    });

    it('exporta los formatos ordenados por nombre', async () => {
      await crearFormato('ZETA');
      await crearFormato('ALFA');

      const respuesta = await app.inject({ method: 'GET', url: '/api/v1/formatos/export' });

      expect(respuesta.statusCode).toBe(200);

      const csv = respuesta.rawPayload.toString('utf8');

      expect(csv.indexOf('ALFA')).toBeGreaterThanOrEqual(0);
      expect(csv.indexOf('ALFA')).toBeLessThan(csv.indexOf('ZETA'));
    });
  });

  describe('centros de coste', () => {
    it('crea un centro de coste y lo exporta', async () => {
      const formatoId = await crearFormato();
      await crearCentroCoste(formatoId, 'CC-777');

      const exportacion = await app.inject({
        method: 'GET',
        url: '/api/v1/centros-coste/export?format=csv',
      });

      expect(exportacion.statusCode).toBe(200);
      expect(exportacion.rawPayload.toString('utf8')).toContain('CC-777');
    });

    it('filtra los centros de coste por texto libre (código o nombre)', async () => {
      const formatoId = await crearFormato();

      const centroObjetivo = await app.inject({
        method: 'POST',
        url: '/api/v1/centros-coste',
        payload: { codigo: 'BUS-UNICO', nombre: 'CENTRO UNICO', formato_id: formatoId },
      });
      expect(centroObjetivo.statusCode).toBe(201);

      const otro = await app.inject({
        method: 'POST',
        url: '/api/v1/centros-coste',
        payload: { codigo: 'BUS-OTRO', nombre: 'CENTRO OTRO', formato_id: formatoId },
      });
      expect(otro.statusCode).toBe(201);

      const porNombre = await app.inject({
        method: 'GET',
        url: '/api/v1/centros-coste?busqueda=unico',
      });

      expect(porNombre.statusCode).toBe(200);
      expect(porNombre.json<{ items: { codigo: string }[] }>().items).toHaveLength(1);
      expect(porNombre.json<{ items: { codigo: string }[] }>().items[0]?.codigo).toBe('BUS-UNICO');

      const porCodigo = await app.inject({
        method: 'GET',
        url: '/api/v1/centros-coste?busqueda=bus-otro',
      });

      expect(porCodigo.statusCode).toBe(200);
      expect(porCodigo.json<{ items: { codigo: string }[] }>().items).toHaveLength(1);
      expect(porCodigo.json<{ items: { codigo: string }[] }>().items[0]?.codigo).toBe('BUS-OTRO');
    });

    it('rechaza un filtro de búsqueda demasiado largo con 400', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/api/v1/centros-coste?busqueda=${'a'.repeat(101)}`,
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('obtiene, actualiza y elimina un centro de coste', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId, 'CC-100', 'Centro original');

      // GET /centros-coste/:id
      const obtener = await app.inject({
        method: 'GET',
        url: `/api/v1/centros-coste/${centroId}`,
      });

      expect(obtener.statusCode).toBe(200);

      const centro = obtener.json<{ codigo: string; nombre: string; formato_id: string }>();

      expect(centro.codigo).toBe('CC-100');
      expect(centro.nombre).toBe('Centro original');
      expect(centro.formato_id).toBe(formatoId);

      // PUT /centros-coste/:id (el código es inmutable)
      const actualizar = await app.inject({
        method: 'PUT',
        url: `/api/v1/centros-coste/${centroId}`,
        payload: { nombre: 'Centro renombrado' },
      });

      expect(actualizar.statusCode).toBe(200);
      expect(actualizar.json<{ codigo: string; nombre: string }>().nombre).toBe(
        'Centro renombrado'
      );
      expect(actualizar.json<{ codigo: string }>().codigo).toBe('CC-100');

      // DELETE /centros-coste/:id
      const eliminar = await app.inject({
        method: 'DELETE',
        url: `/api/v1/centros-coste/${centroId}`,
      });

      expect(eliminar.statusCode).toBe(204);

      const despues = await app.inject({
        method: 'GET',
        url: `/api/v1/centros-coste/${centroId}`,
      });

      expect(despues.statusCode).toBe(404);
    });

    it('no permite eliminar un centro de coste con líneas asociadas', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId, 'CC-200', 'Centro con líneas');

      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId },
      });

      const eliminar = await app.inject({
        method: 'DELETE',
        url: `/api/v1/centros-coste/${centroId}`,
      });

      expect(eliminar.statusCode).toBe(409);
    });

    it('rechaza un formato inexistente con 400', async () => {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/centros-coste',
        payload: {
          codigo: 'CC-000',
          nombre: 'Sin formato',
          formato_id: '00000000-0000-0000-0000-000000000000',
        },
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('incluye total_count en la respuesta paginada (RF-PAG-1.10)', async () => {
      const formatoId = await crearFormato();

      for (const codigo of ['CC-100', 'CC-200', 'CC-300']) {
        await crearCentroCoste(formatoId, codigo, `Centro ${codigo}`);
      }

      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/v1/centros-coste?limit=2',
      });

      expect(respuesta.statusCode).toBe(200);

      const cuerpo = respuesta.json<{
        items: { codigo: string }[];
        next_cursor: string | null;
        has_next_page: boolean;
        total_count: number;
      }>();

      expect(cuerpo.items).toHaveLength(2);
      expect(cuerpo.total_count).toBe(3);
    });
  });

  describe('líneas', () => {
    it('crea una línea, la lista, la filtra y la da de baja', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      const creacion = await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: {
          numero: '9 1234 5678',
          proveedor: 'Movistar',
          centro_coste_id: centroId,
          costo_mensual: 25000,
          tipo_uso: 'geovictoria',
        },
      });

      expect(creacion.statusCode).toBe(201);

      const linea = creacion.json<{ id: string; numero: string; estado: string }>();
      expect(linea.numero).toBe('+56912345678');
      expect(linea.estado).toBe('pendiente');

      const listado = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?tipo_uso=geovictoria&limit=20',
      });
      expect(listado.statusCode).toBe(200);
      expect(listado.json<{ items: unknown[] }>().items).toHaveLength(1);

      const baja = await app.inject({ method: 'DELETE', url: `/api/v1/lineas/${linea.id}` });
      expect(baja.statusCode).toBe(200);
      expect(baja.json<{ estado: string }>().estado).toBe('baja');

      const listadoTrasBaja = await app.inject({ method: 'GET', url: '/api/v1/lineas' });
      expect(listadoTrasBaja.json<{ items: unknown[] }>().items).toHaveLength(0);
    });

    it('actualiza una línea y rechaza una versión desactualizada', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      const creacion = await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId, proveedor: 'Movistar' },
      });

      expect(creacion.statusCode).toBe(201);

      const id = creacion.json<{ id: string }>().id;

      // PUT /lineas/:id
      const actualizar = await app.inject({
        method: 'PUT',
        url: `/api/v1/lineas/${id}`,
        payload: { proveedor: 'VTR', costo_mensual: 7500, empleado: 'Ana Pérez' },
      });

      expect(actualizar.statusCode).toBe(200);

      const actualizada = actualizar.json<{
        numero: string;
        proveedor: string;
        empleado: string;
      }>();

      // El número es inmutable y el resto de campos sí cambian.
      expect(actualizada.numero).toBe('+56912345678');
      expect(actualizada.proveedor).toBe('VTR');
      expect(actualizada.empleado).toBe('Ana Pérez');

      // Con `If-Match` de una versión ya superada → 409 y no se aplica el cambio.
      const conflicto = await app.inject({
        method: 'PUT',
        url: `/api/v1/lineas/${id}`,
        headers: { 'if-match': '"1"' },
        payload: { proveedor: 'NO DEBE APLICARSE' },
      });

      expect(conflicto.statusCode).toBe(409);
      expect(conflicto.headers['content-type']).toContain('application/problem+json');

      const sinCambio = await app.inject({ method: 'GET', url: `/api/v1/lineas/${id}` });

      expect(sinCambio.json<{ proveedor: string }>().proveedor).toBe('VTR');
    });

    it('rechaza un número inválido con 400', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '12345', centro_coste_id: centroId },
      });

      expect(respuesta.statusCode).toBe(400);
      expect(respuesta.json<{ status: number }>().status).toBe(400);
    });

    it('rechaza un número duplicado con 409', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId },
      });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId },
      });

      expect(respuesta.statusCode).toBe(409);
    });

    it('cambia el estado de varias líneas de una vez', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      const ids: string[] = [];
      for (const numero of ['+56911111111', '+56922222222']) {
        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero, centro_coste_id: centroId },
        });
        ids.push(creacion.json<{ id: string }>().id);
      }

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/lineas/estado/masivo',
        payload: { ids, estado: 'activa' },
      });

      expect(respuesta.statusCode).toBe(200);

      const resultado = respuesta.json<{ actualizadas: number; ignoradas: number }>();
      expect(resultado.actualizadas).toBe(2);
      expect(resultado.ignoradas).toBe(0);
    });

    it('exporta las líneas con los filtros aplicados', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId, proveedor: 'Movistar' },
      });

      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas/export?format=csv&proveedor=Movistar',
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.rawPayload.toString('utf8')).toContain('+56912345678');
    });

    it('ordena por las columnas nuevas y rechaza las no ordenables', async () => {
      const formatoId = await crearFormato();
      const centroA = await crearCentroCoste(formatoId, 'ZZ-ORD-A', 'CENTRO ORDEN A');
      const centroB = await crearCentroCoste(formatoId, 'ZZ-ORD-B', 'CENTRO ORDEN B');

      const crearLinea = async (
        numero: string,
        centroCosteId: string,
        proveedor: string,
        tipoUso: 'personal' | 'geovictoria'
      ): Promise<void> => {
        const respuesta = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero, centro_coste_id: centroCosteId, proveedor, tipo_uso: tipoUso },
        });

        expect(respuesta.statusCode).toBe(201);
      };

      await crearLinea('900000002', centroB, 'Movistar', 'personal');
      await crearLinea('900000001', centroA, 'Entel', 'geovictoria');
      await crearLinea('900000003', centroB, 'Claro', 'personal');

      const porProveedor = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?sort=proveedor&order=asc',
      });

      expect(porProveedor.statusCode).toBe(200);
      expect(
        porProveedor.json<{ items: { proveedor: string }[] }>().items.map((item) => item.proveedor)
      ).toEqual(['Claro', 'Entel', 'Movistar']);

      // `centro_coste_codigo` es una columna del JOIN: se comprueba que el cursor pagina por ella.
      const porCentro = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?sort=centro_coste_codigo&order=asc&limit=1',
      });

      expect(porCentro.statusCode).toBe(200);

      const primeraPorCentro = porCentro.json<{
        items: { centro_coste_codigo: string }[];
        next_cursor: string | null;
      }>();

      expect(primeraPorCentro.items[0]?.centro_coste_codigo).toBe('ZZ-ORD-A');
      expect(primeraPorCentro.next_cursor).not.toBeNull();

      const segundaPorCentro = await app.inject({
        method: 'GET',
        url: `/api/v1/lineas?sort=centro_coste_codigo&order=asc&limit=1&after_id=${encodeURIComponent(primeraPorCentro.next_cursor ?? '')}`,
      });

      expect(segundaPorCentro.statusCode).toBe(200);
      expect(
        segundaPorCentro.json<{ items: { centro_coste_codigo: string }[] }>().items[0]
          ?.centro_coste_codigo
      ).toBe('ZZ-ORD-B');

      const porTipoUso = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?sort=tipo_uso&order=asc',
      });

      expect(porTipoUso.statusCode).toBe(200);
      expect(
        porTipoUso.json<{ items: { tipo_uso: string }[] }>().items.map((item) => item.tipo_uso)
      ).toEqual(['geovictoria', 'personal', 'personal']);

      // `empleado` (nullable, Q4) y cualquier valor fuera del conjunto cerrado → 400.
      for (const sort of ['empleado', 'inventado']) {
        const invalida = await app.inject({
          method: 'GET',
          url: `/api/v1/lineas?sort=${sort}`,
        });

        expect(invalida.statusCode).toBe(400);
        expect(invalida.headers['content-type']).toContain('application/problem+json');
        expect(invalida.json<{ errors: unknown[] }>().errors.length).toBeGreaterThan(0);
      }
    });

    it('filtra el listado por texto de centro de coste (código o nombre)', async () => {
      const formatoId = await crearFormato();
      const centroAlfa = await crearCentroCoste(formatoId, 'BUSCA-A', 'CENTRO COMUN ALFA');
      const centroBeta = await crearCentroCoste(formatoId, 'BUSCA-B', 'CENTRO COMUN BETA');
      const centroOtro = await crearCentroCoste(formatoId, 'OTRO-1', 'CENTRO DISTINTO');

      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56911111111', centro_coste_id: centroAlfa },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56922222222', centro_coste_id: centroBeta },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56933333333', centro_coste_id: centroOtro },
      });

      // "Todos los que coincidan": devuelve las líneas de los dos centros que comparten el texto.
      const todas = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?centro_coste_busqueda=comun',
      });
      expect(todas.statusCode).toBe(200);
      expect(todas.json<{ items: unknown[] }>().items).toHaveLength(2);

      // Un centro concreto: solo sus líneas.
      const una = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?centro_coste_busqueda=BUSCA-A',
      });
      expect(una.json<{ items: unknown[] }>().items).toHaveLength(1);

      // Se combina con otros filtros.
      const combinada = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?centro_coste_busqueda=comun&centro_coste_codigo=BUSCA-B',
      });
      expect(combinada.json<{ items: unknown[] }>().items).toHaveLength(1);

      // La exportación aplica el mismo filtro.
      const exportacion = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas/export?format=csv&centro_coste_busqueda=comun',
      });
      expect(exportacion.statusCode).toBe(200);
      expect(exportacion.rawPayload.toString('utf8')).toContain('+56911111111');
      expect(exportacion.rawPayload.toString('utf8')).toContain('+56922222222');
      expect(exportacion.rawPayload.toString('utf8')).not.toContain('+56933333333');
    });

    it('rechaza un filtro de búsqueda de centro de coste demasiado largo con 400', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: `/api/v1/lineas?centro_coste_busqueda=${'a'.repeat(101)}`,
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('incluye total_count en la respuesta paginada (RF-PAG-1.10)', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      for (const numero of ['+56911111111', '+56922222222', '+56933333333']) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero, centro_coste_id: centroId },
        });
      }

      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/v1/lineas?limit=2',
      });

      expect(respuesta.statusCode).toBe(200);

      const cuerpo = respuesta.json<{
        items: { numero: string }[];
        next_cursor: string | null;
        has_next_page: boolean;
        total_count: number;
      }>();

      expect(cuerpo.items).toHaveLength(2);
      expect(cuerpo.total_count).toBe(3);
    });
  });

  describe('importación', () => {
    it('importa centros de coste desde un CSV', async () => {
      await crearFormato('SMU');

      const csv = 'codigo,nombre,formato_nombre\nCC-900,Centro importado,SMU';
      const { payload, headers } = cuerpoMultipart('centros.csv', csv);

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/import/centros-coste',
        headers,
        payload,
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.json<{ insertados: number }>().insertados).toBe(1);
    });

    it('crea los formatos que faltan si se pide la creación automática', async () => {
      const csv = 'codigo,nombre,formato_nombre\nCC-901,Centro nuevo,ADMINISTRACION';
      const { payload, headers } = cuerpoMultipart('centros.csv', csv, 'text/csv', {
        crear_formatos_faltantes: 'true',
      });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/import/centros-coste',
        headers,
        payload,
      });

      expect(respuesta.statusCode).toBe(200);

      const reporte = respuesta.json<{ insertados: number; formatos_creados: string[] }>();

      expect(reporte.insertados).toBe(1);
      expect(reporte.formatos_creados).toEqual(['ADMINISTRACION']);

      const formatos = await app.inject({ method: 'GET', url: '/api/v1/formatos?limit=100' });

      expect(
        formatos.json<{ items: { nombre: string }[] }>().items.map((item) => item.nombre)
      ).toContain('ADMINISTRACION');
    });

    it('no crea los formatos que faltan si no se pide la creación automática', async () => {
      const csv = 'codigo,nombre,formato_nombre\nCC-902,Centro nuevo,ADMINISTRACION';
      const { payload, headers } = cuerpoMultipart('centros.csv', csv, 'text/csv', {
        crear_formatos_faltantes: 'false',
      });

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/import/centros-coste',
        headers,
        payload,
      });

      expect(respuesta.statusCode).toBe(200);

      const reporte = respuesta.json<{
        insertados: number;
        formatos_creados: string[];
        errores: { motivo: string }[];
      }>();

      expect(reporte.insertados).toBe(0);
      expect(reporte.formatos_creados).toEqual([]);
      expect(reporte.errores).toHaveLength(1);
      expect(reporte.errores[0]?.motivo).toContain('ADMINISTRACION');

      const formatos = await app.inject({ method: 'GET', url: '/api/v1/formatos?limit=100' });

      expect(
        formatos.json<{ items: { nombre: string }[] }>().items.map((item) => item.nombre)
      ).not.toContain('ADMINISTRACION');
    });

    it('importa líneas y reporta los duplicados', async () => {
      const formatoId = await crearFormato();
      await crearCentroCoste(formatoId, 'CC-001');

      const csv = 'numero,centro_coste_codigo\n+56912345678,CC-001\n+56912345678,CC-001';
      const { payload, headers } = cuerpoMultipart('lineas.csv', csv);

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/import/lineas',
        headers,
        payload,
      });

      expect(respuesta.statusCode).toBe(200);

      const reporte = respuesta.json<{ insertados: number; duplicados: unknown[] }>();
      expect(reporte.insertados).toBe(1);
      expect(reporte.duplicados).toHaveLength(1);
    });

    it('rechaza un archivo sin extensión admitida', async () => {
      const { payload, headers } = cuerpoMultipart('lineas.txt', 'numero\n+56912345678');

      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/v1/import/lineas',
        headers,
        payload,
      });

      expect(respuesta.statusCode).toBe(400);
    });

    it('descarga la plantilla de líneas', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/v1/import/templates?tipo=lineas',
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['content-disposition']).toContain('plantilla_lineas.csv');
      expect(respuesta.rawPayload.toString('utf8')).toContain('centro_coste_codigo');
    });

    it('descarga la plantilla de centros de coste sin duplicar la cabecera', async () => {
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/v1/import/templates?tipo=centros-coste',
      });

      expect(respuesta.statusCode).toBe(200);
      expect(respuesta.headers['content-disposition']).toContain(
        'attachment; filename="plantilla_centros_coste.csv"'
      );

      const lineas = respuesta.rawPayload
        .toString('utf8')
        .split(/\r?\n/)
        .map((linea) => linea.trim())
        .filter((linea) => linea !== '');

      const cabeceras = lineas.filter((linea) => linea === 'codigo,nombre,formato_nombre');
      expect(cabeceras).toHaveLength(1);
      expect(lineas).toContain('510,RENDIC AVDA CAMILO HENRIQUEZ 445 CURICO,SMU');
    });
  });

  describe('dashboard', () => {
    it('devuelve los cuatro KPIs', async () => {
      const formatoId = await crearFormato();
      const centroId = await crearCentroCoste(formatoId);

      await app.inject({
        method: 'POST',
        url: '/api/v1/lineas',
        payload: { numero: '+56912345678', centro_coste_id: centroId, estado: 'activa' },
      });

      const respuesta = await app.inject({ method: 'GET', url: '/api/v1/dashboard/kpis' });

      expect(respuesta.statusCode).toBe(200);

      const kpis = respuesta.json<{
        total_lineas: number;
        lineas_activas: number;
        count_personal: number;
        count_geovictoria: number;
      }>();

      expect(kpis.total_lineas).toBe(1);
      expect(kpis.lineas_activas).toBe(1);
      expect(kpis.count_personal).toBe(1);
      expect(kpis.count_geovictoria).toBe(0);
    });
  });

  describe('calidad (RF-QUAL)', () => {
    describe('cabecera If-Match (RF-QUAL-1.1, RF-OPT-1.1 a RF-OPT-1.3)', () => {
      it('aplica la versión esperada de la cabecera y rechaza las versiones inválidas', async () => {
        const formatoId = await crearFormato('SMU');

        // Versión inicial: 1. La etiqueta débil `W/"1"` vale lo mismo que `"1"`.
        const conEtiquetaDebil = await app.inject({
          method: 'PUT',
          url: `/api/v1/formatos/${formatoId}`,
          headers: { 'if-match': 'W/"1"' },
          payload: { nombre: 'SMU RENOMBRADO' },
        });

        expect(conEtiquetaDebil.statusCode).toBe(200);
        expect(conEtiquetaDebil.json<{ version: number }>().version).toBe(2);

        // Etiqueta fuerte con la versión actual → 200 y la versión avanza.
        const conEtiquetaFuerte = await app.inject({
          method: 'PUT',
          url: `/api/v1/formatos/${formatoId}`,
          headers: { 'if-match': '"2"' },
          payload: { nombre: 'SMU RENOMBRADO OTRA VEZ' },
        });

        expect(conEtiquetaFuerte.statusCode).toBe(200);
        expect(conEtiquetaFuerte.json<{ version: number }>().version).toBe(3);

        // Valores que no son un entero >= 1 → 400 sin aplicar la escritura.
        for (const valor of ['abc', '0', 'W/"x"', '3abc', '3.5', '1e3']) {
          const invalida = await app.inject({
            method: 'PUT',
            url: `/api/v1/formatos/${formatoId}`,
            headers: { 'if-match': valor },
            payload: { nombre: 'NO DEBE APLICARSE' },
          });

          expect(invalida.statusCode, `If-Match: ${valor}`).toBe(400);
          expect(invalida.headers['content-type']).toContain('application/problem+json');
        }

        // Versión ya superada → 409 y el recurso no cambia.
        const superada = await app.inject({
          method: 'PUT',
          url: `/api/v1/formatos/${formatoId}`,
          headers: { 'if-match': '"1"' },
          payload: { nombre: 'NO DEBE APLICARSE' },
        });

        expect(superada.statusCode).toBe(409);
        expect(superada.headers['content-type']).toContain('application/problem+json');

        const actual = await app.inject({ method: 'GET', url: `/api/v1/formatos/${formatoId}` });
        const estado = actual.json<{ nombre: string; version: number }>();

        expect(estado.nombre).toBe('SMU RENOMBRADO OTRA VEZ');
        expect(estado.version).toBe(3);
      });
    });

    describe('cabecera If-Match en DELETE (RF-OPT-1.1 a RF-OPT-1.3)', () => {
      it('borra un formato con la versión esperada y rechaza las que no coinciden', async () => {
        const formatoId = await crearFormato('SMU');

        // Versión desactualizada → 409 y el formato NO se borra.
        const superada = await app.inject({
          method: 'DELETE',
          url: `/api/v1/formatos/${formatoId}`,
          headers: { 'if-match': '"999"' },
        });

        expect(superada.statusCode).toBe(409);
        expect(superada.headers['content-type']).toContain('application/problem+json');

        const sigueVivo = await app.inject({
          method: 'GET',
          url: `/api/v1/formatos/${formatoId}`,
        });

        expect(sigueVivo.statusCode).toBe(200);

        // Valor inválido → 400 y el formato NO se borra.
        for (const valor of ['abc', '0', '3abc', '3.5', '1e3']) {
          const invalida = await app.inject({
            method: 'DELETE',
            url: `/api/v1/formatos/${formatoId}`,
            headers: { 'if-match': valor },
          });

          expect(invalida.statusCode, `If-Match: ${valor}`).toBe(400);
          expect(invalida.headers['content-type']).toContain('application/problem+json');
        }

        const sigueVivo2 = await app.inject({
          method: 'GET',
          url: `/api/v1/formatos/${formatoId}`,
        });

        expect(sigueVivo2.statusCode).toBe(200);

        // Versión correcta → 204 y el formato se borra.
        const correcta = await app.inject({
          method: 'DELETE',
          url: `/api/v1/formatos/${formatoId}`,
          headers: { 'if-match': 'W/"1"' },
        });

        expect(correcta.statusCode).toBe(204);

        const despues = await app.inject({
          method: 'GET',
          url: `/api/v1/formatos/${formatoId}`,
        });

        expect(despues.statusCode).toBe(404);
      });

      it('borra un centro de coste con la versión esperada y rechaza las que no coinciden', async () => {
        const formatoId = await crearFormato('SMU');
        const centroId = await crearCentroCoste(formatoId, 'CC-IFMATCH');

        const superada = await app.inject({
          method: 'DELETE',
          url: `/api/v1/centros-coste/${centroId}`,
          headers: { 'if-match': '"999"' },
        });

        expect(superada.statusCode).toBe(409);
        expect(superada.headers['content-type']).toContain('application/problem+json');

        const sigueVivo = await app.inject({
          method: 'GET',
          url: `/api/v1/centros-coste/${centroId}`,
        });

        expect(sigueVivo.statusCode).toBe(200);

        const invalida = await app.inject({
          method: 'DELETE',
          url: `/api/v1/centros-coste/${centroId}`,
          headers: { 'if-match': '3abc' },
        });

        expect(invalida.statusCode).toBe(400);

        const sigueVivo2 = await app.inject({
          method: 'GET',
          url: `/api/v1/centros-coste/${centroId}`,
        });

        expect(sigueVivo2.statusCode).toBe(200);

        const correcta = await app.inject({
          method: 'DELETE',
          url: `/api/v1/centros-coste/${centroId}`,
          headers: { 'if-match': '"1"' },
        });

        expect(correcta.statusCode).toBe(204);

        const despues = await app.inject({
          method: 'GET',
          url: `/api/v1/centros-coste/${centroId}`,
        });

        expect(despues.statusCode).toBe(404);
      });

      it('da de baja una línea con la versión esperada y rechaza las que no coinciden', async () => {
        const formatoId = await crearFormato('SMU');
        const centroId = await crearCentroCoste(formatoId);

        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId },
        });

        expect(creacion.statusCode).toBe(201);

        const id = creacion.json<{ id: string }>().id;

        // Versión desactualizada → 409 y la línea NO se da de baja.
        const superada = await app.inject({
          method: 'DELETE',
          url: `/api/v1/lineas/${id}`,
          headers: { 'if-match': '"999"' },
        });

        expect(superada.statusCode).toBe(409);
        expect(superada.headers['content-type']).toContain('application/problem+json');

        const sigueViva = await app.inject({
          method: 'GET',
          url: `/api/v1/lineas/${id}`,
        });

        expect(sigueViva.statusCode).toBe(200);
        expect(sigueViva.json<{ estado: string }>().estado).not.toBe('baja');

        // Valor inválido → 400 y la línea NO se da de baja.
        for (const valor of ['abc', '0', '3abc', '3.5', '1e3']) {
          const invalida = await app.inject({
            method: 'DELETE',
            url: `/api/v1/lineas/${id}`,
            headers: { 'if-match': valor },
          });

          expect(invalida.statusCode, `If-Match: ${valor}`).toBe(400);
        }

        const sigueViva2 = await app.inject({
          method: 'GET',
          url: `/api/v1/lineas/${id}`,
        });

        expect(sigueViva2.statusCode).toBe(200);
        expect(sigueViva2.json<{ estado: string }>().estado).not.toBe('baja');

        // Versión correcta → 200 y la línea queda de baja.
        const correcta = await app.inject({
          method: 'DELETE',
          url: `/api/v1/lineas/${id}`,
          headers: { 'if-match': '"1"' },
        });

        expect(correcta.statusCode).toBe(200);
        expect(correcta.json<{ estado: string }>().estado).toBe('baja');
      });

      it('distingue un recurso inexistente (404) de una versión que no coincide (409)', async () => {
        const inexistente = '00000000-0000-0000-0000-000000000000';

        const respuesta = await app.inject({
          method: 'DELETE',
          url: `/api/v1/formatos/${inexistente}`,
          headers: { 'if-match': '"1"' },
        });

        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.headers['content-type']).toContain('application/problem+json');
      });
    });

    describe('cursor de paginación del listado de líneas (RF-ORD-1.1)', () => {
      it('rechaza con 400 un cursor emitido para otra columna de orden', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        for (const numero of ['+56911111111', '+56922222222']) {
          const creacion = await app.inject({
            method: 'POST',
            url: '/api/v1/lineas',
            payload: { numero, centro_coste_id: centroId },
          });

          expect(creacion.statusCode).toBe(201);
        }

        // Cursor emitido para `created_at` (el orden por defecto).
        const pagina = await app.inject({
          method: 'GET',
          url: '/api/v1/lineas?sort=created_at&order=asc&limit=1',
        });

        expect(pagina.statusCode).toBe(200);

        const cursor = pagina.json<{ next_cursor: string | null }>().next_cursor;

        expect(cursor).not.toBeNull();

        // ... pero se usa con `sort=proveedor`: la columna no coincide → 400.
        const respuesta = await app.inject({
          method: 'GET',
          url: `/api/v1/lineas?sort=proveedor&order=asc&after_id=${encodeURIComponent(cursor ?? '')}`,
        });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.headers['content-type']).toContain('application/problem+json');
        expect(respuesta.json<{ detail: string }>().detail).toContain('cursor de paginación');
      });

      it('rechaza con 400 un cursor legado sin columna de orden', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId },
        });

        expect(creacion.statusCode).toBe(201);

        const id = creacion.json<{ id: string }>().id;
        const cursorLegado = Buffer.from(
          JSON.stringify({ v: '+56912345678', id }),
          'utf8'
        ).toString('base64url');

        const respuesta = await app.inject({
          method: 'GET',
          url: `/api/v1/lineas?after_id=${cursorLegado}`,
        });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.headers['content-type']).toContain('application/problem+json');
      });
    });

    describe('exportación con incluir_bajas (RF-QUAL-1.2)', () => {
      it('excluye las líneas dadas de baja salvo que se pidan explícitamente', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        // Una línea que se mantiene vigente y otra que se da de baja: el export
        // nunca está vacío, así que la ausencia de la línea de baja es
        // concluyente.
        const vigente = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56911111111', centro_coste_id: centroId },
        });

        expect(vigente.statusCode).toBe(201);

        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId },
        });

        expect(creacion.statusCode).toBe(201);

        const id = creacion.json<{ id: string }>().id;

        const baja = await app.inject({ method: 'DELETE', url: `/api/v1/lineas/${id}` });
        expect(baja.statusCode).toBe(200);
        expect(baja.json<{ estado: string }>().estado).toBe('baja');

        // Sin el parámetro → la línea de baja no se exporta, la vigente sí.
        const sinParametro = await app.inject({
          method: 'GET',
          url: '/api/v1/lineas/export?format=csv',
        });

        expect(sinParametro.statusCode).toBe(200);
        expect(sinParametro.rawPayload.toString('utf8')).toContain('+56911111111');
        expect(sinParametro.rawPayload.toString('utf8')).not.toContain('+56912345678');

        // Con `incluir_bajas=false` → tampoco se exporta la de baja.
        const sinBajas = await app.inject({
          method: 'GET',
          url: '/api/v1/lineas/export?format=csv&incluir_bajas=false',
        });

        expect(sinBajas.statusCode).toBe(200);
        expect(sinBajas.rawPayload.toString('utf8')).toContain('+56911111111');
        expect(sinBajas.rawPayload.toString('utf8')).not.toContain('+56912345678');

        // Con `incluir_bajas=true` → se exportan las dos.
        const conBajas = await app.inject({
          method: 'GET',
          url: '/api/v1/lineas/export?format=csv&incluir_bajas=true',
        });

        expect(conBajas.statusCode).toBe(200);
        expect(conBajas.rawPayload.toString('utf8')).toContain('+56911111111');
        expect(conBajas.rawPayload.toString('utf8')).toContain('+56912345678');
      });
    });

    describe('archivo demasiado grande (RF-QUAL-1.3)', () => {
      // Un único buffer grande, reutilizado por los dos endpoints (el archivo
      // pesa más de 10 MB, que es el límite de `MAX_BYTES_ARCHIVO`).
      const archivoGrande = Buffer.alloc(MAX_BYTES_ARCHIVO + 1024, 'a');

      /** Envuelve el buffer grande en un cuerpo multipart/form-data. */
      function cuerpoMultipartGrande(nombreArchivo: string): {
        payload: Buffer;
        headers: Record<string, string>;
      } {
        const boundary = '----telefono2TestGrande';

        const cabecera = Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${nombreArchivo}"\r\nContent-Type: text/csv\r\n\r\n`,
          'utf8'
        );
        const pie = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

        return {
          payload: Buffer.concat([cabecera, archivoGrande, pie]),
          headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        };
      }

      it('rechaza con 413 un archivo de más de 10 MB al importar centros de coste', async () => {
        const { payload, headers } = cuerpoMultipartGrande('centros.csv');

        const respuesta = await app.inject({
          method: 'POST',
          url: '/api/v1/import/centros-coste',
          headers,
          payload,
        });

        expect(respuesta.statusCode).toBe(413);
        expect(respuesta.headers['content-type']).toContain('application/problem+json');
        expect(respuesta.json<{ status: number; type: string; detail: string }>()).toMatchObject({
          status: 413,
          type: 'https://telefono2.local/errors/payload-too-large',
          detail: 'El archivo supera el tamaño máximo permitido (10 MB).',
        });
      });

      it('rechaza con 413 un archivo de más de 10 MB al importar líneas', async () => {
        const { payload, headers } = cuerpoMultipartGrande('lineas.csv');

        const respuesta = await app.inject({
          method: 'POST',
          url: '/api/v1/import/lineas',
          headers,
          payload,
        });

        expect(respuesta.statusCode).toBe(413);
        expect(respuesta.headers['content-type']).toContain('application/problem+json');
        expect(respuesta.json<{ status: number; type: string; detail: string }>()).toMatchObject({
          status: 413,
          type: 'https://telefono2.local/errors/payload-too-large',
          detail: 'El archivo supera el tamaño máximo permitido (10 MB).',
        });
      });
    });

    describe('cambio de estado masivo (RF-QUAL-1.11)', () => {
      it('reporta en fallidas los identificadores inexistentes sin abortar la operación', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        const ids: string[] = [];

        for (const numero of ['+56911111111', '+56922222222']) {
          const creacion = await app.inject({
            method: 'POST',
            url: '/api/v1/lineas',
            payload: { numero, centro_coste_id: centroId },
          });

          expect(creacion.statusCode).toBe(201);
          ids.push(creacion.json<{ id: string }>().id);
        }

        const inexistente = '00000000-0000-0000-0000-000000000000';

        const respuesta = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas/estado/masivo',
          payload: { ids: [...ids, inexistente], estado: 'activa' },
        });

        expect(respuesta.statusCode).toBe(200);
        expect(
          respuesta.json<{ actualizadas: number; ignoradas: number; fallidas: number }>()
        ).toEqual({ actualizadas: 2, ignoradas: 0, fallidas: 1 });

        // Las dos líneas válidas quedaron actualizadas.
        for (const id of ids) {
          const linea = await app.inject({ method: 'GET', url: `/api/v1/lineas/${id}` });

          expect(linea.statusCode).toBe(200);
          expect(linea.json<{ estado: string }>().estado).toBe('activa');
        }
      });
    });

    describe('reactivación de una línea (RF-QUAL-1.10)', () => {
      it('reactiva una línea dada de baja y la vuelve a listar sin soft delete', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId },
        });

        expect(creacion.statusCode).toBe(201);

        const id = creacion.json<{ id: string }>().id;

        const baja = await app.inject({
          method: 'PATCH',
          url: `/api/v1/lineas/${id}/estado`,
          payload: { estado: 'baja' },
        });

        expect(baja.statusCode).toBe(200);
        expect(baja.json<{ estado: string }>().estado).toBe('baja');

        const reactivacion = await app.inject({
          method: 'PATCH',
          url: `/api/v1/lineas/${id}/estado`,
          payload: { estado: 'activa' },
        });

        expect(reactivacion.statusCode).toBe(200);
        expect(reactivacion.json<{ estado: string }>().estado).toBe('activa');

        // Vuelve a aparecer en el listado normal y sin `deleted_at`.
        const listado = await app.inject({ method: 'GET', url: '/api/v1/lineas' });

        expect(listado.statusCode).toBe(200);

        const items = listado.json<{ items: { id: string; deleted_at: string | null }[] }>().items;

        expect(items).toHaveLength(1);
        expect(items[0]?.id).toBe(id);
        expect(items[0]?.deleted_at).toBeNull();
      });
    });

    describe('KPIs sin caché (RF-QUAL-1.8)', () => {
      it('refleja el cambio de estado hecho entre dos llamadas consecutivas', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        // La línea nace en estado 'pendiente' (valor por defecto).
        const creacion = await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId },
        });

        expect(creacion.statusCode).toBe(201);

        const id = creacion.json<{ id: string }>().id;

        const antes = await app.inject({ method: 'GET', url: '/api/v1/dashboard/kpis' });

        expect(antes.statusCode).toBe(200);

        const kpisAntes = antes.json<{ total_lineas: number; lineas_activas: number }>();

        expect(kpisAntes.total_lineas).toBe(1);
        expect(kpisAntes.lineas_activas).toBe(0);

        const cambio = await app.inject({
          method: 'PATCH',
          url: `/api/v1/lineas/${id}/estado`,
          payload: { estado: 'activa' },
        });

        expect(cambio.statusCode).toBe(200);

        // La segunda llamada no debe servir un valor cacheado.
        const despues = await app.inject({ method: 'GET', url: '/api/v1/dashboard/kpis' });

        expect(despues.statusCode).toBe(200);

        const kpisDespues = despues.json<{ total_lineas: number; lineas_activas: number }>();

        expect(kpisDespues.total_lineas).toBe(1);
        expect(kpisDespues.lineas_activas).toBe(1);
      });
    });

    describe('exportación .xlsx (RF-QUAL-1.9)', () => {
      const TIPO_EXCEL = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      /** Cabeceras de `COLUMNAS_EXPORT_LINEAS` (RF-LIN-EXP-1.2). */
      const CABECERAS_LINEAS = [
        'numero',
        'numero_original',
        'proveedor',
        'centro_coste_codigo',
        'centro_coste_nombre',
        'fecha_asignacion',
        'costo_mensual',
        'tipo_linea',
        'empleado',
        'estado',
        'tipo_uso',
        'created_at',
      ];

      /** Cabeceras de `COLUMNAS_EXPORT_CENTROS` (RF-CC-EXP-1.1). */
      const CABECERAS_CENTROS = ['codigo', 'nombre', 'formato_nombre', 'created_at'];

      /** Cabeceras de `COLUMNAS_EXPORT_FORMATOS` (RF-FMT-EXP-1.1). */
      const CABECERAS_FORMATOS = ['nombre', 'created_at'];

      it('exporta las líneas en un archivo .xlsx con su nombre y sus cabeceras', async () => {
        const formatoId = await crearFormato();
        const centroId = await crearCentroCoste(formatoId);

        await app.inject({
          method: 'POST',
          url: '/api/v1/lineas',
          payload: { numero: '+56912345678', centro_coste_id: centroId, proveedor: 'Movistar' },
        });

        const respuesta = await app.inject({
          method: 'GET',
          url: '/api/v1/lineas/export?format=xlsx',
        });

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.headers['content-type']).toContain(TIPO_EXCEL);

        const nombreArchivo = /filename="([^"]+)"/.exec(
          respuesta.headers['content-disposition'] ?? ''
        )?.[1];

        expect(nombreArchivo).toMatch(/^lineas_\d{8}_\d{6}\.xlsx$/);
        expect(esArchivoXlsx(respuesta.rawPayload)).toBe(true);
        expect(primeraFilaXlsx(respuesta.rawPayload)).toEqual(CABECERAS_LINEAS);
      });

      it('exporta los centros de coste en un archivo .xlsx con su nombre y sus cabeceras', async () => {
        const formatoId = await crearFormato();
        await crearCentroCoste(formatoId, 'CC-XLSX', 'Centro para xlsx');

        const respuesta = await app.inject({
          method: 'GET',
          url: '/api/v1/centros-coste/export?format=xlsx',
        });

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.headers['content-type']).toContain(TIPO_EXCEL);

        // El prefijo real del archivo de centros es `centros_coste`.
        const nombreArchivo = /filename="([^"]+)"/.exec(
          respuesta.headers['content-disposition'] ?? ''
        )?.[1];

        expect(nombreArchivo).toMatch(/^centros_coste_\d{8}_\d{6}\.xlsx$/);
        expect(esArchivoXlsx(respuesta.rawPayload)).toBe(true);
        expect(primeraFilaXlsx(respuesta.rawPayload)).toEqual(CABECERAS_CENTROS);
      });

      it('exporta los formatos en un archivo .xlsx con su nombre y sus cabeceras', async () => {
        await crearFormato('SMU');

        const respuesta = await app.inject({
          method: 'GET',
          url: '/api/v1/formatos/export?format=xlsx',
        });

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.headers['content-type']).toContain(TIPO_EXCEL);

        const nombreArchivo = /filename="([^"]+)"/.exec(
          respuesta.headers['content-disposition'] ?? ''
        )?.[1];

        expect(nombreArchivo).toMatch(/^formatos_\d{8}_\d{6}\.xlsx$/);
        expect(esArchivoXlsx(respuesta.rawPayload)).toBe(true);
        expect(primeraFilaXlsx(respuesta.rawPayload)).toEqual(CABECERAS_FORMATOS);
      });
    });

    describe('importación sin distinguir mayúsculas (RF-QUAL-1.12)', () => {
      it('resuelve el formato del archivo aunque esté escrito en otra caja', async () => {
        const formatoId = await crearFormato('SMU');

        const csv = 'codigo,nombre,formato_nombre\nCC-912,CENTRO IMPORTADO,smu';
        const { payload, headers } = cuerpoMultipart('centros.csv', csv);

        const respuesta = await app.inject({
          method: 'POST',
          url: '/api/v1/import/centros-coste',
          headers,
          payload,
        });

        expect(respuesta.statusCode).toBe(200);

        const reporte = respuesta.json<{ insertados: number; errores: unknown[] }>();

        expect(reporte.insertados).toBe(1);
        expect(reporte.errores).toEqual([]);

        // El centro debe apuntar al formato existente `SMU`, no a uno nuevo.
        const centros = await app.inject({ method: 'GET', url: '/api/v1/centros-coste?limit=100' });

        expect(centros.statusCode).toBe(200);

        const items = centros.json<{ items: { codigo: string; formato_id: string }[] }>().items;

        expect(items).toHaveLength(1);
        expect(items[0]?.codigo).toBe('CC-912');
        expect(items[0]?.formato_id).toBe(formatoId);

        // No se creó ningún formato nuevo.
        const formatos = await app.inject({ method: 'GET', url: '/api/v1/formatos?limit=100' });

        expect(
          formatos.json<{ items: { nombre: string }[] }>().items.map((item) => item.nombre)
        ).toEqual(['SMU']);
      });
    });

    describe('endpoints de salud (/health, /health/live, /health/ready)', () => {
      it('responde 200 en liveness y readiness con la base de datos activa', async () => {
        const resHealth = await app.inject({ method: 'GET', url: '/health' });
        const resLive = await app.inject({ method: 'GET', url: '/health/live' });
        const resReady = await app.inject({ method: 'GET', url: '/health/ready' });

        expect(resHealth.statusCode).toBe(200);
        expect(resHealth.json()).toMatchObject({ status: 'ok' });
        expect(resLive.statusCode).toBe(200);
        expect(resLive.json()).toMatchObject({ status: 'ok' });
        expect(resReady.statusCode).toBe(200);
        expect(resReady.json()).toMatchObject({ status: 'ok', database: 'up' });
      });
    });
  });
});

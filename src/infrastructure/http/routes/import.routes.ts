import {
  plantillaQuerySchema,
  reporteImportacionCentrosSchema,
  reporteImportacionLineasSchema,
} from '../schemas/import.schemas.js';

import type { ArchivoRecibido, ImportController } from '../controllers/import.controller.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/** Campo multipart con la opción de crear los formatos que falten. */
const CAMPO_CREAR_FORMATOS = 'crear_formatos_faltantes';

/** Contenido del multipart multipart de una importación de centros de coste. */
interface PartesImportacion {
  /** Archivo recibido (si lo hubo). */
  readonly archivo: ArchivoRecibido | undefined;
  /** Opción `crear_formatos_faltantes` (por defecto `false`). */
  readonly crearFormatosFaltantes: boolean;
}

/**
 * Lee el archivo y los campos de un multipart/form-data.
 *
 * El campo `crear_formatos_faltantes` llega como texto (`'true'` / `'false'`); se interpreta
 * de forma explícita (sin `z.coerce.boolean()`, que evalúa `"false"` como `true`).
 */
async function leerPartes(request: FastifyRequest): Promise<PartesImportacion> {
  let archivo: ArchivoRecibido | undefined;
  let crearFormatosFaltantes = false;

  if (!request.isMultipart()) {
    return { archivo, crearFormatosFaltantes };
  }

  for await (const parte of request.parts()) {
    if (parte.type === 'file') {
      const contenido = await parte.toBuffer();

      archivo ??= { nombreArchivo: parte.filename, contenido };

      continue;
    }

    if (parte.fieldname === CAMPO_CREAR_FORMATOS) {
      const valor = typeof parte.value === 'string' ? parte.value : '';

      crearFormatosFaltantes = valor.trim().toLowerCase() === 'true';
    }
  }

  return { archivo, crearFormatosFaltantes };
}

/**
 * Rutas del módulo de importación (`RF-CC-IMP-1.1`, `RF-LIN-IMP-1.1`, `RF-UI-IMP-1.4`).
 */
export function registrarRutasImport(app: FastifyInstance, controller: ImportController): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    '/import/templates',
    {
      schema: { querystring: plantillaQuerySchema },
    },
    async (request, reply) => {
      const archivo = controller.plantilla(request.query.tipo);

      return reply
        .type(archivo.contentType)
        .header('content-disposition', `attachment; filename="${archivo.nombreArchivo}"`)
        .send(archivo.contenido);
    }
  );

  api.post(
    '/import/centros-coste',
    {
      schema: {
        consumes: ['multipart/form-data'],
        response: { 200: reporteImportacionCentrosSchema },
      },
    },
    async (request) => {
      const { archivo, crearFormatosFaltantes } = await leerPartes(request);

      return controller.importarCentrosCoste(archivo, { crearFormatosFaltantes });
    }
  );

  api.post(
    '/import/lineas',
    {
      schema: {
        consumes: ['multipart/form-data'],
        response: { 200: reporteImportacionLineasSchema },
      },
    },
    async (request) => {
      const { archivo } = await leerPartes(request);

      return controller.importarLineas(archivo);
    }
  );
}

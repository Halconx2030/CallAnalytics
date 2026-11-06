import { versionEsperadaDe } from '../if-match.js';
import {
  actualizarCentroCosteBodySchema,
  centroCostePaginaSchema,
  centroCosteParamsSchema,
  centroCosteQuerySchema,
  centroCosteResponseSchema,
  crearCentroCosteBodySchema,
} from '../schemas/centro-coste.schemas.js';
import { formatoExportacionQuerySchema } from '../schemas/comunes.js';

import type { CentroCosteController } from '../controllers/centro-coste.controller.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Rutas de centros de coste (`RF-CC-1.1` a `RF-CC-1.6`, `RF-CC-EXP-1.1`).
 */
export function registrarRutasCentroCoste(
  app: FastifyInstance,
  controller: CentroCosteController
): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    '/centros-coste',
    {
      schema: {
        querystring: centroCosteQuerySchema,
        response: { 200: centroCostePaginaSchema },
      },
    },
    async (request) => controller.listar(request.query)
  );

  api.get(
    '/centros-coste/export',
    {
      schema: { querystring: centroCosteQuerySchema.merge(formatoExportacionQuerySchema) },
    },
    async (request, reply) => {
      const archivo = await controller.exportar(request.query.format, request.query);

      return reply
        .type(archivo.contentType)
        .header('content-disposition', `attachment; filename="${archivo.nombreArchivo}"`)
        .send(archivo.contenido);
    }
  );

  api.post(
    '/centros-coste',
    {
      schema: {
        body: crearCentroCosteBodySchema,
        response: { 201: centroCosteResponseSchema },
      },
    },
    async (request, reply) => {
      const centro = await controller.crear(request.body);

      return reply.code(201).send(centro);
    }
  );

  api.get(
    '/centros-coste/:id',
    {
      schema: {
        params: centroCosteParamsSchema,
        response: { 200: centroCosteResponseSchema },
      },
    },
    async (request) => controller.obtener(request.params.id)
  );

  api.put(
    '/centros-coste/:id',
    {
      schema: {
        params: centroCosteParamsSchema,
        body: actualizarCentroCosteBodySchema,
        response: { 200: centroCosteResponseSchema },
      },
    },
    async (request) =>
      controller.actualizar(request.params.id, request.body, versionEsperadaDe(request))
  );

  api.delete(
    '/centros-coste/:id',
    {
      schema: { params: centroCosteParamsSchema },
    },
    async (request, reply) => {
      await controller.eliminar(request.params.id, versionEsperadaDe(request));

      return reply.code(204).send();
    }
  );
}

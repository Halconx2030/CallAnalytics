import { versionEsperadaDe } from '../if-match.js';
import { formatoExportacionQuerySchema, paginacionQuerySchema } from '../schemas/comunes.js';
import {
  crearFormatoBodySchema,
  formatoPaginaSchema,
  formatoParamsSchema,
  formatoResponseSchema,
} from '../schemas/formato.schemas.js';

import type { FormatoController } from '../controllers/formato.controller.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Rutas de formatos (`RF-FMT-1.1` a `RF-FMT-1.4`, `RF-FMT-EXP-1.1`).
 */
export function registrarRutasFormato(app: FastifyInstance, controller: FormatoController): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    '/formatos',
    {
      schema: {
        querystring: paginacionQuerySchema,
        response: { 200: formatoPaginaSchema },
      },
    },
    async (request) => controller.listar(request.query)
  );

  api.get(
    '/formatos/export',
    {
      schema: { querystring: formatoExportacionQuerySchema },
    },
    async (request, reply) => {
      const archivo = await controller.exportar(request.query.format);

      return reply
        .type(archivo.contentType)
        .header('content-disposition', `attachment; filename="${archivo.nombreArchivo}"`)
        .send(archivo.contenido);
    }
  );

  api.post(
    '/formatos',
    {
      schema: {
        body: crearFormatoBodySchema,
        response: { 201: formatoResponseSchema },
      },
    },
    async (request, reply) => {
      const formato = await controller.crear(request.body);

      return reply.code(201).send(formato);
    }
  );

  api.get(
    '/formatos/:id',
    {
      schema: {
        params: formatoParamsSchema,
        response: { 200: formatoResponseSchema },
      },
    },
    async (request) => controller.obtener(request.params.id)
  );

  api.put(
    '/formatos/:id',
    {
      schema: {
        params: formatoParamsSchema,
        body: crearFormatoBodySchema,
        response: { 200: formatoResponseSchema },
      },
    },
    async (request) =>
      controller.actualizar(request.params.id, request.body, versionEsperadaDe(request))
  );

  api.delete(
    '/formatos/:id',
    {
      schema: { params: formatoParamsSchema },
    },
    async (request, reply) => {
      await controller.eliminar(request.params.id, versionEsperadaDe(request));

      return reply.code(204).send();
    }
  );
}

import { versionEsperadaDe } from '../if-match.js';
import {
  actualizarLineaBodySchema,
  cambiarEstadoLineaBodySchema,
  cambiarEstadoMasivoBodySchema,
  cambioEstadoMasivoResponseSchema,
  crearLineaBodySchema,
  lineaExportQuerySchema,
  lineaPaginaSchema,
  lineaParamsSchema,
  lineaQuerySchema,
  lineaResponseSchema,
} from '../schemas/linea.schemas.js';

import type { LineaController } from '../controllers/linea.controller.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Rutas de líneas telefónicas (`RF-LIN-1.1` a `RF-LIN-1.9`, `RF-LIN-EXP-1.1` a `RF-LIN-EXP-1.4`).
 */
export function registrarRutasLinea(app: FastifyInstance, controller: LineaController): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    '/lineas',
    {
      schema: {
        querystring: lineaQuerySchema,
        response: { 200: lineaPaginaSchema },
      },
    },
    async (request) => controller.listar(request.query)
  );

  api.get(
    '/lineas/export',
    {
      schema: {
        querystring: lineaExportQuerySchema,
      },
    },
    async (request, reply) => {
      const archivo = await controller.exportar(
        request.query.format,
        request.query,
        request.query.incluir_bajas === true
      );

      return reply
        .type(archivo.contentType)
        .header('content-disposition', `attachment; filename="${archivo.nombreArchivo}"`)
        .send(archivo.contenido);
    }
  );

  api.post(
    '/lineas/estado/masivo',
    {
      schema: {
        body: cambiarEstadoMasivoBodySchema,
        response: { 200: cambioEstadoMasivoResponseSchema },
      },
    },
    async (request) => controller.cambiarEstadoMasivo(request.body)
  );

  api.post(
    '/lineas',
    {
      schema: {
        body: crearLineaBodySchema,
        response: { 201: lineaResponseSchema },
      },
    },
    async (request, reply) => {
      const linea = await controller.crear(request.body);

      return reply.code(201).send(linea);
    }
  );

  api.get(
    '/lineas/:id',
    {
      schema: {
        params: lineaParamsSchema,
        response: { 200: lineaResponseSchema },
      },
    },
    async (request) => controller.obtener(request.params.id)
  );

  api.put(
    '/lineas/:id',
    {
      schema: {
        params: lineaParamsSchema,
        body: actualizarLineaBodySchema,
        response: { 200: lineaResponseSchema },
      },
    },
    async (request) =>
      controller.actualizar(request.params.id, request.body, versionEsperadaDe(request))
  );

  api.patch(
    '/lineas/:id/estado',
    {
      schema: {
        params: lineaParamsSchema,
        body: cambiarEstadoLineaBodySchema,
        response: { 200: lineaResponseSchema },
      },
    },
    async (request) =>
      controller.cambiarEstado(request.params.id, request.body.estado, versionEsperadaDe(request))
  );

  api.delete(
    '/lineas/:id',
    {
      schema: { params: lineaParamsSchema },
    },
    async (request, reply) => {
      const linea = await controller.eliminar(request.params.id, versionEsperadaDe(request));

      return reply.code(200).send(linea);
    }
  );
}

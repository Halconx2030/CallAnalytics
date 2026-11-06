import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Identificador de correlación de la petición (constitución, regla 15). */
    correlationId: string;
  }
}

/**
 * Propaga el `correlation_id` entre petición y respuesta.
 *
 * Si el cliente envía la cabecera `x-correlation-id` se reutiliza; si no, se genera un UUID.
 * El valor se devuelve siempre en la respuesta y se incluye en los logs estructurados.
 */
export function registrarCorrelationId(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const cabecera = request.headers['x-correlation-id'];
    const recibido = typeof cabecera === 'string' ? cabecera.trim() : '';

    request.correlationId = recibido === '' ? randomUUID() : recibido;
    reply.header('x-correlation-id', request.correlationId);
  });
}

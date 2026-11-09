import type { FastifyInstance } from 'fastify';

/** Función que verifica la disponibilidad de la base de datos. */
export type PingDatabase = () => Promise<void>;

/**
 * Registra los endpoints de salud de la aplicación:
 * - `/health/live` y `/health`: liveness probe (siempre HTTP 200 si el proceso responde).
 * - `/health/ready`: readiness probe (HTTP 200 si la base de datos responde, HTTP 503 en caso contrario).
 */
export function registrarRutasHealth(app: FastifyInstance, pingDatabase: PingDatabase): void {
  const respuestaViva = (): { status: 'ok'; timestamp: string } => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });

  app.get('/health', respuestaViva);
  app.get('/health/live', respuestaViva);

  app.get('/health/ready', async (request, reply) => {
    try {
      await pingDatabase();
      return {
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      request.log.error({ err }, 'fallo en verificacion de salud de la base de datos');
      return reply.status(503).send({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

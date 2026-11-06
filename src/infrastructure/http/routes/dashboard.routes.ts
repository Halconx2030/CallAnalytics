import { kpisResponseSchema } from '../schemas/dashboard.schemas.js';

import type { DashboardController } from '../controllers/dashboard.controller.js';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

/**
 * Rutas del dashboard (`RF-DASH-1.1`, `RF-DASH-1.2`).
 */
export function registrarRutasDashboard(
  app: FastifyInstance,
  controller: DashboardController
): void {
  const api = app.withTypeProvider<ZodTypeProvider>();

  api.get(
    '/dashboard/kpis',
    {
      schema: { response: { 200: kpisResponseSchema } },
    },
    async () => controller.obtenerKPIs()
  );
}

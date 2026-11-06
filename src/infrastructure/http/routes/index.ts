import { CentroCosteController } from '../controllers/centro-coste.controller.js';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { FormatoController } from '../controllers/formato.controller.js';
import { ImportController } from '../controllers/import.controller.js';
import { LineaController } from '../controllers/linea.controller.js';

import { registrarRutasCentroCoste } from './centro-coste.routes.js';
import { registrarRutasDashboard } from './dashboard.routes.js';
import { registrarRutasFormato } from './formato.routes.js';
import { registrarRutasImport } from './import.routes.js';
import { registrarRutasLinea } from './linea.routes.js';

import type { Contenedor } from '../container.js';
import type { FastifyInstance } from 'fastify';

/**
 * Registra todas las rutas de la API bajo el prefijo `/api/v1` (constitución regla 13).
 */
export function registrarRutas(app: FastifyInstance, contenedor: Contenedor): void {
  // El plugin debe ser asíncrono (o declarar `done`) para que Fastify no espere
  // indefinidamente: un callback plano sin `done()` provoca "Plugin did not start in time".
  app.register(
    (api, _opciones, listo) => {
      registrarRutasFormato(api, new FormatoController(contenedor.formatoService));
      registrarRutasCentroCoste(api, new CentroCosteController(contenedor.centroCosteService));
      registrarRutasLinea(api, new LineaController(contenedor.lineaService));
      registrarRutasImport(api, new ImportController(contenedor.importService));
      registrarRutasDashboard(api, new DashboardController(contenedor.dashboardService));
      listo();
    },
    { prefix: '/api/v1' }
  );
}

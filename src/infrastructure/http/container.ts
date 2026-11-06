import { CentroCosteService } from '@application/services/centro-coste.service.js';
import { DashboardService } from '@application/services/dashboard.service.js';
import { FormatoService } from '@application/services/formato.service.js';
import { ImportService } from '@application/services/import.service.js';
import { LineaService } from '@application/services/linea.service.js';

import { db as dbPorDefecto } from '@infrastructure/database/connection.js';
import { DrizzleCentroCosteRepository } from '@infrastructure/database/repositories/centro-coste.repository.js';
import { DrizzleDashboardRepository } from '@infrastructure/database/repositories/dashboard.repository.js';
import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';
import { DrizzleLineaRepository } from '@infrastructure/database/repositories/linea.repository.js';
import { DrizzleUnidadDeTrabajo } from '@infrastructure/database/repositories/unidad-de-trabajo.repository.js';
import type * as schema from '@infrastructure/database/schema/index.js';
import { XlsxParser } from '@infrastructure/external/spreadsheet/xlsx-parser.js';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/** Servicios de la aplicación, listos para usar en los controladores HTTP. */
export interface Contenedor {
  formatoService: FormatoService;
  centroCosteService: CentroCosteService;
  lineaService: LineaService;
  dashboardService: DashboardService;
  importService: ImportService;
}

/**
 * Construye los servicios con sus repositorios de Drizzle.
 *
 * @param db conexión a la base de datos; por defecto la de `config/env`.
 */
export function crearContenedor(db: PostgresJsDatabase<typeof schema> = dbPorDefecto): Contenedor {
  const formatos = new DrizzleFormatoRepository(db);
  const centrosCoste = new DrizzleCentroCosteRepository(db);
  const lineas = new DrizzleLineaRepository(db);
  const dashboard = new DrizzleDashboardRepository(db);
  const unidadDeTrabajo = new DrizzleUnidadDeTrabajo(db);
  const parser = new XlsxParser();

  return {
    formatoService: new FormatoService(formatos, centrosCoste),
    centroCosteService: new CentroCosteService(centrosCoste, formatos, lineas),
    lineaService: new LineaService(lineas, centrosCoste),
    dashboardService: new DashboardService(dashboard),
    importService: new ImportService(parser, formatos, centrosCoste, lineas, unidadDeTrabajo),
  };
}

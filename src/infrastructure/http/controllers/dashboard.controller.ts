import type { DashboardService } from '@application/services/dashboard.service.js';

import { toKpisResponse } from '../respuestas.js';

import type { KpisResponse } from '../respuestas.js';

/** Controlador HTTP del panel principal (`RF-DASH-1.1`). */
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  /** KPIs del panel: total, activas, personal y geovictoria (`RF-DASH-1.1`). */
  async obtenerKPIs(): Promise<KpisResponse> {
    return toKpisResponse(await this.service.obtenerKPIs());
  }
}

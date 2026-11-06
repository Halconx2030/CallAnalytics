import type { KpisDto } from '@application/dto/dashboard.dto.js';
import type { DashboardRepository } from '@application/ports/repositories/DashboardRepository.js';

/**
 * Casos de uso del panel principal (RF-DASH-1.1 y RF-DASH-1.2).
 *
 * Los KPIs se calculan siempre sobre la base de datos, sin caché persistente.
 */
export class DashboardService {
  constructor(private readonly dashboard: DashboardRepository) {}

  /** Devuelve los cuatro KPIs del dashboard. */
  async obtenerKPIs(): Promise<KpisDto> {
    const kpis = await this.dashboard.obtenerKPIs();

    return {
      totalLineas: kpis.totalLineas,
      lineasActivas: kpis.lineasActivas,
      countPersonal: kpis.countPersonal,
      countGeovictoria: kpis.countGeovictoria,
    };
  }
}

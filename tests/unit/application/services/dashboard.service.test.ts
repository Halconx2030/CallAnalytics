import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { DashboardRepository } from '@application/ports/repositories/DashboardRepository.js';
import { DashboardService } from '@application/services/dashboard.service.js';

describe('DashboardService', () => {
  let dashboard: MockProxy<DashboardRepository>;
  let service: DashboardService;

  beforeEach(() => {
    dashboard = mock<DashboardRepository>();
    service = new DashboardService(dashboard);
  });

  it('devuelve los cuatro KPIs del dashboard', async () => {
    dashboard.obtenerKPIs.mockResolvedValue({
      totalLineas: 120,
      lineasActivas: 80,
      countPersonal: 70,
      countGeovictoria: 50,
    });

    const resultado = await service.obtenerKPIs();

    expect(resultado).toEqual({
      totalLineas: 120,
      lineasActivas: 80,
      countPersonal: 70,
      countGeovictoria: 50,
    });
    expect(dashboard.obtenerKPIs).toHaveBeenCalledTimes(1);
  });

  it('propaga el error del repositorio', async () => {
    dashboard.obtenerKPIs.mockRejectedValue(new Error('fallo de base de datos'));

    await expect(service.obtenerKPIs()).rejects.toThrow('fallo de base de datos');
  });
});

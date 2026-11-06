import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CentroCoste } from '@domain/entities/CentroCoste.js';
import { Formato } from '@domain/entities/Formato.js';
import { LineaTelefonica } from '@domain/entities/LineaTelefonica.js';

import { DrizzleCentroCosteRepository } from '@infrastructure/database/repositories/centro-coste.repository.js';
import { DrizzleDashboardRepository } from '@infrastructure/database/repositories/dashboard.repository.js';
import { DrizzleFormatoRepository } from '@infrastructure/database/repositories/formato.repository.js';
import { DrizzleLineaRepository } from '@infrastructure/database/repositories/linea.repository.js';

import { crearBaseDePruebas, type BaseDePruebas } from './test-db.js';

describe('DrizzleDashboardRepository (integración)', () => {
  let base: BaseDePruebas;
  let dashboard: DrizzleDashboardRepository;
  let formatos: DrizzleFormatoRepository;
  let centros: DrizzleCentroCosteRepository;
  let lineas: DrizzleLineaRepository;
  let centroCosteId: string;

  beforeAll(async () => {
    base = await crearBaseDePruebas();
    dashboard = new DrizzleDashboardRepository(base.db);
    formatos = new DrizzleFormatoRepository(base.db);
    centros = new DrizzleCentroCosteRepository(base.db);
    lineas = new DrizzleLineaRepository(base.db);
  });

  afterAll(async () => {
    await base.cerrar();
  });

  beforeEach(async () => {
    await base.limpiar();

    const formato = await formatos.crear(Formato.crearFormato({ nombre: 'SMU' }));
    const centro = await centros.crear(
      CentroCoste.crearCentroCoste({
        codigo: '510',
        nombre: 'RENDIC',
        formatoId: formato.id ?? '',
      })
    );

    centroCosteId = centro.id ?? '';
  });

  async function crearLinea(
    numero: string,
    estado: 'activa' | 'pendiente' | 'baja',
    tipoUso: 'personal' | 'geovictoria'
  ) {
    return lineas.crear(
      LineaTelefonica.crearLineaTelefonica({
        numero,
        centroCosteId,
        estado,
        tipoUso,
      })
    );
  }

  it('devuelve los cuatro KPIs sin contar las líneas dadas de baja', async () => {
    await crearLinea('911111111', 'activa', 'personal');
    await crearLinea('922222222', 'activa', 'geovictoria');
    await crearLinea('933333333', 'pendiente', 'personal');
    await crearLinea('944444444', 'baja', 'personal');

    const kpis = await dashboard.obtenerKPIs();

    expect(kpis.totalLineas).toBe(3);
    expect(kpis.lineasActivas).toBe(2);
    expect(kpis.countPersonal).toBe(2);
    expect(kpis.countGeovictoria).toBe(1);
  });

  it('devuelve ceros cuando no hay líneas', async () => {
    const kpis = await dashboard.obtenerKPIs();

    expect(kpis).toEqual({
      totalLineas: 0,
      lineasActivas: 0,
      countPersonal: 0,
      countGeovictoria: 0,
    });
  });
});

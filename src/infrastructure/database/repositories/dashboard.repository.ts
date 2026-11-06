import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';

import type {
  DashboardRepository,
  KpisLineas,
} from '@application/ports/repositories/DashboardRepository.js';

import * as schema from '../schema/index.js';

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/**
 * Implementación Drizzle del puerto {@link DashboardRepository}.
 *
 * Los cuatro contadores se ejecutan en paralelo (`Promise.all`) y sin caché: los KPIs
 * siempre reflejan el estado actual de la base de datos (RF-DASH-1.2).
 */
export class DrizzleDashboardRepository implements DashboardRepository {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async obtenerKPIs(): Promise<KpisLineas> {
    const [totalLineas, lineasActivas, countPersonal, countGeovictoria] = await Promise.all([
      this.contar([isNull(schema.lineasTelefonicas.deletedAt)]),
      this.contar([
        isNull(schema.lineasTelefonicas.deletedAt),
        eq(schema.lineasTelefonicas.estado, 'activa'),
      ]),
      this.contar([
        isNull(schema.lineasTelefonicas.deletedAt),
        eq(schema.lineasTelefonicas.tipoUso, 'personal'),
      ]),
      this.contar([
        isNull(schema.lineasTelefonicas.deletedAt),
        eq(schema.lineasTelefonicas.tipoUso, 'geovictoria'),
      ]),
    ]);

    return { totalLineas, lineasActivas, countPersonal, countGeovictoria };
  }

  /** Cuenta las líneas que cumplen todas las condiciones dadas. */
  private async contar(condiciones: SQL[]): Promise<number> {
    const filas = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.lineasTelefonicas)
      .where(and(...condiciones));

    return filas[0]?.total ?? 0;
  }
}

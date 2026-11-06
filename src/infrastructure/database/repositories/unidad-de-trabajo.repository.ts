import type {
  RepositoriosTransaccionales,
  UnidadDeTrabajo,
} from '@application/ports/repositories/UnidadDeTrabajo.js';

import { DrizzleCentroCosteRepository } from './centro-coste.repository.js';
import { DrizzleFormatoRepository } from './formato.repository.js';

import type { ClienteDrizzle } from './tipos.js';

/**
 * Implementación Drizzle de la unidad de trabajo.
 *
 * Abre una transacción y entrega repositorios *scoped* a ella: todo lo que escriban se
 * confirma o se deshace junto con el resto de la operación.
 */
export class DrizzleUnidadDeTrabajo implements UnidadDeTrabajo {
  constructor(private readonly db: ClienteDrizzle) {}

  async ejecutar<T>(operacion: (repos: RepositoriosTransaccionales) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const formatos = new DrizzleFormatoRepository(tx);
      const centrosCoste = new DrizzleCentroCosteRepository(tx);

      return operacion({ formatos, centrosCoste });
    });
  }
}

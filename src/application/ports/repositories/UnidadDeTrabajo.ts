import type { CentroCosteRepository } from './CentroCosteRepository.js';
import type { FormatoRepository } from './FormatoRepository.js';

/**
 * Repositorios que participan en una misma transacción.
 *
 * Las instancias son *scoped* a la transacción: cualquier escritura que hagan se confirma
 * o se deshace junto con el resto de la operación.
 */
export interface RepositoriosTransaccionales {
  /** Repositorio de formatos (scoped a la transacción). */
  readonly formatos: FormatoRepository;
  /** Repositorio de centros de coste (scoped a la transacción). */
  readonly centrosCoste: CentroCosteRepository;
}

/**
 * Unidad de trabajo: ejecuta una operación sobre repositorios transaccionales.
 *
 * Si la operación lanza un error, todo lo escrito se deshace (todo-o-nada). Se usa, por
 * ejemplo, para crear los formatos que faltan y guardar los centros de coste en una sola
 * transacción (importación de centros con creación automática de formatos).
 */
export interface UnidadDeTrabajo {
  /** Ejecuta la operación dentro de una transacción y devuelve su resultado. */
  ejecutar<T>(operacion: (repos: RepositoriosTransaccionales) => Promise<T>): Promise<T>;
}

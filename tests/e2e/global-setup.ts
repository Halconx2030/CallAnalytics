import { prepararBaseDePruebas } from './db.js';

/** Prepara la base de pruebas antes de ejecutar los tests E2E. */
export default async function globalSetup(): Promise<void> {
  await prepararBaseDePruebas();
}

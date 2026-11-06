import { afterEach, beforeEach, vi } from 'vitest';

// Nota: no se activan fake timers globales. Las pruebas de integración usan PostgreSQL real
// y los temporizadores falsos dejaban colgadas las conexiones.

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetModules();
});

export {};

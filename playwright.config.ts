import { defineConfig, devices } from '@playwright/test';

const URL_BASE_DATOS =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/telefono2';

const urlBasePruebas = new URL(URL_BASE_DATOS);
urlBasePruebas.pathname = '/telefono2_test';

/**
 * Puertos propios de la suite E2E.
 *
 * Se separan de los puertos del dev server (3000 / 5173) para que `pnpm test:e2e`
 * pueda ejecutarse con los servidores de desarrollo levantados. Se pueden
 * sobreescribir con `E2E_API_PORT` y `E2E_SPA_PORT`.
 */
const PUERTO_API = process.env['E2E_API_PORT'] ?? '3011';
const PUERTO_SPA = process.env['E2E_SPA_PORT'] ?? '5183';

const URL_API = `http://localhost:${PUERTO_API}`;
const URL_SPA = `http://localhost:${PUERTO_SPA}`;

/**
 * Configuración de Playwright para los tests E2E.
 *
 * Levanta dos servidores propios: la API Fastify (puerto 3011) apuntando a la base
 * de pruebas `telefono2_test` y la SPA de Vite (puerto 5183, con el proxy `/api`
 * apuntando a la API 3011). La base de desarrollo `telefono2` nunca se toca y el
 * dev server puede seguir corriendo en 3000/5173.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: URL_SPA,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-CL',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx src/app.ts',
      url: `${URL_API}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        PORT: PUERTO_API,
        LOG_LEVEL: 'warn',
        CORS_ORIGIN: URL_SPA,
        DATABASE_URL: urlBasePruebas.toString(),
        DATABASE_SSL: 'false',
      },
    },
    {
      command: 'pnpm --dir presentation dev',
      url: URL_SPA,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        VITE_PORT: PUERTO_SPA,
        VITE_API_TARGET: URL_API,
      },
    },
  ],
});

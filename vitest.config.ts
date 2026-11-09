import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/app.ts',
        'src/config/**',
        'src/application/dto/dashboard.dto.ts',
        'src/application/ports/file-parser/**',
        'src/application/ports/repositories/CentroCosteRepository.ts',
        'src/application/ports/repositories/DashboardRepository.ts',
        'src/application/ports/repositories/FormatoRepository.ts',
        'src/application/ports/repositories/LineaRepository.ts',
        'src/application/ports/repositories/UnidadDeTrabajo.ts',
        'src/infrastructure/database/connection.ts',
        'src/infrastructure/database/seed.ts',
        'src/infrastructure/database/repositories/tipos.ts',
        'src/infrastructure/database/migrations/**',
        'src/infrastructure/database/schema/**',
        'src/**/*.d.ts',
        'tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // Los tests de integración comparten la base `telefono2_test` y la vacían entre casos,
    // por lo que los archivos deben ejecutarse de forma secuencial.
    fileParallelism: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
      '@config': path.resolve(__dirname, 'src/config'),
    },
  },
});

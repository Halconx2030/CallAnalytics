import { pathToFileURL } from 'node:url';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { MAX_BYTES_ARCHIVO } from '@application/dto/import.dto.js';

import { env } from '@config/env.js';
import { logger } from '@config/logger.js';

import { crearContenedor } from './infrastructure/http/container.js';
import { registrarManejadorErrores } from './infrastructure/http/middleware/error-handler.js';
import { registrarCorrelationId } from './infrastructure/http/plugins/correlation-id.js';
import { registrarRutas } from './infrastructure/http/routes/index.js';

import type * as schema from './infrastructure/database/schema/index.js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

/** Opciones de construcción de la aplicación. */
export interface OpcionesBuildApp {
  /** Base de datos a usar; por defecto la definida en `config/env`. */
  db?: PostgresJsDatabase<typeof schema>;
  /** Desactiva el log estructurado (usado en los tests). */
  silencioso?: boolean;
}

/** Construye la instancia de Fastify con plugins, middlewares y rutas. */
export async function buildApp(opciones: OpcionesBuildApp = {}): Promise<FastifyInstance> {
  // Fastify 5 separa la configuración (`logger`) de una instancia ya creada (`loggerInstance`).
  const app = Fastify({
    ...(opciones.silencioso ? { logger: false } : { loggerInstance: logger as FastifyBaseLogger }),
    ajv: {
      customOptions: {
        strict: true,
        allErrors: true,
        verbose: true,
      },
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: MAX_BYTES_ARCHIVO,
      files: 1,
    },
  });

  await app.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      info: {
        title: 'TELEFONO 2 API',
        description: 'Control de Líneas Telefónicas',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${env.PORT}`, description: 'Development server' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  registrarCorrelationId(app);
  registrarManejadorErrores(app);

  app.get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/openapi.json', () => app.swagger());

  const contenedor = crearContenedor(opciones.db);
  registrarRutas(app, contenedor);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Server listening on http://${env.HOST}:${env.PORT}`);
    logger.info(`Swagger UI available at http://${env.HOST}:${env.PORT}/docs`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// `import.meta.url` usa barras "/", mientras que `process.argv[1]` en Windows usa "\";
// `pathToFileURL` normaliza la comparación para que el arranque directo funcione.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await start();
}

export { start };

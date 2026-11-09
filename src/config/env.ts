import 'dotenv/config';

import { z } from 'zod';

/**
 * Convierte el valor textual de una variable booleana de entorno.
 *
 * `z.coerce.boolean()` convierte cualquier cadena no vacía en `true`, por lo que
 * `DATABASE_SSL=false` terminaba activando el SSL. Aquí se acepta de forma
 * explícita `true/false`, `1/0` y `yes/no`.
 */
const booleanoEnv = z.union([z.boolean(), z.string()]).transform((valor) => {
  if (typeof valor === 'boolean') {
    return valor;
  }

  const normalizado = valor.trim().toLowerCase();

  return ['true', '1', 'yes', 'si', 'sí'].includes(normalizado);
});

/** Zod schema for environment variables validation */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/telefono2'),
  DATABASE_POOL_SIZE: z.coerce.number().default(10),
  DATABASE_SSL: booleanoEnv.default(false),
});

/** Parsed and validated environment variables */
export const env: z.infer<typeof envSchema> = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;

import pino, { type LoggerOptions, type TransportSingleOptions } from 'pino';

import { env } from './env.js';

const isTest = env.NODE_ENV === 'test';
const isDevelopment = env.NODE_ENV === 'development';

const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({ service: 'telefono-2', env: env.NODE_ENV }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (isDevelopment && !isTest) {
  (loggerOptions as LoggerOptions & { transport?: TransportSingleOptions }).transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  };
}

/** Pino logger instance */
export const logger: pino.Logger = pino(loggerOptions);

export type Logger = typeof logger;

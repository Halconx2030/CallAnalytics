import { DomainError } from '@domain/errors/DomainError.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodError } from 'zod';

/**
 * Manejo centralizado de errores de la API.
 *
 * Todas las respuestas de error usan el formato **RFC 7807** (constitución, regla 14):
 *
 * ```json
 * { "type": "...", "title": "...", "status": 409, "detail": "...", "instance": "/api/v1/..." }
 * ```
 */

/** Base de las URIs de tipo de error. */
const BASE_TIPOS = 'https://telefono2.local/errors';

/** Descripción de cada código de error de dominio. */
const DESCRIPCIONES: Record<string, { status: number; title: string }> = {
  INVALID_PHONE_NUMBER: { status: 400, title: 'Número telefónico inválido' },
  INVALID_COSTO: { status: 400, title: 'Costo mensual inválido' },
  VALIDATION_ERROR: { status: 400, title: 'Datos inválidos' },
  FOREIGN_KEY: { status: 400, title: 'Referencia inexistente' },
  NOT_FOUND: { status: 404, title: 'Recurso no encontrado' },
  DUPLICATE: { status: 409, title: 'Recurso duplicado' },
  CONFLICT: { status: 409, title: 'Conflicto' },
  VALIDATION_FAILED: { status: 400, title: 'Datos inválidos' },
  PAYLOAD_TOO_LARGE: { status: 413, title: 'Archivo demasiado grande' },
  INTERNAL_ERROR: { status: 500, title: 'Error interno' },
};

/** Cuerpo de la respuesta de error. */
interface CuerpoError {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: { campo?: string; mensaje: string }[];
}

/** Detecta si el error viene del validador de Zod. */
function esErrorZod(error: unknown): error is ZodError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'ZodError'
  );
}

/** Detecta si el error corresponde a un payload demasiado grande. */
function esPayloadGrande(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'FST_REQ_FILE_TOO_LARGE'
  );
}

/** Traduce un error de Zod al detalle RFC 7807. */
function detallarZod(error: ZodError): { campo?: string; mensaje: string }[] {
  return error.issues.map((issue) => ({
    ...(issue.path.length > 0 ? { campo: issue.path.join('.') } : {}),
    mensaje: issue.message,
  }));
}

/** Traduce un error de validación de Fastify (AJV) al detalle RFC 7807. */
function detallarValidacionFastify(error: unknown): { campo?: string; mensaje: string }[] {
  const validation = error as { validation?: { instancePath?: string; message?: string }[] };
  const issues = validation.validation ?? [];

  return issues.map((issue) => ({
    ...(issue.instancePath && issue.instancePath !== ''
      ? { campo: issue.instancePath.replace(/^\//, '').replace(/\//g, '.') }
      : {}),
    mensaje: issue.message ?? 'Valor inválido',
  }));
}

/** Construye el cuerpo de error a partir de una excepción. */
function construirCuerpo(error: unknown, request: FastifyRequest): CuerpoError {
  if (error instanceof DomainError) {
    const descripcion = DESCRIPCIONES[error.code] ?? DESCRIPCIONES['INTERNAL_ERROR']!;

    return {
      type: `${BASE_TIPOS}/${error.code.toLowerCase().replace(/_/g, '-')}`,
      title: descripcion.title,
      status: descripcion.status,
      detail: error.message,
      instance: request.url,
    };
  }

  if (esErrorZod(error)) {
    return {
      type: `${BASE_TIPOS}/validation-failed`,
      title: DESCRIPCIONES['VALIDATION_FAILED']!.title,
      status: 400,
      detail: 'Los datos enviados no son válidos.',
      instance: request.url,
      errors: detallarZod(error),
    };
  }

  if (esPayloadGrande(error)) {
    return {
      type: `${BASE_TIPOS}/payload-too-large`,
      title: DESCRIPCIONES['PAYLOAD_TOO_LARGE']!.title,
      status: 413,
      detail: 'El archivo supera el tamaño máximo permitido (10 MB).',
      instance: request.url,
    };
  }

  const validacion = error as { validation?: unknown; statusCode?: number };

  if (validacion.validation !== undefined) {
    return {
      type: `${BASE_TIPOS}/validation-failed`,
      title: DESCRIPCIONES['VALIDATION_FAILED']!.title,
      status: 400,
      detail: 'Los datos enviados no son válidos.',
      instance: request.url,
      errors: detallarValidacionFastify(error),
    };
  }

  // Errores de Fastify que ya traen un estado 4xx (JSON malformado, media type inválido,
  // payload demasiado grande en el body, etc.) no deben terminar como 500.
  const conEstado = error as { statusCode?: unknown; message?: unknown };

  if (
    typeof conEstado.statusCode === 'number' &&
    conEstado.statusCode >= 400 &&
    conEstado.statusCode < 500
  ) {
    return {
      type: `${BASE_TIPOS}/invalid-request`,
      title: 'Solicitud inválida',
      status: conEstado.statusCode,
      detail:
        typeof conEstado.message === 'string'
          ? conEstado.message
          : 'La solicitud no pudo ser procesada.',
      instance: request.url,
    };
  }

  return {
    type: `${BASE_TIPOS}/internal-error`,
    title: DESCRIPCIONES['INTERNAL_ERROR']!.title,
    status: 500,
    detail: 'Ocurrió un error inesperado.',
    instance: request.url,
  };
}

/** Registra el manejador de errores y el de rutas no encontradas. */
export function registrarManejadorErrores(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const cuerpo = construirCuerpo(error, request);

    if (cuerpo.status >= 500) {
      request.log.error(
        { err: error, correlationId: request.correlationId },
        'error no controlado'
      );
    } else {
      request.log.warn(
        { code: cuerpo.type, status: cuerpo.status, correlationId: request.correlationId },
        'error controlado'
      );
    }

    void reply.status(cuerpo.status).type('application/problem+json').send(cuerpo);
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const cuerpo: CuerpoError = {
      type: `${BASE_TIPOS}/not-found`,
      title: 'Recurso no encontrado',
      status: 404,
      detail: `No existe la ruta ${request.method} ${request.url}.`,
      instance: request.url,
    };

    void reply.status(404).type('application/problem+json').send(cuerpo);
  });
}

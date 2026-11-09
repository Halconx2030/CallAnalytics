import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DomainError } from '@domain/errors/DomainError.js';

import { registrarManejadorErrores } from '@infrastructure/http/middleware/error-handler.js';

import type { FastifyInstance } from 'fastify';

/** Construye una app mínima cuya ruta `/boom` lanza el error recibido. */
function appQueLanza(error: unknown): FastifyInstance {
  const app = Fastify({ logger: false });
  registrarManejadorErrores(app);
  app.get('/boom', () => {
    throw error;
  });
  return app;
}

describe('error-handler (RFC 7807)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('mapea un DomainError conocido a su status', async () => {
    app = appQueLanza(new DomainError('ya existe', 'DUPLICATE'));
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ title: 'Recurso duplicado', detail: 'ya existe' });
  });

  it('usa INTERNAL_ERROR para un código de dominio desconocido', async () => {
    app = appQueLanza(new DomainError('raro', 'CODIGO_NUEVO'));
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.json().type).toContain('codigo-nuevo');
  });

  it('traduce un ZodError con el campo afectado', async () => {
    const resultado = z.object({ a: z.string() }).safeParse({ a: 1 });
    app = appQueLanza(resultado.success ? new Error('inesperado') : resultado.error);
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(400);
    expect(res.json().errors[0].campo).toBe('a');
  });

  it('traduce un ZodError sin path sin incluir campo', async () => {
    const resultado = z.string().safeParse(1);
    app = appQueLanza(resultado.success ? new Error('inesperado') : resultado.error);
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.json().errors[0]).not.toHaveProperty('campo');
  });

  it('responde 413 cuando el archivo es demasiado grande', async () => {
    app = appQueLanza(Object.assign(new Error('grande'), { code: 'FST_REQ_FILE_TOO_LARGE' }));
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(413);
  });

  it('traduce errores de validación de Fastify (con y sin instancePath)', async () => {
    app = appQueLanza(
      Object.assign(new Error('v'), {
        validation: [{ instancePath: '/a/b', message: 'mal' }, { instancePath: '' }],
      })
    );
    const res = await app.inject({ method: 'GET', url: '/boom' });
    const errores = res.json().errors;

    expect(res.statusCode).toBe(400);
    expect(errores[0]).toEqual({ campo: 'a.b', mensaje: 'mal' });
    expect(errores[1]).toEqual({ mensaje: 'Valor inválido' });
  });

  it('respeta un statusCode 4xx de Fastify', async () => {
    app = appQueLanza(Object.assign(new Error('json roto'), { statusCode: 422 }));
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(422);
    expect(res.json().detail).toBe('json roto');
  });

  it('usa un detalle genérico si el error 4xx no trae mensaje de texto', async () => {
    app = appQueLanza({ statusCode: 400, message: 42 });
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.json().detail).toBe('La solicitud no pudo ser procesada.');
  });

  it('devuelve 500 genérico sin filtrar detalles internos', async () => {
    app = appQueLanza(new Error('secreto de BD'));
    const res = await app.inject({ method: 'GET', url: '/boom' });

    expect(res.statusCode).toBe(500);
    expect(res.json().detail).toBe('Ocurrió un error inesperado.');
  });

  it('responde 404 problem+json en rutas inexistentes', async () => {
    app = appQueLanza(new Error('x'));
    const res = await app.inject({ method: 'GET', url: '/nope' });

    expect(res.statusCode).toBe(404);
    expect(res.json().detail).toContain('GET /nope');
  });
});

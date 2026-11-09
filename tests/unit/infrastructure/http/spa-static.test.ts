import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import Fastify from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { registrarManejadorErrores } from '@infrastructure/http/middleware/error-handler.js';
import {
  esRutaReservaBackend,
  resolverRutaSegura,
} from '@infrastructure/http/plugins/spa-static.js';

import type { FastifyInstance } from 'fastify';

describe('spa-static (servido full-stack de la SPA)', () => {
  let tempDir: string;
  let app: FastifyInstance;

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'telefono2-spa-'));
    mkdirSync(path.join(tempDir, 'assets'), { recursive: true });
    writeFileSync(path.join(tempDir, 'index.html'), '<!doctype html><div id="root">SPA</div>');
    writeFileSync(path.join(tempDir, 'assets', 'app.js'), 'console.log("ok");');
    writeFileSync(path.join(tempDir, 'datos.bin'), Buffer.from([1, 2, 3]));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await app?.close();
  });

  it('identifica correctamente las rutas reservadas del backend', () => {
    expect(esRutaReservaBackend('/api')).toBe(true);
    expect(esRutaReservaBackend('/api/v1/lineas')).toBe(true);
    expect(esRutaReservaBackend('/docs')).toBe(true);
    expect(esRutaReservaBackend('/docs/json')).toBe(true);
    expect(esRutaReservaBackend('/health/live')).toBe(true);
    expect(esRutaReservaBackend('/openapi.json')).toBe(true);
    expect(esRutaReservaBackend('/lineas')).toBe(false);
    expect(esRutaReservaBackend('/')).toBe(false);
  });

  it('bloquea intentos de path traversal o URLs malformadas en resolverRutaSegura', () => {
    expect(resolverRutaSegura(tempDir, '/../../etc/passwd')).toBeNull();
    expect(resolverRutaSegura(tempDir, '/%E0%A4%A')).toBeNull();
    expect(resolverRutaSegura(tempDir, '/assets/app.js')).toBe(
      path.join(tempDir, 'assets', 'app.js')
    );
  });

  it('sirve index.html en / y en rutas de cliente (/lineas) con Cache-Control no-cache', async () => {
    app = Fastify({ logger: false });
    registrarManejadorErrores(app, tempDir);

    const resRaiz = await app.inject({ method: 'GET', url: '/' });
    expect(resRaiz.statusCode).toBe(200);
    expect(resRaiz.headers['content-type']).toContain('text/html');
    expect(resRaiz.headers['cache-control']).toBe('no-cache');
    expect(resRaiz.body).toContain('SPA');

    const resLineas = await app.inject({ method: 'GET', url: '/lineas?estado=activa' });
    expect(resLineas.statusCode).toBe(200);
    expect(resLineas.body).toContain('SPA');
  });

  it('sirve activos en /assets/* con caché inmutable y tipos desconocidos como octet-stream', async () => {
    app = Fastify({ logger: false });
    registrarManejadorErrores(app, tempDir);

    const resJs = await app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(resJs.statusCode).toBe(200);
    expect(resJs.headers['content-type']).toContain('application/javascript');
    expect(resJs.headers['cache-control']).toContain('immutable');
    expect(resJs.body).toContain('console.log');

    const resBin = await app.inject({ method: 'GET', url: '/datos.bin' });
    expect(resBin.statusCode).toBe(200);
    expect(resBin.headers['content-type']).toBe('application/octet-stream');
  });

  it('responde 404 RFC 7807 para rutas /api/* inexistentes, activos con extensión ausentes y POST', async () => {
    app = Fastify({ logger: false });
    registrarManejadorErrores(app, tempDir);

    const resApi = await app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    expect(resApi.statusCode).toBe(404);
    expect(resApi.headers['content-type']).toContain('application/problem+json');

    const resAssetFaltante = await app.inject({ method: 'GET', url: '/assets/no-existe.js' });
    expect(resAssetFaltante.statusCode).toBe(404);
    expect(resAssetFaltante.headers['content-type']).toContain('application/problem+json');

    const resDirectorio = await app.inject({ method: 'GET', url: '/assets.ext' });
    expect(resDirectorio.statusCode).toBe(404);

    const resPost = await app.inject({ method: 'POST', url: '/lineas' });
    expect(resPost.statusCode).toBe(404);
  });

  it('delega al 404 cuando el directorio de la SPA no contiene index.html', async () => {
    app = Fastify({ logger: false });
    registrarManejadorErrores(app, path.join(tempDir, 'inexistente'));

    const res = await app.inject({ method: 'GET', url: '/lineas' });
    expect(res.statusCode).toBe(404);
  });
});

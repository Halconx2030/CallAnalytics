import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { registrarRutasHealth } from '@infrastructure/http/routes/health.routes.js';

import type { FastifyInstance } from 'fastify';

describe('health.routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('responde 200 en /health y /health/live', async () => {
    app = Fastify({ logger: false });
    registrarRutasHealth(app, () => Promise.resolve());

    const resHealth = await app.inject({ method: 'GET', url: '/health' });
    const resLive = await app.inject({ method: 'GET', url: '/health/live' });

    expect(resHealth.statusCode).toBe(200);
    expect(resHealth.json()).toMatchObject({ status: 'ok' });
    expect(resLive.statusCode).toBe(200);
    expect(resLive.json()).toMatchObject({ status: 'ok' });
  });

  it('responde 200 en /health/ready cuando la base de datos responde', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    app = Fastify({ logger: false });
    registrarRutasHealth(app, ping);

    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', database: 'up' });
    expect(ping).toHaveBeenCalledOnce();
  });

  it('responde 503 en /health/ready cuando falla la base de datos', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('DB caída'));
    app = Fastify({ logger: false });
    registrarRutasHealth(app, ping);

    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'error', database: 'down' });
  });
});

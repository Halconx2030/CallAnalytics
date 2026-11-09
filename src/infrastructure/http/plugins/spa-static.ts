import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { FastifyReply, FastifyRequest } from 'fastify';

/** Tipos MIME soportados para los activos estáticos de la SPA. */
const TIPOS_MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Prefijos reservados del backend que nunca deben resolverse hacia `index.html`. */
const PREFIJOS_RESERVADOS = ['/api', '/docs', '/health', '/openapi.json'] as const;

/** Indica si el pathname pertenece a un endpoint de API, documentación o salud. */
export function esRutaReservaBackend(pathname: string): boolean {
  return PREFIJOS_RESERVADOS.some(
    (prefijo) => pathname === prefijo || pathname.startsWith(`${prefijo}/`)
  );
}

/**
 * Resuelve de forma segura una ruta relativa dentro de `baseDir` evitando
 * cualquier intento de *path traversal* (`..`).
 */
export function resolverRutaSegura(baseDir: string, pathname: string): string | null {
  try {
    const decodificada = decodeURIComponent(pathname).replace(/^\/+/, '');
    const baseAbsoluta = path.resolve(baseDir);
    const destino = path.resolve(baseAbsoluta, decodificada);

    if (destino === baseAbsoluta || destino.startsWith(`${baseAbsoluta}${path.sep}`)) {
      return destino;
    }

    return null;
  } catch {
    return null;
  }
}

/** Lee un archivo solo si existe y es un fichero regular. */
async function leerArchivoRegular(rutaArchivo: string): Promise<Buffer | null> {
  try {
    const info = await stat(rutaArchivo);

    if (!info.isFile()) {
      return null;
    }

    return await readFile(rutaArchivo);
  } catch {
    return null;
  }
}

/** Envía un archivo estático con su `Content-Type` y política de caché adecuada. */
async function enviarArchivo(
  rutaArchivo: string,
  esInmutable: boolean,
  reply: FastifyReply
): Promise<boolean> {
  const contenido = await leerArchivoRegular(rutaArchivo);

  if (contenido === null) {
    return false;
  }

  const extension = path.extname(rutaArchivo).toLowerCase();
  const contentType = TIPOS_MIME[extension] ?? 'application/octet-stream';
  const cacheControl = esInmutable ? 'public, max-age=31536000, immutable' : 'no-cache';

  await reply.status(200).header('cache-control', cacheControl).type(contentType).send(contenido);
  return true;
}

/**
 * Intenta servir un activo estático o el `index.html` de la SPA (fallback History API).
 * Devuelve `true` si la respuesta fue enviada, o `false` si debe delegarse al 404 RFC 7807.
 */
export async function intentarServirSpa(
  request: FastifyRequest,
  reply: FastifyReply,
  spaDistDir: string
): Promise<boolean> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }

  const pathname = request.url.split('?')[0] ?? '/';

  if (esRutaReservaBackend(pathname)) {
    return false;
  }

  const rutaIndex = path.resolve(spaDistDir, 'index.html');

  if (!existsSync(rutaIndex)) {
    return false;
  }

  if (pathname !== '/') {
    const rutaCandidata = resolverRutaSegura(spaDistDir, pathname);

    if (rutaCandidata === null) {
      return false;
    }

    const servido = await enviarArchivo(rutaCandidata, pathname.startsWith('/assets/'), reply);

    if (servido) {
      return true;
    }

    if (path.extname(pathname) !== '') {
      return false;
    }
  }

  return enviarArchivo(rutaIndex, false, reply);
}

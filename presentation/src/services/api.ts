import type { ProblemaHttp } from '../types/api';

/** Base URL de la API. En desarrollo el proxy de Vite la enruta al backend Fastify. */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Error devuelto por la API, con el problema RFC 7807 si viene informado. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problema: ProblemaHttp | null,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Convierte un error de red en `ApiError` legible. */
function errorDeRed(mensaje: string): ApiError {
  return new ApiError(0, null, mensaje);
}

/** Ejecuta una petición y devuelve el cuerpo tipado. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        // `Content-Type` solo si hay cuerpo: Fastify responde 400 (FST_ERR_CTP_EMPTY_JSON_BODY)
        // si se declara application/json en una petición sin body (DELETE, POST sin cuerpo).
        ...(init?.body === undefined || init?.body === null || init?.body instanceof FormData
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw errorDeRed(error instanceof Error ? error.message : 'Error de red');
  }

  if (respuesta.status === 204) {
    return undefined as T;
  }

  const esJson = respuesta.headers.get('content-type')?.includes('application/json') ?? false;
  const cuerpo: unknown = esJson ? await respuesta.json() : await respuesta.text();

  if (!respuesta.ok) {
    const problema = (esJson ? cuerpo : null) as ProblemaHttp | null;
    const detalle =
      problema?.detail ??
      problema?.title ??
      (typeof cuerpo === 'string' && cuerpo.length > 0 ? cuerpo : undefined) ??
      `Error ${respuesta.status}`;

    throw new ApiError(respuesta.status, problema, detalle);
  }

  return cuerpo as T;
}

/** Construye un query string omitiendo valores vacíos. */
export function construirQuery(params: Record<string, unknown>): string {
  const query = new URLSearchParams();

  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') {
      continue;
    }

    query.set(clave, String(valor));
  }

  const texto = query.toString();
  return texto.length > 0 ? `?${texto}` : '';
}

/** Cliente HTTP tipado de la API de TELEFONO 2. */
export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  post<T>(path: string, cuerpo?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  },

  put<T>(path: string, cuerpo?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  },

  patch<T>(path: string, cuerpo?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },

  /** Sube un archivo (multipart) a un endpoint de importación. */
  postArchivo<T>(
    path: string,
    archivo: File,
    campo = 'archivo',
    campos: Record<string, string> = {}
  ): Promise<T> {
    const datos = new FormData();
    datos.append(campo, archivo);

    for (const [nombre, valor] of Object.entries(campos)) {
      datos.append(nombre, valor);
    }

    return request<T>(path, { method: 'POST', body: datos });
  },

  /** Descarga un binario (exportaciones) devolviendo nombre y contenido. */
  async descargar(path: string): Promise<{ nombre: string; blob: Blob }> {
    const respuesta = await fetch(`${BASE_URL}${path}`, { headers: { Accept: '*/*' } });

    if (!respuesta.ok) {
      throw new ApiError(respuesta.status, null, `Error ${respuesta.status} al exportar`);
    }

    const disposicion = respuesta.headers.get('content-disposition') ?? '';
    const coincidencia = /filename="?([^";]+)"?/i.exec(disposicion);

    return {
      nombre: coincidencia?.[1] ?? 'descarga',
      blob: await respuesta.blob(),
    };
  },
};

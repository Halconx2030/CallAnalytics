import { ValidationError } from '@domain/errors/DomainError.js';

import type { FastifyRequest } from 'fastify';

/** Entity-tag fuerte con la versión: `"3"`. */
const ETIQUETA_FUERTE = /^"(\d+)"$/;

/** Entity-tag débil con la versión: `W/"3"` (el indicador `W/` no distingue mayúsculas). */
const ETIQUETA_DEBIL = /^W\/"(\d+)"$/i;

/** Versión sin comillas: `3`. */
const ENTERO_SIMPLE = /^(\d+)$/;

/**
 * Lee la versión esperada desde la cabecera `If-Match`.
 *
 * La constitución (regla 10) exige *optimistic locking*: si el cliente envía `If-Match` con la
 * versión que cree tener, el servicio verifica que coincida con la almacenada y responde 409
 * si no es así. Si la cabecera no viene, la operación se ejecuta sin verificación de versión
 * (el sistema no tiene autenticación de usuarios todavía).
 *
 * El parseo es **estricto** (RF-OPT-1.2): el valor debe ser un entero ≥ 1. Se aceptan la
 * etiqueta fuerte (`"3"`), la débil (`W/"3"`) y el entero sin comillas (`3`); cualquier otra
 * cosa (`"3abc"`, `3.5`, `1e3`, `abc`, `0`) se rechaza con `ValidationError` → **400**.
 */
export function versionEsperadaDe(request: FastifyRequest): number | undefined {
  const cabecera = request.headers['if-match'];

  if (cabecera === undefined) {
    return undefined;
  }

  const valor = Array.isArray(cabecera) ? cabecera[0] : cabecera;
  const texto = (valor ?? '').trim();

  const coincidencia =
    ETIQUETA_DEBIL.exec(texto) ?? ETIQUETA_FUERTE.exec(texto) ?? ENTERO_SIMPLE.exec(texto);

  if (coincidencia === null) {
    throw new ValidationError('if-match', 'debe ser un número entero con la versión del recurso');
  }

  const version = Number(coincidencia[1]);

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new ValidationError('if-match', 'debe ser un número entero con la versión del recurso');
  }

  return version;
}

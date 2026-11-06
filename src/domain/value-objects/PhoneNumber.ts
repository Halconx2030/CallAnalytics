import { InvalidPhoneNumberError } from '../errors/DomainError.js';

/** Tipo de línea telefónica chilena. */
export type TipoLinea = 'movil' | 'fijo';

/** Prefijo de los fijos de Santiago: 9 dígitos (2 XXXX XXXX). */
export const PREFIJO_FIJO_SANTIAGO = '2';

/** Prefijos de 2 dígitos de los fijos regionales: 10 dígitos (XX XXXX XXXX). */
export const PREFIJOS_FIJOS_REGIONES: readonly string[] = [
  '32',
  '33',
  '34',
  '35',
  '41',
  '42',
  '43',
  '44',
  '45',
  '51',
  '52',
  '53',
  '55',
  '56',
  '57',
  '58',
  '61',
  '63',
  '64',
  '65',
  '67',
  '71',
  '72',
  '73',
  '75',
];

/** Todos los prefijos fijos válidos (Santiago + regiones). */
export const PREFIJOS_FIJOS_CHILE: readonly string[] = [
  PREFIJO_FIJO_SANTIAGO,
  ...PREFIJOS_FIJOS_REGIONES,
];

/** Resultado de normalizar un número telefónico. */
export interface NumeroNormalizado {
  /** Número en formato E.164 chileno: +569XXXXXXXX o +56XXXXXXXXX. */
  normalized: string;

  /** Tipo inferido a partir del prefijo. */
  tipo: TipoLinea;
}

const PREFIJO_PAIS = '56';
const MAX_DIGITOS_MOVIL = 9;
const MAX_DIGITOS_FIJO_SANTIAGO = 9;
const MAX_DIGITOS_FIJO_REGION = 10;

/** Caracteres permitidos en la parte numérica (el `+` se valida aparte y solo al inicio). */
const REGEX_CARACTERES_PERMITIDOS = /^[\d\s\-().]+$/;
const REGEX_SEPARADORES = /[\s\-().]/g;
const REGEX_CEROS_INICIALES = /^0+/;

/**
 * Normaliza un número telefónico chileno a formato E.164.
 *
 * Reglas (spec 001, §4.3):
 * - Acepta espacios, guiones, paréntesis, puntos, prefijo `+56`, `56` y `0` inicial.
 * - Móvil: 9 dígitos comenzando con `9`  → `+569XXXXXXXX`.
 * - Fijo Santiago: 9 dígitos comenzando con `2` → `+562XXXXXXX`.
 * - Fijo regiones: 10 dígitos con prefijo regional válido → `+56XX XXXXXXX`.
 * - Cualquier otro valor lanza `InvalidPhoneNumberError`.
 *
 * Es idempotente: normalizar un número ya normalizado lo devuelve igual.
 */
export function normalizePhone(raw: string): NumeroNormalizado {
  if (typeof raw !== 'string') {
    throw new InvalidPhoneNumberError(raw);
  }

  const texto = raw.trim();
  if (texto === '') {
    throw new InvalidPhoneNumberError(raw);
  }

  const tienePrefijoPais = texto.startsWith('+');
  const cuerpo = tienePrefijoPais ? texto.slice(1) : texto;

  if (!REGEX_CARACTERES_PERMITIDOS.test(cuerpo)) {
    throw new InvalidPhoneNumberError(raw);
  }

  let digitos = cuerpo.replace(REGEX_SEPARADORES, '');
  if (digitos === '') {
    throw new InvalidPhoneNumberError(raw);
  }

  if (tienePrefijoPais) {
    if (!digitos.startsWith(PREFIJO_PAIS)) {
      throw new InvalidPhoneNumberError(raw);
    }
    digitos = digitos.slice(PREFIJO_PAIS.length);
  } else {
    digitos = quitarCerosIniciales(digitos);

    // Prefijo país sin `+`: solo se quita si el resto calza con un largo chileno válido.
    const esLargoConPrefijoPais =
      (digitos.length === 11 || digitos.length === 12) && digitos.startsWith(PREFIJO_PAIS);

    if (esLargoConPrefijoPais) {
      digitos = digitos.slice(PREFIJO_PAIS.length);
    }
  }

  // Cubre casos como "+560 9 1234 5678" y "056 9 1234 5678".
  digitos = quitarCerosIniciales(digitos);

  if (digitos.length === MAX_DIGITOS_MOVIL && digitos.startsWith('9')) {
    return { normalized: `+${PREFIJO_PAIS}${digitos}`, tipo: 'movil' };
  }

  if (digitos.length === MAX_DIGITOS_FIJO_SANTIAGO && digitos.startsWith(PREFIJO_FIJO_SANTIAGO)) {
    return { normalized: `+${PREFIJO_PAIS}${digitos}`, tipo: 'fijo' };
  }

  if (
    digitos.length === MAX_DIGITOS_FIJO_REGION &&
    PREFIJOS_FIJOS_REGIONES.includes(digitos.slice(0, 2))
  ) {
    return { normalized: `+${PREFIJO_PAIS}${digitos}`, tipo: 'fijo' };
  }

  throw new InvalidPhoneNumberError(raw);
}

function quitarCerosIniciales(digitos: string): string {
  return digitos.replace(REGEX_CEROS_INICIALES, '');
}

import { InvalidCostoError } from '../errors/DomainError.js';

/** Valor máximo admitido por `numeric(10,2)` en PostgreSQL. */
const MAXIMO_DECIMAL_10_2 = 99_999_999.99;

/** Solo se aceptan decimales positivos escritos en notación simple (sin exponente ni hex). */
const REGEX_DECIMAL = /^\d+(\.\d+)?$|^\.\d+$/;

/**
 * Value object inmutable para el costo mensual de una línea.
 *
 * Representa un `decimal(10,2)` de PostgreSQL: entre `0.00` y `99999999.99`, redondeado
 * a dos decimales (half-up) al construirse.
 */
export class CostoMensual {
  static readonly MINIMO = 0;
  static readonly MAXIMO = MAXIMO_DECIMAL_10_2;

  /** Valor numérico ya redondeado a dos decimales. */
  readonly valor: number;

  private constructor(valor: number) {
    this.valor = valor;
    Object.freeze(this);
  }

  /**
   * Crea un costo mensual validado.
   *
   * @throws {InvalidCostoError} si el valor no es finito, es negativo, excede el máximo de
   * `decimal(10,2)` o el string no representa un decimal válido.
   */
  static create(valor: number | string): CostoMensual {
    const numero = CostoMensual.aNumero(valor);

    if (!Number.isFinite(numero) || numero < CostoMensual.MINIMO || numero > MAXIMO_DECIMAL_10_2) {
      throw new InvalidCostoError(valor);
    }

    const redondeado = redondearADosDecimales(numero);
    if (redondeado > MAXIMO_DECIMAL_10_2) {
      throw new InvalidCostoError(valor);
    }

    return new CostoMensual(redondeado);
  }

  /** Costo mensual cero. */
  static cero(): CostoMensual {
    return new CostoMensual(0);
  }

  /** Representación con exactamente dos decimales, apta para `numeric(10,2)`. */
  aString(): string {
    return this.valor.toFixed(2);
  }

  /** Compara por valor. */
  equals(other: CostoMensual): boolean {
    return other instanceof CostoMensual && this.valor === other.valor;
  }

  private static aNumero(valor: number | string): number {
    const desconocido: unknown = valor;

    if (typeof desconocido === 'number') {
      return desconocido;
    }

    if (typeof desconocido === 'string') {
      const texto = desconocido.trim();
      if (!REGEX_DECIMAL.test(texto)) {
        throw new InvalidCostoError(valor);
      }
      return Number(texto);
    }

    throw new InvalidCostoError(valor);
  }
}

/**
 * Redondea a dos decimales evitando el error binario de `valor * 100` (p. ej. 10.005).
 *
 * El truco `Number("10.005e2")` deja que el parser decimal haga el desplazamiento antes de
 * convertir a double, por lo que el `Math.round` posterior es exacto.
 */
function redondearADosDecimales(valor: number): number {
  const texto = String(valor);

  if (!texto.includes('e') && !texto.includes('E')) {
    return Math.round(Number(`${texto}e2`)) / 100;
  }

  return Math.round(valor * 100) / 100;
}

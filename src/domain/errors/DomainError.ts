/**
 * Errores de dominio de TELEFONO 2.
 *
 * Los errores de dominio no conocen HTTP: cada uno expone un `code` estable que la capa de
 * infraestructura mapea a un status (400, 404, 409, ...). Así la lógica de negocio queda
 * independiente del transporte.
 */

/** Error base de la capa de dominio. */
export class DomainError extends Error {
  /** Código estable e independiente del transporte HTTP. */
  readonly code: string;

  /** Información adicional para diagnóstico. */
  readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    // Necesario al extender Error con targets ES2015+ (preserva instanceof en subclases).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Helper interno para describir el valor recibido en los mensajes de error. */
function describirValor(valor: unknown): string {
  return typeof valor === 'string' ? valor : String(valor);
}

/** El valor recibido no es un número telefónico chileno válido. */
export class InvalidPhoneNumberError extends DomainError {
  constructor(valor: unknown) {
    super(
      `Número telefónico inválido: "${describirValor(valor)}". Se espera un móvil chileno ` +
        '(9 XXXX XXXX) o un fijo nacional (2 XXXX XXXX / XX XXXX XXXX), con o sin prefijo +56.',
      'INVALID_PHONE_NUMBER',
      { valor }
    );
  }
}

/** El valor recibido no es un costo mensual válido (decimal(10,2) >= 0). */
export class InvalidCostoError extends DomainError {
  constructor(valor: unknown) {
    super(
      `Costo mensual inválido: "${describirValor(valor)}". Debe ser un decimal entre ` +
        '0.00 y 99999999.99.',
      'INVALID_COSTO',
      { valor }
    );
  }
}

/** Ya existe un registro con el mismo valor en el campo indicado. */
export class DuplicateError extends DomainError {
  readonly field: string;

  constructor(
    field: string,
    message = `Ya existe un registro con el mismo valor para "${field}".`
  ) {
    super(message, 'DUPLICATE', { field });
    this.field = field;
  }
}

/** No se encontró el recurso solicitado. */
export class NotFoundError extends DomainError {
  readonly resource: string;

  constructor(resource: string, id?: string) {
    super(
      id === undefined
        ? `No se encontró ${resource}.`
        : `No se encontró ${resource} con id "${id}".`,
      'NOT_FOUND',
      { resource, id }
    );
    this.resource = resource;
  }
}

/** La referencia a otra entidad no existe (violación de clave foránea). */
export class ForeignKeyError extends DomainError {
  readonly field: string;

  constructor(field: string, message = `El valor de "${field}" no existe o no es válido.`) {
    super(message, 'FOREIGN_KEY', { field });
    this.field = field;
  }
}

/**
 * El estado actual del recurso impide completar la operación (conflicto 409).
 *
 * Se usa, por ejemplo, cuando se intenta eliminar un formato que tiene centros de coste
 * asociados o cuando la versión esperada de un registro no coincide con la almacenada
 * (*optimistic locking*).
 */
export class ConflictError extends DomainError {
  /** Motivo del conflicto, para el detalle de la respuesta. */
  readonly motivo: string;

  constructor(motivo: string) {
    super(motivo, 'CONFLICT', { motivo });
    this.motivo = motivo;
  }
}

/** Un valor de entrada no cumple una regla de validación del dominio. */
export class ValidationError extends DomainError {
  readonly field: string;

  constructor(field: string, motivo: string) {
    super(`Valor inválido para "${field}": ${motivo}.`, 'VALIDATION_ERROR', { field, motivo });
    this.field = field;
  }
}

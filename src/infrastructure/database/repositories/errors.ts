import { DuplicateError, ForeignKeyError, ValidationError } from '@domain/errors/DomainError.js';

/** Error de PostgreSQL con los campos que nos interesan. */
interface ErrorPostgres {
  code?: string;
  constraint_name?: string;
  detail?: string;
  message?: string;
}

/** Traduce el nombre del constraint al campo de dominio DuplicateError. */
const CAMPO_POR_CONSTRAINT: Record<string, string> = {
  formatos_nombre_unique: 'nombre',
  centros_coste_codigo_unique: 'codigo',
  uq_linea_numero_activa: 'numero',
};

/**
 * Traduce los errores de PostgreSQL a errores de dominio, de modo que la capa HTTP no
 * tenga que conocer códigos SQL.
 *
 * - `23505` → duplicado (violación de unicidad).
 * - `23503` → clave foránea inexistente o en uso.
 * - `23514` → viola una restricción `CHECK`.
 */
export function mapearErrorPostgres(error: unknown): unknown {
  if (
    error instanceof DuplicateError ||
    error instanceof ForeignKeyError ||
    error instanceof ValidationError
  ) {
    return error;
  }

  const postgres = error as ErrorPostgres | null;

  switch (postgres?.code) {
    case '23505': {
      const constraint = postgres.constraint_name ?? '';
      const campo = CAMPO_POR_CONSTRAINT[constraint] ?? 'valor';
      return new DuplicateError(campo, `Ya existe un registro con el mismo valor para "${campo}".`);
    }
    case '23503': {
      return new ForeignKeyError(
        'referencia',
        'La operación no se puede completar: la referencia no existe o todavía está en uso.'
      );
    }
    case '23514': {
      return new ValidationError('valor', 'no cumple las restricciones de la base de datos');
    }
    default:
      return error;
  }
}

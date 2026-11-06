import { useId } from 'react';

import type { SelectHTMLAttributes } from 'react';

export interface OpcionSelect {
  readonly valor: string;
  readonly etiqueta: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly etiqueta?: string | undefined;
  readonly error?: string | undefined;
  readonly opciones: ReadonlyArray<OpcionSelect | string>;
  readonly placeholder?: string | undefined;
}

/** Desplegable con etiqueta y opciones. */
export function Select({ etiqueta, error, opciones, placeholder, id, ...resto }: SelectProps) {
  // Id único por instancia: el `name` puede repetirse entre filtros y modales.
  const idUnico = useId();
  const identificador = id ?? idUnico;

  return (
    <div className="campo">
      {etiqueta !== undefined && (
        <label className="campo__etiqueta" htmlFor={identificador}>
          {etiqueta}
        </label>
      )}
      <select {...resto} id={identificador} className="campo__control">
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opciones.map((opcion) => {
          const valor = typeof opcion === 'string' ? opcion : opcion.valor;
          const texto = typeof opcion === 'string' ? opcion : opcion.etiqueta;

          return (
            <option key={valor} value={valor}>
              {texto}
            </option>
          );
        })}
      </select>
      {error !== undefined && <p className="campo__error">{error}</p>}
    </div>
  );
}

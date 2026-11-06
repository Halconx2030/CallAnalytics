import { useId } from 'react';

import type { InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly etiqueta?: string | undefined;
  readonly error?: string | undefined;
}

/** Campo de texto con etiqueta y mensaje de error. */
export function Input({ etiqueta, error, id, ...resto }: InputProps) {
  // El id se genera con useId(): varios formularios pueden usar el mismo `name`
  // (filtros y modal a la vez) y un id duplicado rompe la asociación <label for>.
  const idUnico = useId();
  const identificador = id ?? idUnico;

  return (
    <div className="campo">
      {etiqueta !== undefined && (
        <label className="campo__etiqueta" htmlFor={identificador}>
          {etiqueta}
        </label>
      )}
      <input
        {...resto}
        id={identificador}
        className={`campo__control${error !== undefined ? ' campo__control--error' : ''}`}
      />
      {error !== undefined && <p className="campo__error">{error}</p>}
    </div>
  );
}

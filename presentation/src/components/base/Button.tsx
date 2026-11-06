import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variante?: VarianteBoton;
  readonly cargando?: boolean;
  readonly icono?: ReactNode;
}

/** Botón base de la interfaz. */
export function Button({
  variante = 'primario',
  cargando = false,
  icono,
  children,
  disabled,
  type = 'button',
  ...resto
}: ButtonProps) {
  return (
    <button
      {...resto}
      type={type}
      disabled={disabled ?? cargando}
      className={`boton boton--${variante}${cargando ? ' boton--cargando' : ''}`}
    >
      {cargando ? <span className="boton__spinner" aria-hidden="true" /> : icono}
      <span>{children}</span>
    </button>
  );
}

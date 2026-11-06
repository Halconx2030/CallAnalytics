import type { ReactNode } from 'react';

export interface ModalProps {
  readonly abierto: boolean;
  readonly titulo: string;
  readonly onCerrar: () => void;
  readonly children: ReactNode;
  readonly pie?: ReactNode;
  readonly ancho?: 'pequeno' | 'mediano' | 'grande';
}

/** Modal accesible (Escape para cerrar, overlay y foco simple). */
export function Modal({ abierto, titulo, onCerrar, children, pie, ancho = 'mediano' }: ModalProps) {
  if (!abierto) {
    return null;
  }

  return (
    <div
      className="modal__overlay"
      role="presentation"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div
        className={`modal modal--${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            onCerrar();
          }
        }}
      >
        <header className="modal__cabecera">
          <h2 className="modal__titulo">{titulo}</h2>
          <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal__contenido">{children}</div>
        {pie !== undefined && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

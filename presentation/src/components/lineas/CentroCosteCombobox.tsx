import { useId } from 'react';

import { useCentroCosteCombobox } from './useCentroCosteCombobox';

/** Centro de coste seleccionado en el buscador. */
export interface CentroCosteSeleccion {
  /** Id del centro de coste. */
  readonly id: string;
  /** Etiqueta mostrada (`código · nombre`). */
  readonly texto: string;
}

export interface CentroCosteComboboxProps {
  readonly etiqueta?: string | undefined;
  readonly name?: string | undefined;
  readonly placeholder?: string | undefined;
  readonly error?: string | undefined;
  /** Selección vigente (se muestra aunque no esté entre los resultados actuales). */
  readonly seleccion: CentroCosteSeleccion | null;
  /** Callback con la selección elegida o `null` al limpiarla. */
  readonly onSeleccion: (seleccion: CentroCosteSeleccion | null) => void;
  /**
   * Callback del modo "todos los que coincidan".
   *
   * Se invoca con el texto buscado cuando el usuario elige la opción especial
   * del desplegable. Si no se entrega, el desplegable no ofrece ese modo (por
   * ejemplo, en el formulario de alta/edición, que exige un centro único).
   */
  readonly onSeleccionMultiple?: ((texto: string) => void) | undefined;
}

/**
 * Buscador de centros de coste (combobox con búsqueda por texto).
 *
 * El usuario escribe el **código o el nombre** y el servidor devuelve los centros
 * de coste que contienen ese texto (no solo los primeros 100). Se usa tanto en el
 * filtro de líneas como en el formulario de alta/edición.
 */
export function CentroCosteCombobox({
  etiqueta,
  name,
  placeholder,
  error,
  seleccion,
  onSeleccion,
  onSeleccionMultiple,
}: CentroCosteComboboxProps) {
  const idUnico = useId();
  const idLista = `${idUnico}-lista`;

  const {
    contenedorRef,
    textoInput,
    indiceActivo,
    cargando,
    opciones,
    mostrarLista,
    mensajeEstado,
    tieneSeleccionActiva,
    abrir,
    cambiarTexto,
    elegir,
    elegirMultiple,
    limpiar,
    alTeclear,
  } = useCentroCosteCombobox({ seleccion, onSeleccion, onSeleccionMultiple });

  return (
    <div className="campo">
      {etiqueta !== undefined && (
        <label className="campo__etiqueta" htmlFor={idUnico}>
          {etiqueta}
        </label>
      )}

      <div className="combobox" ref={contenedorRef}>
        <div className="combobox__control">
          <input
            id={idUnico}
            name={name}
            type="text"
            role="combobox"
            className={`campo__control${error !== undefined ? ' campo__control--error' : ''}`}
            placeholder={placeholder}
            value={textoInput}
            autoComplete="off"
            aria-expanded={mostrarLista}
            aria-controls={idLista}
            aria-autocomplete="list"
            onChange={(evento) => {
              cambiarTexto(evento.target.value);
            }}
            onFocus={abrir}
            onKeyDown={alTeclear}
          />

          {tieneSeleccionActiva && (
            <button
              type="button"
              className="combobox__limpiar"
              aria-label="Limpiar centro de coste"
              onClick={limpiar}
            >
              ×
            </button>
          )}
        </div>

        {mostrarLista && (
          <ul className="combobox__lista" id={idLista} role="listbox">
            {cargando && <li className="combobox__estado">Buscando…</li>}

            {opciones.map((opcion, indice) => (
              <li
                key={opcion.tipo === 'multiple' ? 'multiple' : opcion.centro.id}
                role="option"
                aria-selected={indice === indiceActivo}
                className={`combobox__opcion${
                  indice === indiceActivo ? ' combobox__opcion--activa' : ''
                }${opcion.tipo === 'multiple' ? ' combobox__opcion--multiple' : ''}`}
                onMouseDown={(evento) => {
                  // Evita que el input pierda el foco antes del clic.
                  evento.preventDefault();
                }}
                onClick={() => {
                  if (opcion.tipo === 'multiple') {
                    elegirMultiple(opcion.texto);
                  } else {
                    elegir(opcion.centro);
                  }
                }}
              >
                {opcion.tipo === 'multiple'
                  ? `Todos los centros que coincidan con «${opcion.texto}»`
                  : `${opcion.centro.codigo} · ${opcion.centro.nombre}`}
              </li>
            ))}

            {!cargando && mensajeEstado !== null && (
              <li className="combobox__estado">{mensajeEstado}</li>
            )}
          </ul>
        )}
      </div>

      {error !== undefined && <p className="campo__error">{error}</p>}
    </div>
  );
}

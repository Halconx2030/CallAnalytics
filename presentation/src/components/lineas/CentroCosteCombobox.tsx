import { useEffect, useId, useRef, useState } from 'react';

import { MINIMO_BUSQUEDA_CENTROS, useBuscarCentrosCoste } from '../../hooks/useCentrosCoste';

import type { KeyboardEvent } from 'react';
import type { CentroCoste } from '../../types/api';

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

/** Opción del desplegable: la especial "todos los que coincidan" o un centro concreto. */
type OpcionDesplegable =
  | { readonly tipo: 'multiple'; readonly texto: string }
  | { readonly tipo: 'centro'; readonly centro: CentroCoste };

/**
 * Última selección notificada al padre.
 *
 * Permite distinguir los cambios externos (el padre cambia la selección) de los
 * que acaba de hacer el propio componente (que ya actualizó el input).
 */
type Notificacion =
  | { readonly tipo: 'individual'; readonly id: string }
  | { readonly tipo: 'multiple' }
  | { readonly tipo: 'limpia' };

/** Retardo (ms) antes de consultar al servidor. */
const RETARDO_BUSQUEDA_MS = 250;

/**
 * Buscador de centros de coste (combobox con búsqueda por texto).
 *
 * El usuario escribe el **código o el nombre** y el servidor devuelve los centros
 * de coste que contienen ese texto (no solo los primeros 100). Se usa tanto en el
 * filtro de líneas como en el formulario de alta/edición.
 *
 * El desplegable ofrece **dos modos** de uso:
 *
 * 1. Elegir un centro concreto (fija su id).
 * 2. Elegir la opción especial "Todos los centros que coincidan con «texto»", que
 *    filtra por el texto libre (todos los centros cuyo código **o** nombre lo
 *    contengan).
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
  const contenedorRef = useRef<HTMLDivElement>(null);

  const idSeleccion = seleccion?.id;
  const textoSeleccion = seleccion?.texto;

  const [textoInput, setTextoInput] = useState<string>(textoSeleccion ?? '');
  const [busqueda, setBusqueda] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  /** Texto del modo "todos los que coincidan" activo (si lo hay). */
  const [textoMultiple, setTextoMultiple] = useState<string | null>(null);

  const notificacion = useRef<Notificacion>({ tipo: 'limpia' });

  const { datos, cargando } = useBuscarCentrosCoste(textoBusqueda);

  /**
   * Sincroniza el input con la selección vigente.
   *
   * Si el cambio viene del propio componente (que ya actualizó el input), no se
   * toca: así el texto del modo "todos los que coincidan" no se borra cuando el
   * padre descarta la selección por id.
   */
  useEffect(() => {
    const idProp = idSeleccion ?? null;
    const ultima = notificacion.current;

    if (ultima.tipo === 'individual' && idProp === ultima.id) {
      return;
    }

    if (ultima.tipo === 'multiple' && idProp === null) {
      return;
    }

    if (ultima.tipo === 'limpia' && idProp === null) {
      return;
    }

    setTextoInput(textoSeleccion ?? '');
    setTextoMultiple(null);
  }, [idSeleccion, textoSeleccion]);

  // Debounce: solo se consulta al servidor tras una pausa en la escritura.
  useEffect(() => {
    const limpio = busqueda.trim();

    if (limpio.length < MINIMO_BUSQUEDA_CENTROS) {
      setTextoBusqueda('');
      return;
    }

    const temporizador = setTimeout(() => {
      setTextoBusqueda(limpio);
    }, RETARDO_BUSQUEDA_MS);

    return () => {
      clearTimeout(temporizador);
    };
  }, [busqueda]);

  // Cierra el desplegable al hacer clic fuera del control.
  useEffect(() => {
    if (!abierto) {
      return;
    }

    const alHacerClic = (evento: MouseEvent) => {
      const nodo = evento.target;

      if (nodo instanceof Node && contenedorRef.current?.contains(nodo)) {
        return;
      }

      setAbierto(false);
    };

    document.addEventListener('mousedown', alHacerClic);

    return () => {
      document.removeEventListener('mousedown', alHacerClic);
    };
  }, [abierto]);

  /** Texto que se puede aplicar a "todos los centros que coincidan". */
  const textoMultipleActual = busqueda.trim();

  /** ¿El desplegable ofrece el modo "todos los que coincidan"? */
  const puedeMultiple =
    onSeleccionMultiple !== undefined && textoMultipleActual.length >= MINIMO_BUSQUEDA_CENTROS;

  /** Opciones del desplegable: primero la especial, luego las coincidencias. */
  const opciones: OpcionDesplegable[] = [];

  if (puedeMultiple) {
    opciones.push({ tipo: 'multiple', texto: textoMultipleActual });
  }

  for (const centro of datos) {
    opciones.push({ tipo: 'centro', centro });
  }

  const cambiarTexto = (valor: string) => {
    setTextoInput(valor);
    setBusqueda(valor);
    setAbierto(true);
    setIndiceActivo(-1);
    setTextoMultiple(null);

    // El texto ya no corresponde a la selección anterior: se descarta.
    if (idSeleccion !== undefined || textoMultiple !== null) {
      notificacion.current = { tipo: 'limpia' };
      onSeleccion(null);
    }
  };

  const elegir = (centro: CentroCoste) => {
    const texto = `${centro.codigo} · ${centro.nombre}`;

    notificacion.current = { tipo: 'individual', id: centro.id };
    onSeleccion({ id: centro.id, texto });
    setTextoInput(texto);
    setTextoMultiple(null);
    setBusqueda('');
    setTextoBusqueda('');
    setAbierto(false);
    setIndiceActivo(-1);
  };

  /** Elige el modo "todos los centros que coincidan con el texto". */
  const elegirMultiple = (texto: string) => {
    notificacion.current = { tipo: 'multiple' };

    // Primero se descarta la selección por id (son excluyentes).
    if (idSeleccion !== undefined) {
      onSeleccion(null);
    }

    onSeleccionMultiple?.(texto);
    setTextoInput(texto);
    setTextoMultiple(texto);
    setBusqueda('');
    setTextoBusqueda('');
    setAbierto(false);
    setIndiceActivo(-1);
  };

  const limpiar = () => {
    notificacion.current = { tipo: 'limpia' };
    onSeleccion(null);
    setTextoInput('');
    setTextoMultiple(null);
    setBusqueda('');
    setTextoBusqueda('');
    setIndiceActivo(-1);
  };

  const alTeclear = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();

      if (opciones.length === 0) {
        return;
      }

      setAbierto(true);

      const sentido = evento.key === 'ArrowDown' ? 1 : -1;
      setIndiceActivo((actual) => {
        const siguiente = actual + sentido;

        if (siguiente < 0) {
          return opciones.length - 1;
        }

        if (siguiente >= opciones.length) {
          return 0;
        }

        return siguiente;
      });

      return;
    }

    if (evento.key === 'Enter') {
      const activa = indiceActivo >= 0 ? opciones[indiceActivo] : undefined;

      if (abierto && activa !== undefined) {
        evento.preventDefault();

        if (activa.tipo === 'multiple') {
          elegirMultiple(activa.texto);
        } else {
          elegir(activa.centro);
        }
      }

      return;
    }

    if (evento.key === 'Escape') {
      // No se propaga al modal (lo cerraría).
      evento.stopPropagation();
      setAbierto(false);
      setIndiceActivo(-1);
    }
  };

  const haySugerencias = cargando || datos.length > 0 || textoBusqueda.length > 0 || puedeMultiple;
  const mostrarLista = abierto && haySugerencias;

  const mensajeEstado = cargando
    ? 'Buscando…'
    : datos.length === 0 && textoBusqueda.length > 0
      ? 'Sin resultados'
      : datos.length === 0 && !puedeMultiple
        ? `Escribe al menos ${MINIMO_BUSQUEDA_CENTROS} caracteres`
        : null;

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
            onFocus={() => {
              setAbierto(true);
            }}
            onKeyDown={alTeclear}
          />

          {(idSeleccion !== undefined || textoMultiple !== null) && (
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

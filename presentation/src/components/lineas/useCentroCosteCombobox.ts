import { useEffect, useRef, useState } from 'react';

import { MINIMO_BUSQUEDA_CENTROS, useBuscarCentrosCoste } from '../../hooks/useCentrosCoste';

import type { KeyboardEvent, RefObject } from 'react';
import type { CentroCoste } from '../../types/api';
import type { CentroCosteSeleccion } from './CentroCosteCombobox';

/** Opción del desplegable: la especial "todos los que coincidan" o un centro concreto. */
export type OpcionDesplegable =
  | { readonly tipo: 'multiple'; readonly texto: string }
  | { readonly tipo: 'centro'; readonly centro: CentroCoste };

/**
 * Última selección notificada al padre para distinguir cambios externos de internos.
 */
type Notificacion =
  | { readonly tipo: 'individual'; readonly id: string }
  | { readonly tipo: 'multiple' }
  | { readonly tipo: 'limpia' };

/** Retardo (ms) antes de consultar al servidor. */
const RETARDO_BUSQUEDA_MS = 250;

export interface UseCentroCosteComboboxArgs {
  readonly seleccion: CentroCosteSeleccion | null;
  readonly onSeleccion: (seleccion: CentroCosteSeleccion | null) => void;
  readonly onSeleccionMultiple?: ((texto: string) => void) | undefined;
}

export interface UseCentroCosteComboboxResult {
  readonly contenedorRef: RefObject<HTMLDivElement>;
  readonly textoInput: string;
  readonly abierto: boolean;
  readonly indiceActivo: number;
  readonly cargando: boolean;
  readonly opciones: OpcionDesplegable[];
  readonly mostrarLista: boolean;
  readonly mensajeEstado: string | null;
  readonly tieneSeleccionActiva: boolean;
  readonly abrir: () => void;
  readonly cambiarTexto: (valor: string) => void;
  readonly elegir: (centro: CentroCoste) => void;
  readonly elegirMultiple: (texto: string) => void;
  readonly limpiar: () => void;
  readonly alTeclear: (evento: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * Hook que encapsula el estado, debounce de búsqueda, sincronización de selección y
 * navegación por teclado del combobox de centros de coste.
 */
export function useCentroCosteCombobox({
  seleccion,
  onSeleccion,
  onSeleccionMultiple,
}: UseCentroCosteComboboxArgs): UseCentroCosteComboboxResult {
  const contenedorRef = useRef<HTMLDivElement>(null);

  const idSeleccion = seleccion?.id;
  const textoSeleccion = seleccion?.texto;

  const [textoInput, setTextoInput] = useState<string>(textoSeleccion ?? '');
  const [busqueda, setBusqueda] = useState('');
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [textoMultiple, setTextoMultiple] = useState<string | null>(null);

  const notificacion = useRef<Notificacion>({ tipo: 'limpia' });

  const { datos, cargando } = useBuscarCentrosCoste(textoBusqueda);

  useEffect(() => {
    const idProp = idSeleccion ?? null;
    const ultima = notificacion.current;

    if (
      (ultima.tipo === 'individual' && idProp === ultima.id) ||
      (ultima.tipo === 'multiple' && idProp === null) ||
      (ultima.tipo === 'limpia' && idProp === null)
    ) {
      return;
    }

    setTextoInput(textoSeleccion ?? '');
    setTextoMultiple(null);
  }, [idSeleccion, textoSeleccion]);

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

  const textoMultipleActual = busqueda.trim();
  const puedeMultiple =
    onSeleccionMultiple !== undefined && textoMultipleActual.length >= MINIMO_BUSQUEDA_CENTROS;

  const opciones: OpcionDesplegable[] = [
    ...(puedeMultiple ? [{ tipo: 'multiple' as const, texto: textoMultipleActual }] : []),
    ...datos.map((centro) => ({ tipo: 'centro' as const, centro })),
  ];

  const cambiarTexto = (valor: string) => {
    setTextoInput(valor);
    setBusqueda(valor);
    setAbierto(true);
    setIndiceActivo(-1);
    setTextoMultiple(null);

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

  const elegirMultiple = (texto: string) => {
    notificacion.current = { tipo: 'multiple' };

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
        return siguiente >= opciones.length ? 0 : siguiente;
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

  return {
    contenedorRef,
    textoInput,
    abierto,
    indiceActivo,
    cargando,
    opciones,
    mostrarLista,
    mensajeEstado,
    tieneSeleccionActiva: idSeleccion !== undefined || textoMultiple !== null,
    abrir: () => {
      setAbierto(true);
    },
    cambiarTexto,
    elegir,
    elegirMultiple,
    limpiar,
    alTeclear,
  };
}

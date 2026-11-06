import { useState } from 'react';

import { useFormatoMutaciones, useFormatos } from '../../hooks/useFormatos';
import { formatearFecha } from '../../utils/date';
import { Button } from '../base/Button';
import { Pagination } from '../base/Pagination';
import { Table } from '../base/Table';
import { FormatoFormModal } from './FormatoFormModal';

import type { ColumnaTabla } from '../base/Table';
import type { Formato } from '../../types/api';

const LIMITE_PAGINA = 20;

const COLUMNAS: ReadonlyArray<ColumnaTabla<Formato>> = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'created_at',
    titulo: 'Creado',
    render: (formato) => formatearFecha(formato.created_at),
  },
  { clave: 'acciones', titulo: 'Acciones' },
];

/** Panel de CRUD de formatos de centro de coste (RF-FMT-1.1 a RF-FMT-1.4, RF-CAT-1.1 a RF-CAT-1.9). */
export function FormatosPanel() {
  /**
   * Pila de cursores por página visitada. `cursores[0]` es `undefined` (página 1,
   * sin `after_id`). Al avanzar se apila el `next_cursor` de la página actual;
   * al retroceder solo se mueve el índice, reusando el cursor ya guardado.
   * Esto conserva la columna de orden del cursor (`c`) entre páginas (RF-CAT-1.9).
   * Como el backend de formatos ordena siempre por `nombre` y este panel no tiene
   * filtros, no hay reinicio de cursor por cambio de orden/filtro en este componente.
   */
  const [cursores, setCursores] = useState<ReadonlyArray<string | undefined>>([undefined]);
  const [indicePagina, setIndicePagina] = useState(0);
  const cursor = cursores[indicePagina];

  const {
    data: pagina,
    isLoading,
    refetch,
  } = useFormatos({ limite: LIMITE_PAGINA, afterId: cursor });
  const { crear, actualizar, eliminar } = useFormatoMutaciones();
  const formatos = pagina?.items ?? [];

  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Formato | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const abrirNuevo = () => {
    setEnEdicion(null);
    setError(undefined);
    setAbierto(true);
  };

  const abrirEdicion = (formato: Formato) => {
    setEnEdicion(formato);
    setError(undefined);
    setAbierto(true);
  };

  const guardar = async (datos: { nombre: string }) => {
    try {
      if (enEdicion === null) {
        await crear.mutateAsync(datos);
      } else {
        await actualizar.mutateAsync({ id: enEdicion.id, ...datos });
      }

      setAbierto(false);
      setEnEdicion(null);
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el formato');
    }
  };

  const borrar = async (formato: Formato) => {
    const confirmado = window.confirm(
      `¿Eliminar el formato "${formato.nombre}"? Si tiene centros de coste asociados no se podrá.`
    );

    if (!confirmado) {
      return;
    }

    try {
      await eliminar.mutateAsync(formato.id);
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo eliminar el formato');
    }
  };

  const irAAnterior = () => {
    setIndicePagina((actual) => Math.max(0, actual - 1));
  };

  const irASiguiente = () => {
    const siguiente = pagina?.next_cursor ?? null;

    if (siguiente === null || pagina?.has_next_page !== true) {
      return;
    }

    setCursores((previos) => [...previos.slice(0, indicePagina + 1), siguiente]);
    setIndicePagina((actual) => actual + 1);
  };

  const columnas: ReadonlyArray<ColumnaTabla<Formato>> = [
    ...COLUMNAS.slice(0, 2),
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (formato) => (
        <div className="acciones-fila">
          <Button variante="secundario" onClick={() => abrirEdicion(formato)}>
            Editar
          </Button>
          <Button variante="peligro" onClick={() => borrar(formato)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="panel">
      <div className="toolbar">
        <div>
          <h2 className="panel__titulo">Formatos de centro de coste</h2>
          <p className="nota">Cada formato solo tiene nombre (por ejemplo SMU o FALABELLA).</p>
        </div>
        <div className="toolbar__acciones">
          <Button onClick={abrirNuevo}>Nuevo formato</Button>
        </div>
      </div>

      {error !== undefined && <p className="estado estado--error">{error}</p>}

      <Table
        columnas={columnas}
        filas={formatos ?? []}
        claveFila={(formato) => formato.id}
        cargando={isLoading}
        vacio="Aún no hay formatos creados"
      />

      <Pagination
        paginaActual={indicePagina + 1}
        totalPaginas={cursores.length}
        onCambioPagina={irAAnterior}
        onSiguiente={irASiguiente}
        haySiguiente={pagina?.has_next_page === true}
        onRecargar={() => {
          void refetch();
        }}
      />

      <FormatoFormModal
        abierto={abierto}
        formato={enEdicion}
        onCerrar={() => {
          setAbierto(false);
          setEnEdicion(null);
        }}
        onGuardar={guardar}
        cargando={crear.isPending || actualizar.isPending}
        error={error}
      />
    </section>
  );
}

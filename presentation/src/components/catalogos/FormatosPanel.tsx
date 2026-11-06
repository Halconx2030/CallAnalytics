import { useState } from 'react';

import { useFormatoMutaciones, useFormatos } from '../../hooks/useFormatos';
import { formatearFecha } from '../../utils/date';
import { Button } from '../base/Button';
import { Table } from '../base/Table';
import { FormatoFormModal } from './FormatoFormModal';

import type { ColumnaTabla } from '../base/Table';
import type { Formato } from '../../types/api';

const COLUMNAS: ReadonlyArray<ColumnaTabla<Formato>> = [
  { clave: 'nombre', titulo: 'Nombre' },
  {
    clave: 'created_at',
    titulo: 'Creado',
    render: (formato) => formatearFecha(formato.created_at),
  },
  { clave: 'acciones', titulo: 'Acciones' },
];

/** Panel de CRUD de formatos de centro de coste (RF-FMT-1.1 a RF-FMT-1.4). */
export function FormatosPanel() {
  const { data: formatos, isLoading } = useFormatos();
  const { crear, actualizar, eliminar } = useFormatoMutaciones();

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

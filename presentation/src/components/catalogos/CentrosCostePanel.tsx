import { useState } from 'react';

import { useCentroCosteMutaciones, useCentrosCoste } from '../../hooks/useCentrosCoste';
import { useFormatos } from '../../hooks/useFormatos';
import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Select } from '../base/Select';
import { Table } from '../base/Table';
import { CentroCosteFormModal } from './CentroCosteFormModal';

import type { ColumnaTabla } from '../base/Table';
import type { CentroCoste } from '../../types/api';

interface FiltrosCentro {
  readonly codigo: string;
  readonly nombre: string;
  readonly formato_id: string;
}

const FILTROS_VACIOS: FiltrosCentro = { codigo: '', nombre: '', formato_id: '' };

/** Panel de CRUD de centros de coste (RF-CC-1.1 a RF-CC-1.6). */
export function CentrosCostePanel() {
  const { data: formatos } = useFormatos();
  const [filtros, setFiltros] = useState<FiltrosCentro>(FILTROS_VACIOS);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosCentro>(FILTROS_VACIOS);

  const { data: centros, isLoading } = useCentrosCoste({
    codigo: filtrosAplicados.codigo,
    nombre: filtrosAplicados.nombre,
    formato_id: filtrosAplicados.formato_id,
  });
  const { crear, actualizar, eliminar } = useCentroCosteMutaciones();

  const [abierto, setAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<CentroCoste | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  const abrirNuevo = () => {
    setEnEdicion(null);
    setError(undefined);
    setAbierto(true);
  };

  const abrirEdicion = (centro: CentroCoste) => {
    setEnEdicion(centro);
    setError(undefined);
    setAbierto(true);
  };

  const guardar = async (datos: { codigo: string; nombre: string; formato_id: string }) => {
    try {
      if (enEdicion === null) {
        await crear.mutateAsync(datos);
      } else {
        await actualizar.mutateAsync({
          id: enEdicion.id,
          nombre: datos.nombre,
          formato_id: datos.formato_id,
        });
      }

      setAbierto(false);
      setEnEdicion(null);
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar el centro de coste');
    }
  };

  const borrar = async (centro: CentroCoste) => {
    const confirmado = window.confirm(
      `¿Eliminar el centro de coste "${centro.codigo} - ${centro.nombre}"? Si tiene líneas asignadas no se podrá.`
    );

    if (!confirmado) {
      return;
    }

    try {
      await eliminar.mutateAsync(centro.id);
      setError(undefined);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo eliminar el centro de coste');
    }
  };

  const nombreDeFormato = (formatoId: string) =>
    formatos?.find((formato) => formato.id === formatoId)?.nombre ?? '—';

  const columnas: ReadonlyArray<ColumnaTabla<CentroCoste>> = [
    { clave: 'codigo', titulo: 'Código' },
    { clave: 'nombre', titulo: 'Nombre' },
    { clave: 'formato', titulo: 'Formato', render: (centro) => nombreDeFormato(centro.formato_id) },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (centro) => (
        <div className="acciones-fila">
          <Button variante="secundario" onClick={() => abrirEdicion(centro)}>
            Editar
          </Button>
          <Button variante="peligro" onClick={() => borrar(centro)}>
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
          <h2 className="panel__titulo">Centros de coste</h2>
          <p className="nota">Cada centro tiene un código único y pertenece a un formato.</p>
        </div>
        <div className="toolbar__acciones">
          <Button onClick={abrirNuevo}>Nuevo centro de coste</Button>
        </div>
      </div>

      <div className="filtros">
        <div className="filtros__grid">
          <Input
            etiqueta="Código"
            name="filtro_codigo"
            value={filtros.codigo}
            onChange={(evento) => {
              setFiltros((anterior) => ({ ...anterior, codigo: evento.target.value }));
            }}
          />
          <Input
            etiqueta="Nombre"
            name="filtro_nombre"
            value={filtros.nombre}
            onChange={(evento) => {
              setFiltros((anterior) => ({ ...anterior, nombre: evento.target.value }));
            }}
          />
          <Select
            etiqueta="Formato"
            name="filtro_formato"
            value={filtros.formato_id}
            opciones={(formatos ?? []).map((formato) => ({
              valor: formato.id,
              etiqueta: formato.nombre,
            }))}
            placeholder="Todos los formatos"
            onChange={(evento) => {
              setFiltros((anterior) => ({ ...anterior, formato_id: evento.target.value }));
            }}
          />
        </div>
        <div className="filtros__acciones">
          <Button
            variante="secundario"
            onClick={() => {
              setFiltros(FILTROS_VACIOS);
              setFiltrosAplicados(FILTROS_VACIOS);
            }}
          >
            Limpiar
          </Button>
          <Button onClick={() => setFiltrosAplicados(filtros)}>Aplicar filtros</Button>
        </div>
      </div>

      {error !== undefined && <p className="estado estado--error">{error}</p>}

      <Table
        columnas={columnas}
        filas={centros ?? []}
        claveFila={(centro) => centro.id}
        cargando={isLoading}
        vacio="Aún no hay centros de coste creados"
      />

      <CentroCosteFormModal
        abierto={abierto}
        centro={enEdicion}
        formatos={formatos ?? []}
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

import { useEffect, useState } from 'react';

import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Select } from '../base/Select';
import { CentroCosteCombobox } from './CentroCosteCombobox';

import type { CentroCosteSeleccion } from './CentroCosteCombobox';
import type { FiltrosLineas } from '../../types/api';

export interface LineasFiltersProps {
  readonly filtros: FiltrosLineas;
  readonly onAplicar: (filtros: FiltrosLineas) => void;
  readonly onLimpiar: () => void;
}

const FILTROS_VACIOS: FiltrosLineas = {};

/**
 * Panel de filtros del módulo de líneas (RF-LIN-1.9 / RF-UI-LIN-1.2).
 *
 * Expone los 12 filtros del backend (texto, enumeraciones, fechas y rango
 * numérico). Los cambios se mantienen en un borrador local y se aplican a la
 * lista al pulsar "Aplicar filtros", para no disparar una consulta por tecla.
 *
 * El filtro de centro de coste es un buscador (combobox) con búsqueda por texto
 * contra el servidor: con cientos de centros de coste no es viable mostrar un
 * desplegable con el listado completo. Es el **único** control de centro de
 * coste: la búsqueda acepta indistintamente el código o el nombre, por lo que
 * no se mantienen inputs de texto separados por código y por nombre.
 *
 * El buscador tiene **dos modos de uso** (excluyentes entre sí):
 *
 * 1. Elegir un centro concreto → filtra por `centro_coste_id`.
 * 2. Elegir "Todos los centros que coincidan con «texto»" → filtra por
 *    `centro_coste_busqueda` (todas las líneas de los centros cuyo código o
 *    nombre contengan ese texto).
 */
export function LineasFilters({ filtros, onAplicar, onLimpiar }: LineasFiltersProps) {
  const [borrador, setBorrador] = useState<FiltrosLineas>(filtros);
  const [centroFiltro, setCentroFiltro] = useState<CentroCosteSeleccion | null>(null);
  /**
   * Contador que remonta el buscador al limpiar los filtros, para que no
   * conserve el texto escrito ni la selección anterior.
   */
  const [reinicioBuscador, setReinicioBuscador] = useState(0);

  useEffect(() => {
    setBorrador(filtros);

    if (filtros.centro_coste_id === undefined) {
      setCentroFiltro(null);
    }
  }, [filtros]);

  const cambiar = <K extends keyof FiltrosLineas>(clave: K, valor: FiltrosLineas[K]) => {
    setBorrador((actual) => ({ ...actual, [clave]: valor }));
  };

  const limpiar = () => {
    setBorrador(FILTROS_VACIOS);
    setCentroFiltro(null);
    setReinicioBuscador((actual) => actual + 1);
    onLimpiar();
  };

  return (
    <div className="filtros">
      <div className="filtros__grid">
        <Input
          etiqueta="Número"
          name="numero"
          placeholder="+56912345678"
          value={borrador.numero ?? ''}
          onChange={(evento) => {
            cambiar('numero', evento.target.value);
          }}
        />

        <Input
          etiqueta="Proveedor"
          name="proveedor"
          placeholder="Entel, Movistar…"
          value={borrador.proveedor ?? ''}
          onChange={(evento) => {
            cambiar('proveedor', evento.target.value);
          }}
        />

        <CentroCosteCombobox
          key={reinicioBuscador}
          etiqueta="Centro de coste"
          name="centro_coste_id"
          placeholder="Buscar por código o nombre"
          seleccion={centroFiltro}
          onSeleccion={(seleccion) => {
            setCentroFiltro(seleccion);

            if (seleccion === null) {
              // Sin selección: se descartan los dos modos de filtrado.
              cambiar('centro_coste_id', undefined);
              cambiar('centro_coste_busqueda', undefined);
              return;
            }

            // Un centro concreto: excluye el filtro por texto.
            cambiar('centro_coste_id', seleccion.id);
            cambiar('centro_coste_busqueda', undefined);
          }}
          onSeleccionMultiple={(texto) => {
            // "Todos los que coincidan": excluye el filtro por id.
            setCentroFiltro(null);
            cambiar('centro_coste_id', undefined);
            cambiar('centro_coste_busqueda', texto);
          }}
        />

        <Input
          etiqueta="Fecha de asignación"
          type="date"
          name="fecha_asignacion"
          value={borrador.fecha_asignacion ?? ''}
          onChange={(evento) => {
            cambiar('fecha_asignacion', evento.target.value);
          }}
        />

        <Input
          etiqueta="Fecha desde"
          type="date"
          name="fecha_desde"
          value={borrador.fecha_desde ?? ''}
          onChange={(evento) => {
            cambiar('fecha_desde', evento.target.value);
          }}
        />

        <Input
          etiqueta="Fecha hasta"
          type="date"
          name="fecha_hasta"
          value={borrador.fecha_hasta ?? ''}
          onChange={(evento) => {
            cambiar('fecha_hasta', evento.target.value);
          }}
        />

        <Input
          etiqueta="Costo mínimo"
          type="number"
          min="0"
          step="0.01"
          name="costo_min"
          value={borrador.costo_min ?? ''}
          onChange={(evento) => {
            cambiar(
              'costo_min',
              evento.target.value === '' ? undefined : Number(evento.target.value)
            );
          }}
        />

        <Input
          etiqueta="Costo máximo"
          type="number"
          min="0"
          step="0.01"
          name="costo_max"
          value={borrador.costo_max ?? ''}
          onChange={(evento) => {
            cambiar(
              'costo_max',
              evento.target.value === '' ? undefined : Number(evento.target.value)
            );
          }}
        />

        <Select
          etiqueta="Tipo de línea"
          name="tipo_linea"
          placeholder="Todos"
          value={borrador.tipo_linea ?? ''}
          opciones={[
            { valor: 'movil', etiqueta: 'Móvil' },
            { valor: 'fijo', etiqueta: 'Fijo' },
          ]}
          onChange={(evento) => {
            cambiar('tipo_linea', evento.target.value);
          }}
        />

        <Input
          etiqueta="Empleado"
          name="empleado"
          placeholder="Nombre del empleado"
          value={borrador.empleado ?? ''}
          onChange={(evento) => {
            cambiar('empleado', evento.target.value);
          }}
        />

        <Select
          etiqueta="Estado"
          name="estado"
          placeholder="Todos"
          value={borrador.estado ?? ''}
          opciones={[
            { valor: 'activa', etiqueta: 'Activa' },
            { valor: 'pendiente', etiqueta: 'Pendiente' },
            { valor: 'portabilidad', etiqueta: 'Portabilidad' },
            { valor: 'baja', etiqueta: 'Baja' },
          ]}
          onChange={(evento) => {
            cambiar('estado', evento.target.value);
          }}
        />

        <Select
          etiqueta="Tipo de uso"
          name="tipo_uso"
          placeholder="Todos"
          value={borrador.tipo_uso ?? ''}
          opciones={[
            { valor: 'personal', etiqueta: 'Personal' },
            { valor: 'geovictoria', etiqueta: 'Geovictoria' },
          ]}
          onChange={(evento) => {
            cambiar('tipo_uso', evento.target.value);
          }}
        />
      </div>

      <div className="filtros__acciones">
        <Button
          variante="secundario"
          onClick={() => {
            onAplicar(borrador);
          }}
        >
          Aplicar filtros
        </Button>
        <Button variante="secundario" onClick={limpiar}>
          Limpiar
        </Button>
      </div>
    </div>
  );
}

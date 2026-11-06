import { Table } from '../base/Table';

import { LineaActions } from './LineaActions';

import type { ColumnaTabla } from '../base/Table';
import type { ColumnaOrdenLinea, EstadoLinea, Linea } from '../../types/api';

export interface LineasTableProps {
  readonly lineas: ReadonlyArray<Linea>;
  readonly cargando: boolean;
  readonly seleccionadas: ReadonlyArray<string>;
  readonly onAlternarSeleccion: (id: string) => void;
  readonly onAlternarTodas: () => void;
  readonly onEditar: (linea: Linea) => void;
  readonly onCambiarEstado: (linea: Linea, estado: EstadoLinea) => void;
  readonly onDarDeBaja: (linea: Linea) => void;
  /** Columna de orden activa, **en la nomenclatura de la API**. */
  readonly sort?: ColumnaOrdenLinea | undefined;
  readonly order?: 'asc' | 'desc' | undefined;
  /** Se invoca con la columna de la API (no con la clave de la tabla). */
  readonly onOrden?: ((columna: ColumnaOrdenLinea) => void) | undefined;
}

/**
 * Columnas ordenables de la tabla: **clave de la tabla → columna de la API**.
 *
 * `RF-ORD-1.5` obliga a ofrecer orden por cada columna visible menos
 * `empleado` (admite `NULL` y rompería el cursor *keyset*, decisión Q4). El
 * conjunto es un subconjunto del que admite la API (`created_at` también es
 * ordenable en la API, pero no es una columna visible de la tabla).
 *
 * El mapa es necesario porque la columna de la tabla se llama `centro_coste`
 * y muestra `centro_coste_codigo`: enviar `sort=centro_coste` haría que la API
 * respondiera 400.
 */
const ORDENABLES: Readonly<Record<string, ColumnaOrdenLinea>> = {
  numero: 'numero',
  proveedor: 'proveedor',
  centro_coste: 'centro_coste_codigo',
  fecha_asignacion: 'fecha_asignacion',
  costo_mensual: 'costo_mensual',
  tipo_linea: 'tipo_linea',
  estado: 'estado',
  tipo_uso: 'tipo_uso',
};

/**
 * Tabla del módulo de líneas (RF-UI-LIN-1.1).
 *
 * Muestra 20 filas por página, con selección múltiple, ordenamiento por
 * columna y las acciones por línea.
 */
export function LineasTable({
  lineas,
  cargando,
  seleccionadas,
  onAlternarSeleccion,
  onAlternarTodas,
  onEditar,
  onCambiarEstado,
  onDarDeBaja,
  sort,
  order,
  onOrden,
}: LineasTableProps) {
  const todasSeleccionadas =
    lineas.length > 0 && lineas.every((linea) => seleccionadas.includes(linea.id));

  const columnas: ReadonlyArray<ColumnaTabla<Linea>> = [
    {
      clave: 'seleccion',
      titulo: '',
      ancho: '40px',
      render: (linea) => (
        <input
          type="checkbox"
          aria-label={`Seleccionar ${linea.numero}`}
          checked={seleccionadas.includes(linea.id)}
          onChange={() => {
            onAlternarSeleccion(linea.id);
          }}
        />
      ),
    },
    { clave: 'numero', titulo: 'Número', render: (linea) => linea.numero },
    { clave: 'proveedor', titulo: 'Proveedor', render: (linea) => linea.proveedor || '—' },
    {
      clave: 'centro_coste',
      titulo: 'Centro de Coste',
      render: (linea) => linea.centro_coste_codigo ?? linea.centro_coste_nombre ?? '—',
    },
    {
      clave: 'fecha_asignacion',
      titulo: 'Fecha Asignación',
      render: (linea) => linea.fecha_asignacion,
    },
    {
      clave: 'costo_mensual',
      titulo: 'Costo',
      render: (linea) => `$${linea.costo_mensual}`,
    },
    { clave: 'tipo_linea', titulo: 'Tipo', render: (linea) => linea.tipo_linea },
    { clave: 'empleado', titulo: 'Empleado', render: (linea) => linea.empleado ?? '—' },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (linea) => (
        <span className={`estado-badge estado-badge--${linea.estado}`}>{linea.estado}</span>
      ),
    },
    { clave: 'tipo_uso', titulo: 'Uso', render: (linea) => linea.tipo_uso },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      render: (linea) => (
        <LineaActions
          linea={linea}
          onEditar={onEditar}
          onCambiarEstado={onCambiarEstado}
          onDarDeBaja={onDarDeBaja}
        />
      ),
    },
  ];

  return (
    <Table
      columnas={columnas}
      filas={lineas}
      claveFila={(linea) => linea.id}
      cargando={cargando}
      vacio="No hay líneas que coincidan con los filtros"
      renderCabecera={(columna) => {
        if (columna.clave === 'seleccion') {
          return (
            <input
              type="checkbox"
              aria-label="Seleccionar todas las líneas de la página"
              checked={todasSeleccionadas}
              onChange={() => {
                onAlternarTodas();
              }}
            />
          );
        }

        // La columna de la API se obtiene del mapa: puede tener otro nombre
        // (`centro_coste` → `centro_coste_codigo`).
        const columnaApi = ORDENABLES[columna.clave];

        if (onOrden !== undefined && columnaApi !== undefined) {
          // La flecha se marca comparando con la columna de la API, para que el
          // resaltado coincida con el `sort` que viaja en la petición.
          const activa = sort === columnaApi;
          const flecha = activa ? (order === 'asc' ? ' ▲' : ' ▼') : '';

          return (
            <button
              type="button"
              className="tabla__ordenar"
              onClick={() => {
                onOrden(columnaApi);
              }}
            >
              {columna.titulo}
              {flecha}
            </button>
          );
        }

        return columna.titulo;
      }}
    />
  );
}

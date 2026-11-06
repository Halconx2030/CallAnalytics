import { useMemo, useState } from 'react';

import { BulkActions } from '../components/lineas/BulkActions';
import { LineaFormModal } from '../components/lineas/LineaFormModal';
import { LineasFilters } from '../components/lineas/LineasFilters';
import { LineasTable } from '../components/lineas/LineasTable';
import { LineasToolbar } from '../components/lineas/LineasToolbar';
import { Pagination } from '../components/base/Pagination';
import {
  useActualizarLinea,
  useCambiarEstadoLinea,
  useCambiarEstadoMasivo,
  useCrearLinea,
  useLineas,
} from '../hooks/useLineas';
import { api, construirQuery } from '../services/api';
import { descargarBlob } from '../utils/export';

import type {
  ColumnaOrdenLinea,
  DatosLinea,
  EstadoLinea,
  FiltrosLineas,
  Linea,
  ResultadoCambioEstadoMasivo,
} from '../types/api';

const LIMITE_PAGINA = 20;

/**
 * Módulo de líneas (RF-UI-LIN-1.1 a RF-UI-LIN-1.7).
 *
 * Listado paginado por cursor (20 filas por página), filtros por cada
 * concepto, alta y edición con validación en cliente, baja lógica, cambio de
 * estado masivo y exportación con los filtros aplicados.
 */
export function Lineas() {
  /**
   * Filtros aplicados al listado (y a la exportación).
   *
   * El centro de coste se filtra con un único control (el buscador del panel),
   * que tiene dos modos excluyentes: un centro concreto (`centro_coste_id`) o
   * "todos los que coincidan" (`centro_coste_busqueda`). No hay parámetros
   * separados por código y por nombre.
   */
  const [filtros, setFiltros] = useState<FiltrosLineas>({});
  /**
   * Columna de orden activa, en la nomenclatura de la API.
   *
   * `undefined` = sin columna elegida (la API ordena por `created_at`).
   */
  const [sort, setSort] = useState<ColumnaOrdenLinea | undefined>(undefined);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [cursores, setCursores] = useState<ReadonlyArray<string | undefined>>([undefined]);
  const [indicePagina, setIndicePagina] = useState(0);
  const [seleccionadas, setSeleccionadas] = useState<ReadonlyArray<string>>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [lineaEnEdicion, setLineaEnEdicion] = useState<Linea | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [errorBulk, setErrorBulk] = useState<string | null>(null);
  const [resultadoBulk, setResultadoBulk] = useState<ResultadoCambioEstadoMasivo | null>(null);
  const [exportando, setExportando] = useState(false);
  const [incluirBajas, setIncluirBajas] = useState(false);

  const cursor = cursores[indicePagina];

  const consulta = useMemo(
    () => ({
      ...filtros,
      ...(sort === undefined ? {} : { sort }),
      order,
      ...(cursor === undefined ? {} : { after_id: cursor }),
      limit: LIMITE_PAGINA,
    }),
    [filtros, sort, order, cursor]
  );

  const { data, isLoading, isError, error, refetch } = useLineas(consulta);

  const crear = useCrearLinea();
  const actualizar = useActualizarLinea();
  const cambiarEstado = useCambiarEstadoLinea();
  const cambiarEstadoMasivo = useCambiarEstadoMasivo();

  const lineas = data?.items ?? [];

  const reiniciarPaginacion = () => {
    setCursores([undefined]);
    setIndicePagina(0);
  };

  /**
   * Alterna el orden de una columna.
   *
   * `columna` viene ya en la nomenclatura de la API (la tabla traduce su
   * clave). Al cambiar el orden se reinicia la paginación: el cursor viaja con
   * la columna de orden (`c`) y la dirección de la comparación *keyset*, así que
   * un cursor de otro orden sería rechazado por la API con un 400.
   */
  const alternarOrden = (columna: ColumnaOrdenLinea) => {
    if (sort === columna) {
      setOrder((actual) => (actual === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(columna);
      setOrder('asc');
    }

    reiniciarPaginacion();
  };

  const aplicarFiltros = (nuevos: FiltrosLineas) => {
    setFiltros(nuevos);
    reiniciarPaginacion();
    setSeleccionadas([]);
  };

  const limpiarFiltros = () => {
    setFiltros({});
    setSort(undefined);
    setOrder('desc');
    reiniciarPaginacion();
    setSeleccionadas([]);
  };

  const irAAnterior = () => {
    setIndicePagina((actual) => Math.max(0, actual - 1));
  };

  const irASiguiente = () => {
    const siguiente = data?.next_cursor ?? null;

    if (siguiente === null || data?.has_next_page !== true) {
      return;
    }

    setCursores((previos) => [...previos.slice(0, indicePagina + 1), siguiente]);
    setIndicePagina((actual) => actual + 1);
  };

  const alternarSeleccion = (id: string) => {
    setSeleccionadas((previas) =>
      previas.includes(id) ? previas.filter((otro) => otro !== id) : [...previas, id]
    );
  };

  const alternarTodas = () => {
    const ids = lineas.map((linea) => linea.id);
    const todas = ids.every((id) => seleccionadas.includes(id));

    setSeleccionadas(todas ? [] : ids);
  };

  const abrirCreacion = () => {
    setLineaEnEdicion(null);
    setErrorFormulario(null);
    setModalAbierto(true);
  };

  const abrirEdicion = (linea: Linea) => {
    setLineaEnEdicion(linea);
    setErrorFormulario(null);
    setModalAbierto(true);
  };

  const mensajeError = (fallo: unknown): string =>
    fallo instanceof Error ? fallo.message : 'Ocurrió un error inesperado';

  const guardar = async (datos: DatosLinea) => {
    setErrorFormulario(null);

    try {
      if (lineaEnEdicion === null) {
        await crear.mutateAsync(datos);
      } else {
        await actualizar.mutateAsync({ id: lineaEnEdicion.id, ...datos });
      }

      setModalAbierto(false);
      await refetch();
    } catch (fallo) {
      setErrorFormulario(mensajeError(fallo));
    }
  };

  const cambiarEstadoDe = async (linea: Linea, estado: EstadoLinea) => {
    try {
      await cambiarEstado.mutateAsync({ id: linea.id, estado });
      await refetch();
    } catch (fallo) {
      setErrorFormulario(mensajeError(fallo));
    }
  };

  const darDeBaja = async (linea: Linea) => {
    const confirmado = window.confirm(
      `¿Dar de baja la línea ${linea.numero}? La operación es lógica y conserva el histórico.`
    );

    if (!confirmado) {
      return;
    }

    await cambiarEstadoDe(linea, 'baja');
  };

  const aplicarMasivo = async (estado: EstadoLinea) => {
    setErrorBulk(null);
    setResultadoBulk(null);

    try {
      const resultado = await cambiarEstadoMasivo.mutateAsync({
        ids: [...seleccionadas],
        estado,
      });

      setResultadoBulk(resultado);
      setSeleccionadas([]);
      await refetch();
    } catch (fallo) {
      setErrorBulk(mensajeError(fallo));
    }
  };

  const exportar = async (formato: 'csv' | 'xlsx') => {
    setExportando(true);

    try {
      const query = construirQuery({
        ...filtros,
        format: formato,
        incluir_bajas: incluirBajas,
      });

      const { nombre, blob } = await api.descargar(`/lineas/export${query}`);
      descargarBlob(nombre, blob);
    } catch (fallo) {
      setErrorFormulario(mensajeError(fallo));
    } finally {
      setExportando(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="panel__titulo">Líneas telefónicas</h2>

      <LineasToolbar
        onNueva={abrirCreacion}
        onExportar={exportar}
        exportando={exportando}
        onRecargar={() => {
          void refetch();
        }}
        incluirBajas={incluirBajas}
        onCambiarIncluirBajas={setIncluirBajas}
      />

      <LineasFilters filtros={filtros} onAplicar={aplicarFiltros} onLimpiar={limpiarFiltros} />

      <BulkActions
        seleccionadas={seleccionadas}
        resultado={resultadoBulk}
        cargando={cambiarEstadoMasivo.isPending}
        error={errorBulk}
        onAplicar={(estado) => {
          void aplicarMasivo(estado);
        }}
        onLimpiar={() => {
          setSeleccionadas([]);
          setResultadoBulk(null);
        }}
      />

      {isError && (
        <p className="estado estado--error">
          No se pudieron cargar las líneas: {error instanceof Error ? error.message : 'error'}
        </p>
      )}

      {errorFormulario !== null && !modalAbierto && (
        <p className="estado estado--error">{errorFormulario}</p>
      )}

      <LineasTable
        lineas={lineas}
        cargando={isLoading}
        seleccionadas={seleccionadas}
        onAlternarSeleccion={alternarSeleccion}
        onAlternarTodas={alternarTodas}
        onEditar={abrirEdicion}
        onCambiarEstado={(linea, estado) => {
          void cambiarEstadoDe(linea, estado);
        }}
        onDarDeBaja={(linea) => {
          void darDeBaja(linea);
        }}
        sort={sort}
        order={order}
        onOrden={alternarOrden}
      />

      <Pagination
        paginaActual={indicePagina + 1}
        totalPaginas={Math.ceil((data?.totalCount ?? 0) / LIMITE_PAGINA)}
        totalRegistros={data?.totalCount ?? undefined}
        onCambioPagina={irAAnterior}
        onSiguiente={irASiguiente}
        haySiguiente={data?.has_next_page === true}
        onRecargar={() => {
          void refetch();
        }}
      />

      <LineaFormModal
        abierto={modalAbierto}
        linea={lineaEnEdicion}
        guardando={crear.isPending || actualizar.isPending}
        error={errorFormulario}
        onCerrar={() => {
          setModalAbierto(false);
          setErrorFormulario(null);
        }}
        onGuardar={(datos) => {
          void guardar(datos);
        }}
      />
    </section>
  );
}

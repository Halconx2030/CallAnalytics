import { useQuery } from '@tanstack/react-query';

import { api } from '../services/api';

import type { Kpis } from '../types/api';

interface TarjetaKpiProps {
  readonly titulo: string;
  readonly valor: number;
  readonly descripcion: string;
}

function TarjetaKpi({ titulo, valor, descripcion }: TarjetaKpiProps) {
  return (
    <article className="kpi">
      <p className="kpi__titulo">{titulo}</p>
      <p className="kpi__valor">{valor.toLocaleString('es-CL')}</p>
      <p className="kpi__descripcion">{descripcion}</p>
    </article>
  );
}

/** Panel principal con los KPIs de líneas (RF-DASH-1.1, RF-DASH-1.2). */
export function Dashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['kpis'],
    queryFn: () => api.get<Kpis>('/dashboard/kpis'),
  });

  if (isLoading) {
    return <p className="estado">Cargando indicadores…</p>;
  }

  if (isError) {
    return (
      <p className="estado estado--error">
        No se pudieron cargar los indicadores: {error instanceof Error ? error.message : 'error'}
      </p>
    );
  }

  return (
    <section className="panel">
      <div className="kpis">
        <TarjetaKpi
          titulo="Total de líneas"
          valor={data?.total_lineas ?? 0}
          descripcion="Líneas vigentes (sin baja)"
        />
        <TarjetaKpi
          titulo="Líneas activas"
          valor={data?.lineas_activas ?? 0}
          descripcion="Con estado activa"
        />
        <TarjetaKpi
          titulo="Uso personal"
          valor={data?.count_personal ?? 0}
          descripcion="Líneas de tipo personal"
        />
        <TarjetaKpi
          titulo="Uso Geovictoria"
          valor={data?.count_geovictoria ?? 0}
          descripcion="Líneas de tipo geovictoria"
        />
      </div>

      <p className="nota">
        El módulo de líneas, sus filtros y la importación masiva se desarrollan en los pasos
        siguientes (T-08 y T-09).
      </p>
    </section>
  );
}

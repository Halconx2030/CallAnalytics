/**
 * Indicadores del panel principal (RF-DASH-1.1).
 *
 * Los KPIs se calculan siempre sobre la base de datos, sin caché persistente
 * (RF-DASH-1.2).
 */
export interface KpisLineas {
  /** Total de líneas no dadas de baja. */
  readonly totalLineas: number;
  /** Líneas en estado `activa` y no dadas de baja. */
  readonly lineasActivas: number;
  /** Líneas de tipo de uso `personal`. */
  readonly countPersonal: number;
  /** Líneas de tipo de uso `geovictoria`. */
  readonly countGeovictoria: number;
}

/**
 * Puerto de lectura de los indicadores del dashboard.
 */
export interface DashboardRepository {
  /** Calcula los cuatro KPIs del dashboard. */
  obtenerKPIs(): Promise<KpisLineas>;
}

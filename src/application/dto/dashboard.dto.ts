/**
 * KPIs del panel principal (RF-DASH-1.1).
 *
 * La capa HTTP expone estas claves con nombres `snake_case`
 * (`total_lineas`, `lineas_activas`, `count_personal`, `count_geovictoria`); aquí se usan
 * nombres `camelCase` siguiendo la convención de TypeScript.
 */
export interface KpisDto {
  /** Total de líneas no dadas de baja. */
  readonly totalLineas: number;
  /** Líneas en estado `activa` y no dadas de baja. */
  readonly lineasActivas: number;
  /** Líneas de tipo de uso `personal`. */
  readonly countPersonal: number;
  /** Líneas de tipo de uso `geovictoria`. */
  readonly countGeovictoria: number;
}

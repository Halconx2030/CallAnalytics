import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, construirQuery } from '../services/api';

import type {
  DatosLinea,
  EstadoLinea,
  FiltrosLineas,
  Linea,
  Pagina,
  ResultadoCambioEstadoMasivo,
} from '../types/api';

/** Claves de caché de líneas. */
export const lineasKey = ['lineas'] as const;

/**
 * Lista líneas con los 12 filtros, orden y paginación por cursor.
 *
 * El filtro de centro de coste tiene dos modos excluyentes: `centro_coste_id`
 * (un centro concreto) o `centro_coste_busqueda` (todos los que coincidan).
 */
export function useLineas(filtros: FiltrosLineas = {}) {
  return useQuery({
    queryKey: [...lineasKey, filtros],
    queryFn: async () => {
      const pagina = await api.get<Pagina<Linea>>(`/lineas${construirQuery({ ...filtros })}`);
      return pagina;
    },
  });
}

/** Crea una línea. */
export function useCrearLinea() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosLinea) => api.post<Linea>('/lineas', datos),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: lineasKey });
    },
  });
}

/** Actualiza una línea. */
export function useActualizarLinea() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version, ...datos }: { id: string; version?: number } & DatosLinea) =>
      api.put<Linea>(`/lineas/${id}`, datos, version),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: lineasKey });
    },
  });
}

/** Cambia el estado de una línea. */
export function useCambiarEstadoLinea() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado, version }: { id: string; estado: EstadoLinea; version?: number }) =>
      api.patch<Linea>(`/lineas/${id}/estado`, { estado }, version),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: lineasKey });
    },
  });
}

/** Da de baja una línea (baja lógica). */
export function useDarDeBajaLinea() {
  return useCambiarEstadoLinea();
}

/** Cambia el estado de varias líneas (cambio masivo). */
export function useCambiarEstadoMasivo() {
  const cliente = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, estado }: { ids: string[]; estado: EstadoLinea }) =>
      api.post<ResultadoCambioEstadoMasivo>('/lineas/estado/masivo', { ids, estado }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: lineasKey });
    },
  });
}

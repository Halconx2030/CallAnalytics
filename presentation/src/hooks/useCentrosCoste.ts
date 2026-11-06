import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, construirQuery } from '../services/api';

import type { CentroCoste, Pagina } from '../types/api';

/** Claves de caché de centros de coste. */
export const centrosCosteKey = ['centros-coste'] as const;

/** Número mínimo de caracteres para disparar la búsqueda de centros de coste. */
export const MINIMO_BUSQUEDA_CENTROS = 2;

/** Número máximo de sugerencias que devuelve el buscador. */
export const LIMITE_SUGERENCIAS_CENTROS = 20;

/** Lista los centros de coste con los filtros indicados. */
export function useCentrosCoste(filtros: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: [...centrosCosteKey, filtros],
    queryFn: async () => {
      const pagina = await api.get<Pagina<CentroCoste>>(
        `/centros-coste${construirQuery({ limit: 100, ...filtros })}`
      );
      return pagina.items;
    },
  });
}

/** Resultado de la búsqueda de centros de coste por texto libre. */
export interface BusquedaCentrosCoste {
  /** Centros de coste que coinciden con el texto buscado. */
  readonly datos: ReadonlyArray<CentroCoste>;
  /** `true` mientras se está consultando el servidor. */
  readonly cargando: boolean;
  /** Error de la consulta, si lo hubo. */
  readonly error: Error | null;
}

/**
 * Busca centros de coste por código **o** nombre contra el servidor.
 *
 * La búsqueda es *server-side* (`GET /centros-coste?busqueda=...`): con cientos de
 * centros de coste no es viable cargar el listado completo en el cliente.
 */
export function useBuscarCentrosCoste(texto: string): BusquedaCentrosCoste {
  const consulta = useQuery({
    queryKey: [...centrosCosteKey, 'buscar', texto],
    queryFn: async () => {
      const pagina = await api.get<Pagina<CentroCoste>>(
        `/centros-coste${construirQuery({
          busqueda: texto.trim(),
          limit: LIMITE_SUGERENCIAS_CENTROS,
        })}`
      );
      return pagina.items;
    },
    enabled: texto.trim().length >= MINIMO_BUSQUEDA_CENTROS,
    staleTime: 15_000,
  });

  return {
    datos: consulta.data ?? [],
    cargando: consulta.isFetching,
    error: consulta.error ?? null,
  };
}

/** Mutaciones sobre centros de coste. */
export function useCentroCosteMutaciones() {
  const cliente = useQueryClient();

  const invalidar = async () => {
    await cliente.invalidateQueries({ queryKey: centrosCosteKey });
  };

  const crear = useMutation({
    mutationFn: (datos: { codigo: string; nombre: string; formato_id: string }) =>
      api.post<CentroCoste>('/centros-coste', datos),
    onSuccess: invalidar,
  });

  const actualizar = useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; formato_id?: string }) =>
      api.put<CentroCoste>(`/centros-coste/${id}`, datos),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/centros-coste/${id}`),
    onSuccess: invalidar,
  });

  return { crear, actualizar, eliminar };
}

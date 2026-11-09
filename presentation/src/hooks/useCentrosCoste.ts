import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, construirQuery } from '../services/api';

import type { CentroCoste, Pagina } from '../types/api';

/** Claves de caché de centros de coste. */
export const centrosCosteKey = ['centros-coste'] as const;

/** Número mínimo de caracteres para disparar la búsqueda de centros de coste. */
export const MINIMO_BUSQUEDA_CENTROS = 2;

/** Número máximo de sugerencias que devuelve el buscador. */
export const LIMITE_SUGERENCIAS_CENTROS = 20;

/** Opciones de listado paginado de centros de coste. */
export interface UseCentrosCosteOptions {
  /** Filas por página (por defecto 20, tope del backend 100). */
  readonly limite?: number;
  /** Cursor opaco de la página activa (`undefined` en la página 1). */
  readonly afterId?: string | undefined;
}

/**
 * Lista los centros de coste paginados por cursor (RF-CC-1.6, RF-CAT-1.4).
 *
 * Pide `limit=20` (por defecto) al endpoint `GET /centros-coste` con los filtros
 * vigentes (`codigo`, `nombre`, `formato_id`, `busqueda`) y el cursor de la
 * página activa (`after_id`). Devuelve la página completa
 * (`Pagina<CentroCoste>`), no solo los items, para que la UI pueda leer
 * `next_cursor` y `has_next_page` (RF-CAT-1.3, RF-CAT-1.8).
 *
 * La clave de consulta incluye los filtros, el límite y el cursor, de modo que
 * cambiar un filtro genera una consulta nueva. El reinicio a la primera página
 * (`after_id = undefined` al pulsar «Aplicar filtros» o «Limpiar», RF-CAT-1.5)
 * lo resuelve el llamante pasando `afterId: undefined`; este hook nunca envía
 * `after_id` cuando éste es `undefined`.
 *
 * `useBuscarCentrosCoste` se mantiene sin paginación (`limit=20`, sin cursor).
 */
export function useCentrosCoste(
  filtros: Record<string, unknown> = {},
  { limite = 20, afterId }: UseCentrosCosteOptions = {}
) {
  return useQuery({
    queryKey: [...centrosCosteKey, { limite, ...filtros, afterId }],
    queryFn: async () => {
      const pagina = await api.get<Pagina<CentroCoste>>(
        `/centros-coste${construirQuery({ ...filtros, limit: limite, after_id: afterId })}`
      );
      return pagina;
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
 *
 * Se mantiene **sin paginar** (`limit=20`, sin `after_id`): no usa el cursor de
 * `useCentrosCoste`.
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
    mutationFn: ({
      id,
      version,
      ...datos
    }: {
      id: string;
      version?: number;
      nombre?: string;
      formato_id?: string;
    }) => api.put<CentroCoste>(`/centros-coste/${id}`, datos, version),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: ({ id, version }: { id: string; version?: number }) =>
      api.delete<unknown>(`/centros-coste/${id}`, version),
    onSuccess: invalidar,
  });

  return { crear, actualizar, eliminar };
}

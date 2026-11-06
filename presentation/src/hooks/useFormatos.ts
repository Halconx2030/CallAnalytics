import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, construirQuery } from '../services/api';

import type { Formato, Pagina } from '../types/api';

/** Claves de caché de React Query para formatos. */
export const formatosKey = ['formatos'] as const;

/** Clave de caché del catálogo completo de formatos (selects, sin paginar). */
export const formatosCatalogoKey = ['formatos-catalogo'] as const;

export interface UseFormatosOptions {
  /** Filas por página (por defecto 20, tope del backend 100). */
  readonly limite?: number;
  /** Columna de orden. El backend de formatos ordena siempre por `nombre`. */
  readonly orden?: 'nombre';
  /** Dirección del ordenamiento. */
  readonly direccion?: 'asc' | 'desc';
  /** Cursor opaco de la página activa (`undefined` en la página 1). */
  readonly afterId?: string | undefined;
}

/**
 * Lista formatos paginados por cursor.
 *
 * El backend (`RF-FMT-1.3`, `RF-ORD-1.4`) ordena siempre por `nombre ASC, id ASC`
 * y emite un cursor sobre `nombre` (`{ v, id, c }`) que el frontend reenvía
 * opaco en `after_id`. `orden` y `direccion` forman parte de la clave de
 * consulta: al cambiarlos se obtiene una página 1 nueva (sin `after_id`),
 * es decir, la paginación se reinicia.
 */
export function useFormatos({
  limite = 20,
  orden = 'nombre',
  direccion = 'asc',
  afterId,
}: UseFormatosOptions = {}) {
  return useQuery({
    queryKey: [...formatosKey, { limite, orden, direccion, afterId }],
    queryFn: async () => {
      const pagina = await api.get<Pagina<Formato>>(
        `/formatos${construirQuery({ limit: limite, after_id: afterId })}`
      );
      return pagina;
    },
  });
}

/**
 * Catálogo completo de formatos para los `select` de la UI
 * (formulario de centro de coste, filtro de centros de coste y filtro de líneas).
 *
 * Sigue pidiendo `limit=100` sin `after_id`: el catálogo es independiente de la
 * página visible de la tabla de formatos (`RF-CAT-1.7`).
 */
export function useFormatosCatalogo() {
  return useQuery({
    queryKey: formatosCatalogoKey,
    queryFn: async () => {
      const pagina = await api.get<Pagina<Formato>>(`/formatos${construirQuery({ limit: 100 })}`);
      return pagina.items;
    },
  });
}

/** Mutaciones sobre formatos. */
export function useFormatoMutaciones() {
  const cliente = useQueryClient();

  const invalidar = async () => {
    await cliente.invalidateQueries({ queryKey: formatosKey });
    await cliente.invalidateQueries({ queryKey: formatosCatalogoKey });
  };

  const crear = useMutation({
    mutationFn: (datos: { nombre: string }) => api.post<Formato>('/formatos', datos),
    onSuccess: invalidar,
  });

  const actualizar = useMutation({
    mutationFn: ({ id, nombre }: { id: string; nombre: string }) =>
      api.put<Formato>(`/formatos/${id}`, { nombre }),
    onSuccess: invalidar,
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/formatos/${id}`),
    onSuccess: invalidar,
  });

  return { crear, actualizar, eliminar };
}

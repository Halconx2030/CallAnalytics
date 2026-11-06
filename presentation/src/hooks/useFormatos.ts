import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, construirQuery } from '../services/api';

import type { Formato, Pagina } from '../types/api';

/** Claves de caché de React Query. */
export const formatosKey = ['formatos'] as const;

/**
 * Lista los formatos de centro de coste.
 *
 * El backend pagina por cursor; se piden hasta 200 para que los selects de la UI
 * tengan el catálogo completo sin paginar.
 */
export function useFormatos() {
  return useQuery({
    queryKey: formatosKey,
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

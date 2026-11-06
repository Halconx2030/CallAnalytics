import { useMutation } from '@tanstack/react-query';

import { api } from '../services/api';

import type { ReporteImportacionCentros, ReporteImportacionLineas } from '../types/api';

/** Datos de la importación de centros de coste. */
export interface DatosImportacionCentros {
  /** Archivo CSV/XLSX con los centros de coste. */
  readonly archivo: File;
  /** Crea los formatos que no existan en la base de datos (opción opt-in). */
  readonly crearFormatosFaltantes: boolean;
}

/** Importa centros de coste desde un archivo CSV/XLSX. */
export function useImportarCentrosCoste() {
  return useMutation({
    mutationFn: ({ archivo, crearFormatosFaltantes }: DatosImportacionCentros) =>
      api.postArchivo<ReporteImportacionCentros>('/import/centros-coste', archivo, 'archivo', {
        crear_formatos_faltantes: crearFormatosFaltantes ? 'true' : 'false',
      }),
  });
}

/** Importa líneas desde un archivo CSV/XLSX. */
export function useImportarLineas() {
  return useMutation({
    mutationFn: (archivo: File) =>
      api.postArchivo<ReporteImportacionLineas>('/import/lineas', archivo),
  });
}

/** Descarga la plantilla CSV del tipo indicado (`centros-coste` | `lineas`). */
export function useDescargarPlantilla() {
  return useMutation({
    mutationFn: (tipo: 'centros-coste' | 'lineas') =>
      api.descargar(`/import/templates?tipo=${tipo}`),
  });
}

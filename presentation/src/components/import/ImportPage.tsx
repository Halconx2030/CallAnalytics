import { useState } from 'react';

import { Button } from '../base/Button';
import { FileDropZone } from './FileDropZone';
import { ImportProgress } from './ImportProgress';
import { ImportReport } from './ImportReport';

import {
  useDescargarPlantilla,
  useImportarCentrosCoste,
  useImportarLineas,
} from '../../hooks/useImport';
import { descargarBlob } from '../../utils/export';

import type { ApiError } from '../../services/api';
import type { ReporteImportacionCentros, ReporteImportacionLineas } from '../../types/api';

export interface ImportPageProps {
  readonly tipo: 'centros' | 'lineas';
}

function mensajeDeError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ApiError).message);
  }

  return 'Ocurrió un error inesperado al procesar el archivo.';
}

/**
 * Sección de importación de un tipo de archivo (centros de coste o líneas).
 *
 * Muestra el dropzone, el botón de importar, el progreso y el reporte con tres pestañas.
 */
export function ImportPage({ tipo }: ImportPageProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [reporte, setReporte] = useState<
    ReporteImportacionCentros | ReporteImportacionLineas | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  // Solo aplica a la importación de centros de coste: crea los formatos que no existan.
  const [crearFormatosFaltantes, setCrearFormatosFaltantes] = useState(true);

  const importarCentros = useImportarCentrosCoste();
  const importarLineas = useImportarLineas();
  const descargarPlantilla = useDescargarPlantilla();

  const mutacion = tipo === 'centros' ? importarCentros : importarLineas;
  const procesando = mutacion.isPending;
  const cargandoPlantilla = descargarPlantilla.isPending;

  const titulo = tipo === 'centros' ? 'Centros de coste' : 'Líneas';

  async function manejarImportacion() {
    if (!archivo) {
      setError('Selecciona un archivo CSV o Excel antes de importar.');

      return;
    }

    setError(null);
    setReporte(null);

    try {
      const resultado =
        tipo === 'centros'
          ? await importarCentros.mutateAsync({ archivo, crearFormatosFaltantes })
          : await importarLineas.mutateAsync(archivo);

      setReporte(resultado);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function manejarPlantilla() {
    try {
      const { nombre, blob } = await descargarPlantilla.mutateAsync(
        tipo === 'centros' ? 'centros-coste' : 'lineas'
      );

      descargarBlob(nombre, blob);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  return (
    <section className="panel">
      <div className="panel__cabecera">
        <div>
          <h2 className="panel__titulo">Importar {titulo}</h2>
          <p className="panel__descripcion">
            {tipo === 'centros'
              ? 'Archivo con las columnas codigo, nombre y formato_nombre. Los formatos que no existan se pueden crear automáticamente al importar.'
              : 'Archivo con la columna numero y, opcionalmente, las demás. Solo se insertan líneas nuevas.'}
          </p>
        </div>
        <Button
          variante="secundario"
          onClick={() => void manejarPlantilla()}
          cargando={cargandoPlantilla}
        >
          Descargar plantilla
        </Button>
      </div>

      <FileDropZone
        archivo={archivo}
        onArchivo={(seleccionado) => {
          setArchivo(seleccionado);
          setReporte(null);
          setError(null);
        }}
        error={error ?? undefined}
      />

      {tipo === 'centros' ? (
        <label className="opcion">
          <input
            type="checkbox"
            name="crear_formatos_faltantes"
            checked={crearFormatosFaltantes}
            onChange={(evento) => setCrearFormatosFaltantes(evento.target.checked)}
          />
          <span>Crear automáticamente los formatos que no existan</span>
        </label>
      ) : null}

      <div className="panel__acciones">
        <Button onClick={() => void manejarImportacion()} cargando={procesando} disabled={!archivo}>
          Importar {titulo.toLowerCase()}
        </Button>
      </div>

      {procesando && archivo ? (
        <ImportProgress nombreArchivo={archivo.name} tamanoBytes={archivo.size} />
      ) : null}

      {reporte ? <ImportReport tipo={tipo} reporte={reporte} /> : null}
    </section>
  );
}

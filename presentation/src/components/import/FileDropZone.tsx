import { useState } from 'react';

import { FileDropZone as FileDropZoneBase } from '../base/FileDropZone';

export interface FileDropZoneProps {
  readonly archivo?: File | null;
  readonly onArchivo: (archivo: File) => void;
  readonly disabled?: boolean;
  readonly texto?: string;
  readonly error?: string | undefined;
}

const EXTENSIONES_PERMITIDAS = ['.csv', '.xlsx', '.xls'];

/**
 * Zona de arrastre y soltar que valida la extensión del archivo (CSV o Excel).
 *
 * Envuelve la componente base `FileDropZone` para rechazar archivos con extensión
 * no soportada antes de subirlos al servidor (RF-UI-IMP-1.2).
 */
export function FileDropZone({
  archivo = null,
  onArchivo,
  disabled = false,
  texto = 'Arrastra el archivo aquí o haz clic para seleccionarlo',
  error: errorExterno,
}: FileDropZoneProps) {
  const [error, setError] = useState<string | undefined>(undefined);

  const entregar = (seleccionado: File) => {
    const nombre = seleccionado.name.toLowerCase();
    const valida = EXTENSIONES_PERMITIDAS.some((extension) => nombre.endsWith(extension));

    if (!valida) {
      setError('El archivo debe ser CSV (.csv) o Excel (.xlsx, .xls)');

      return;
    }

    setError(undefined);
    onArchivo(seleccionado);
  };

  const textoMostrado = archivo !== null ? `Archivo seleccionado: ${archivo.name}` : texto;

  return (
    <FileDropZoneBase
      accept=".csv,.xlsx,.xls"
      disabled={disabled}
      texto={textoMostrado}
      error={error ?? errorExterno}
      onArchivo={entregar}
    />
  );
}

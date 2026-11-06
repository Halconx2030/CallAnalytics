export interface ImportProgressProps {
  readonly nombreArchivo: string;
  readonly tamanoBytes: number;
}

/**
 * Indicador de progreso de la importación.
 *
 * La API procesa el archivo de forma síncrona y devuelve el reporte completo, por lo que
 * no se puede mostrar "fila X de Y" en vivo: se informa el archivo en curso y su tamaño.
 */
export function ImportProgress({ nombreArchivo, tamanoBytes }: ImportProgressProps) {
  const kilobytes = Math.max(1, Math.round(tamanoBytes / 1024));

  return (
    <div className="progreso" role="status" aria-live="polite">
      <span className="boton__spinner" aria-hidden="true" />
      <div>
        <p className="progreso__titulo">Procesando {nombreArchivo}</p>
        <p className="progreso__detalle">
          {kilobytes} KB · la importación es transaccional: si una fila falla, no se inserta ninguna
        </p>
      </div>
    </div>
  );
}

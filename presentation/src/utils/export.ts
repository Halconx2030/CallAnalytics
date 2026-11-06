/** Utilidades de descarga de archivos generados por el backend. */

/** Dispara la descarga de un blob con el nombre indicado. */
export function descargarBlob(nombre: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(url);
}

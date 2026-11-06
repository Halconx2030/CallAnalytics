/** Utilidades de fecha para la interfaz. */

/** Fecha de hoy en formato `YYYY-MM-DD` (hora local). */
export function hoyIso(): string {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');

  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

/** Formatea una fecha ISO a formato `dd-mm-aaaa`. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) {
    return '—';
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return valor;
  }

  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');

  return `${dia}-${mes}-${fecha.getFullYear()}`;
}

/** Formatea un costo mensual como moneda chilena sin símbolo. */
export function formatearCosto(valor: string | number | null | undefined): string {
  const numero = typeof valor === 'number' ? valor : Number.parseFloat(valor ?? '');

  if (!Number.isFinite(numero)) {
    return '—';
  }

  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
}

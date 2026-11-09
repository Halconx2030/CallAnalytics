export interface PaginationProps {
  readonly paginaActual: number;
  readonly totalPaginas: number;
  readonly totalRegistros?: number | undefined;
  readonly onCambioPagina: (pagina: number) => void;
  readonly onSiguiente?: () => void;
  readonly haySiguiente?: boolean;
  readonly onRecargar?: () => void;
}

/**
 * Paginación del listado.
 *
 * El backend pagina por cursor (`after_id`), por lo que se muestran páginas
 * numeradas para los registros ya cargados y un botón "Cargar más" que avanza
 * con el cursor.
 */
export function Pagination({
  paginaActual,
  totalPaginas,
  totalRegistros,
  onCambioPagina,
  onSiguiente,
  haySiguiente,
  onRecargar,
}: PaginationProps) {
  return (
    <div className="paginacion">
      <span className="paginacion__info">
        {totalRegistros === 0
          ? '0 registros'
          : totalRegistros !== undefined
            ? `${totalRegistros} registro(s) · Página ${paginaActual} de ${totalPaginas}`
            : `Página ${paginaActual} de ${totalPaginas}`}
      </span>

      <div className="paginacion__controles">
        <button
          type="button"
          className="paginacion__boton"
          disabled={paginaActual <= 1}
          onClick={() => {
            onCambioPagina(paginaActual - 1);
          }}
        >
          ‹ Anterior
        </button>

        <button
          type="button"
          className="paginacion__boton"
          disabled={haySiguiente !== true}
          onClick={() => {
            onSiguiente?.();
          }}
        >
          Siguiente ›
        </button>

        {onRecargar !== undefined && (
          <button type="button" className="paginacion__boton" onClick={onRecargar}>
            Recargar
          </button>
        )}
      </div>
    </div>
  );
}

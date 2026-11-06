import type { ReactNode } from 'react';

export interface ColumnaTabla<T> {
  readonly clave: string;
  readonly titulo: string;
  readonly render?: (fila: T) => ReactNode;
  readonly ancho?: string;
}

export interface TableProps<T> {
  readonly columnas: ReadonlyArray<ColumnaTabla<T>>;
  readonly filas: ReadonlyArray<T>;
  readonly claveFila: (fila: T) => string;
  readonly vacio?: string;
  readonly cargando?: boolean;
  readonly onClicFila?: (fila: T) => void;
  readonly renderCabecera?: (columna: ColumnaTabla<T>) => ReactNode;
}

/** Tabla genérica de solo lectura. */
export function Table<T>({
  columnas,
  filas,
  claveFila,
  vacio = 'Sin registros',
  cargando = false,
  onClicFila,
  renderCabecera,
}: TableProps<T>) {
  return (
    <div className="tabla__contenedor">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                style={columna.ancho !== undefined ? { width: columna.ancho } : undefined}
              >
                {renderCabecera !== undefined ? renderCabecera(columna) : columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cargando && (
            <tr>
              <td colSpan={columnas.length} className="tabla__vacia">
                Cargando…
              </td>
            </tr>
          )}
          {!cargando && filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="tabla__vacia">
                {vacio}
              </td>
            </tr>
          )}
          {!cargando &&
            filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                className={onClicFila !== undefined ? 'tabla__fila--clickable' : undefined}
                onClick={
                  onClicFila !== undefined
                    ? () => {
                        onClicFila(fila);
                      }
                    : undefined
                }
              >
                {columnas.map((columna) => (
                  <td key={columna.clave}>
                    {columna.render !== undefined
                      ? columna.render(fila)
                      : String(fila[columna.clave as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

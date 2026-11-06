import { useState } from 'react';

import type {
  DuplicadoImportacionLinea,
  ErrorImportacionCentro,
  ErrorImportacionLinea,
  ReporteImportacionCentros,
  ReporteImportacionLineas,
} from '../../types/api';

type Pestana = 'insertados' | 'duplicados' | 'errores';

interface Props {
  readonly tipo: 'centros' | 'lineas';
  readonly reporte: ReporteImportacionCentros | ReporteImportacionLineas;
}

function esReporteLineas(
  reporte: ReporteImportacionCentros | ReporteImportacionLineas
): reporte is ReporteImportacionLineas {
  return Array.isArray(reporte.duplicados);
}

/** Fila de duplicado (solo líneas). */
function FilaDuplicado({ duplicado }: { readonly duplicado: DuplicadoImportacionLinea }) {
  return (
    <tr>
      <td>{duplicado.fila}</td>
      <td className="tabla__mono">{duplicado.numero}</td>
      <td>{duplicado.motivo}</td>
    </tr>
  );
}

/** Fila de error. */
function FilaError({
  error,
  conNumero,
}: {
  readonly error: ErrorImportacionCentro | ErrorImportacionLinea;
  readonly conNumero: boolean;
}) {
  const linea = error as ErrorImportacionLinea;
  const centro = error as ErrorImportacionCentro;

  return (
    <tr>
      <td>{error.fila}</td>
      {conNumero ? <td className="tabla__mono">{linea.numero}</td> : <td>{centro.codigo}</td>}
      <td>{error.motivo}</td>
    </tr>
  );
}

/**
 * Reporte de una importación, con pestañas de insertados, duplicados y errores.
 *
 * El reporte de centros de coste informa los duplicados como un número y el detalle
 * en `errores`; el de líneas los informa como lista.
 */
export function ImportReport({ tipo, reporte }: Props) {
  const [pestana, setPestana] = useState<Pestana>('insertados');
  const esLineas = esReporteLineas(reporte);
  const duplicados = esLineas ? reporte.duplicados : [];
  const cantidadDuplicados = esLineas ? reporte.duplicados.length : reporte.duplicados;
  const formatosCreados = esLineas ? [] : (reporte.formatos_creados ?? []);

  const pestanas: { id: Pestana; etiqueta: string; cantidad: number }[] = [
    { id: 'insertados', etiqueta: 'Insertados', cantidad: reporte.insertados },
    { id: 'duplicados', etiqueta: 'Duplicados', cantidad: cantidadDuplicados },
    { id: 'errores', etiqueta: 'Errores', cantidad: reporte.errores.length },
  ];

  return (
    <div className="reporte">
      <div className="reporte__resumen">
        <span className="reporte__dato">
          <strong>{reporte.insertados}</strong> insertados
        </span>
        <span className="reporte__dato">
          <strong>{cantidadDuplicados}</strong> duplicados
        </span>
        <span className="reporte__dato">
          <strong>{reporte.errores.length}</strong> errores
        </span>
        {formatosCreados.length > 0 ? (
          <span className="reporte__dato reporte__dato--destacado">
            Formatos creados: <strong>{formatosCreados.join(', ')}</strong>
          </span>
        ) : null}
      </div>

      <div className="tabs" role="tablist">
        {pestanas.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={pestana === item.id}
            className={`tabs__tab${pestana === item.id ? ' tabs__tab--activa' : ''}`}
            onClick={() => setPestana(item.id)}
          >
            {item.etiqueta} ({item.cantidad})
          </button>
        ))}
      </div>

      {pestana === 'insertados' ? (
        <p className="reporte__vacio">
          {reporte.insertados === 0
            ? 'No se insertaron registros en esta importación.'
            : `Se insertaron ${reporte.insertados} ${
                tipo === 'centros' ? 'centros de coste' : 'líneas'
              }.`}
        </p>
      ) : null}

      {pestana === 'duplicados' ? (
        duplicados.length === 0 ? (
          <p className="reporte__vacio">
            {tipo === 'centros'
              ? `Se detectaron ${cantidadDuplicados} códigos duplicados (detalle en la pestaña Errores).`
              : 'No se detectaron duplicados.'}
          </p>
        ) : (
          <div className="tabla__contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Número</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {duplicados.map((duplicado) => (
                  <FilaDuplicado
                    key={`${duplicado.fila}-${duplicado.numero}`}
                    duplicado={duplicado}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {pestana === 'errores' ? (
        reporte.errores.length === 0 ? (
          <p className="reporte__vacio">No se detectaron errores.</p>
        ) : (
          <div className="tabla__contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fila</th>
                  {esLineas ? <th>Número</th> : <th>Código</th>}
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {reporte.errores.map((error) => (
                  <FilaError
                    key={`${error.fila}-${error.motivo}`}
                    error={error}
                    conNumero={esLineas}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </div>
  );
}

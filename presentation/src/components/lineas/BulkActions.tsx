import { useState } from 'react';

import { Button } from '../base/Button';
import { Select } from '../base/Select';

import type { EstadoLinea, ResultadoCambioEstadoMasivo } from '../../types/api';

export interface BulkActionsProps {
  readonly seleccionadas: ReadonlyArray<string>;
  readonly resultado: ResultadoCambioEstadoMasivo | null;
  readonly cargando: boolean;
  readonly error: string | null;
  readonly onAplicar: (estado: EstadoLinea) => void;
  readonly onLimpiar: () => void;
}

/**
 * Acciones masivas sobre las líneas seleccionadas (RF-LIN-1.7 / RF-UI-LIN-1.6).
 *
 * Muestra el resultado del cambio masivo: actualizadas, ignoradas y fallidas.
 */
export function BulkActions({
  seleccionadas,
  resultado,
  cargando,
  error,
  onAplicar,
  onLimpiar,
}: BulkActionsProps) {
  const [estado, setEstado] = useState<EstadoLinea>('activa');

  // La barra solo se oculta si no hay nada que mostrar: tras aplicar un cambio
  // masivo la selección se vacía, pero el reporte debe seguir visible.
  if (seleccionadas.length === 0 && resultado === null && error === null) {
    return null;
  }

  return (
    <div className="bulk">
      {seleccionadas.length > 0 && (
        <>
          <span className="bulk__info">{seleccionadas.length} línea(s) seleccionada(s)</span>

          <Select
            etiqueta=""
            name="estado_masivo"
            value={estado}
            opciones={[
              { valor: 'activa', etiqueta: 'Activa' },
              { valor: 'pendiente', etiqueta: 'Pendiente' },
              { valor: 'portabilidad', etiqueta: 'Portabilidad' },
              { valor: 'baja', etiqueta: 'Baja' },
            ]}
            onChange={(evento) => {
              setEstado(evento.target.value as EstadoLinea);
            }}
          />

          <Button
            cargando={cargando}
            onClick={() => {
              onAplicar(estado);
            }}
          >
            Aplicar a seleccionadas
          </Button>

          <Button variante="secundario" onClick={onLimpiar}>
            Quitar selección
          </Button>
        </>
      )}

      {resultado !== null && (
        <span className="bulk__resultado">
          Actualizadas: {resultado.actualizadas} · Ignoradas: {resultado.ignoradas} · Fallidas:{' '}
          {resultado.fallidas}
        </span>
      )}

      {error !== null && <span className="estado estado--error">{error}</span>}
    </div>
  );
}

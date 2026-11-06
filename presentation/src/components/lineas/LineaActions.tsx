import { Button } from '../base/Button';

import type { EstadoLinea, Linea } from '../../types/api';

export interface LineaActionsProps {
  readonly linea: Linea;
  readonly onEditar: (linea: Linea) => void;
  readonly onCambiarEstado: (linea: Linea, estado: EstadoLinea) => void;
  readonly onDarDeBaja: (linea: Linea) => void;
  readonly deshabilitado?: boolean;
}

const ESTADOS: ReadonlyArray<{ valor: EstadoLinea; etiqueta: string }> = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'activa', etiqueta: 'Activa' },
  { valor: 'portabilidad', etiqueta: 'Portabilidad' },
  { valor: 'baja', etiqueta: 'Baja' },
];

/** Acciones por fila de la tabla de líneas (RF-LIN-1.5, 1.6 y 1.8). */
export function LineaActions({
  linea,
  onEditar,
  onCambiarEstado,
  onDarDeBaja,
  deshabilitado = false,
}: LineaActionsProps) {
  return (
    <div className="acciones-fila">
      <Button
        variante="secundario"
        disabled={deshabilitado}
        onClick={() => {
          onEditar(linea);
        }}
      >
        Editar
      </Button>

      <select
        className="acciones-fila__estado"
        aria-label={`Estado de ${linea.numero}`}
        disabled={deshabilitado}
        value={linea.estado}
        onChange={(evento) => {
          onCambiarEstado(linea, evento.target.value as EstadoLinea);
        }}
      >
        {ESTADOS.map((estado) => (
          <option key={estado.valor} value={estado.valor}>
            {estado.etiqueta}
          </option>
        ))}
      </select>

      <Button
        variante="peligro"
        disabled={deshabilitado || linea.estado === 'baja'}
        onClick={() => {
          onDarDeBaja(linea);
        }}
      >
        Dar de baja
      </Button>
    </div>
  );
}

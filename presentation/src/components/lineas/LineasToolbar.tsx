import { Button } from '../base/Button';

export interface LineasToolbarProps {
  readonly onNueva: () => void;
  readonly onExportar: (formato: 'csv' | 'xlsx') => void;
  readonly exportando: boolean;
  readonly onRecargar: () => void;
  readonly incluirBajas: boolean;
  readonly onCambiarIncluirBajas: (incluir: boolean) => void;
}

/**
 * Barra de herramientas del módulo de líneas (RF-UI-LIN-1.7).
 *
 * Permite crear líneas, recargar el listado y exportar el resultado con los
 * filtros aplicados en CSV o Excel.
 */
export function LineasToolbar({
  onNueva,
  onExportar,
  exportando,
  onRecargar,
  incluirBajas,
  onCambiarIncluirBajas,
}: LineasToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar__acciones">
        <Button onClick={onNueva}>Nueva línea</Button>

        <Button variante="secundario" disabled={exportando} onClick={onRecargar}>
          Recargar
        </Button>

        <Button
          variante="secundario"
          cargando={exportando}
          onClick={() => {
            onExportar('csv');
          }}
        >
          Exportar CSV
        </Button>

        <Button
          variante="secundario"
          cargando={exportando}
          onClick={() => {
            onExportar('xlsx');
          }}
        >
          Exportar Excel
        </Button>
      </div>

      <label className="toolbar__opcion">
        <input
          type="checkbox"
          checked={incluirBajas}
          onChange={(evento) => {
            onCambiarIncluirBajas(evento.target.checked);
          }}
        />
        Incluir líneas dadas de baja en la exportación
      </label>
    </div>
  );
}

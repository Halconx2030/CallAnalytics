import { CentrosCostePanel } from '../components/catalogos/CentrosCostePanel';
import { FormatosPanel } from '../components/catalogos/FormatosPanel';

/**
 * Página de catálogos: formatos de centro de coste y centros de coste.
 *
 * Es el complemento necesario de la importación: las líneas se asocian a un centro de coste
 * y los centros requieren un formato previo (SMU, FALABELLA…).
 */
export function FormatosCentros() {
  return (
    <>
      <FormatosPanel />
      <CentrosCostePanel />
    </>
  );
}

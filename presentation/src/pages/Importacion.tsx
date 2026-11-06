import { ImportPage } from '../components/import/ImportPage';

/**
 * Página de importación: dos secciones independientes, una para centros de coste y
 * otra para líneas (RF-UI-IMP-1.1).
 */
export function Importacion() {
  return (
    <div className="pagina">
      <header className="pagina__cabecera">
        <h1 className="pagina__titulo">Importación</h1>
        <p className="pagina__descripcion">
          Carga masiva de centros de coste y de líneas telefónicas desde archivos CSV o Excel.
        </p>
      </header>

      <ImportPage tipo="centros" />
      <ImportPage tipo="lineas" />
    </div>
  );
}

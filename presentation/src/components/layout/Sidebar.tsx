import { NavLink } from 'react-router-dom';

interface EnlaceMenu {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: string;
}

const ENLACES: ReadonlyArray<EnlaceMenu> = [
  { ruta: '/', etiqueta: 'Dashboard', icono: '▤' },
  { ruta: '/lineas', etiqueta: 'Líneas', icono: '☎' },
  { ruta: '/catalogos', etiqueta: 'Formatos y centros', icono: '▦' },
  { ruta: '/importacion', etiqueta: 'Importación', icono: '⇪' },
];

/** Menú lateral de navegación (RF-UI-LIN-1.1, RF-UI-IMP-1.1). */
export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__marca">
        <span className="sidebar__logo">T2</span>
        <div>
          <p className="sidebar__titulo">TELEFONO 2</p>
          <p className="sidebar__subtitulo">Control de líneas</p>
        </div>
      </div>

      <nav className="sidebar__menu" aria-label="Navegación principal">
        {ENLACES.map((enlace) => (
          <NavLink
            key={enlace.ruta}
            to={enlace.ruta}
            end={enlace.ruta === '/'}
            className={({ isActive }) =>
              isActive ? 'sidebar__enlace sidebar__enlace--activo' : 'sidebar__enlace'
            }
          >
            <span aria-hidden="true">{enlace.icono}</span>
            <span>{enlace.etiqueta}</span>
          </NavLink>
        ))}
      </nav>

      <footer className="sidebar__pie">
        <a className="sidebar__doc" href="/docs" target="_blank" rel="noreferrer">
          Documentación API
        </a>
      </footer>
    </aside>
  );
}

import { Outlet } from 'react-router-dom';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

/** Estructura general: menú lateral izquierdo + cabecera + contenido. */
export function Layout() {
  return (
    <div className="app">
      <Sidebar />
      <div className="app__principal">
        <Header />
        <main className="app__contenido">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

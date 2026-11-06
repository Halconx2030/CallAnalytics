import { useLocation } from 'react-router-dom';

const TITULOS: ReadonlyArray<{
  readonly prefijo: string;
  readonly titulo: string;
  readonly subtitulo: string;
}> = [
  {
    prefijo: '/lineas',
    titulo: 'Líneas telefónicas',
    subtitulo: 'Inventario, filtros y estados de las líneas',
  },
  {
    prefijo: '/catalogos',
    titulo: 'Formatos y centros de coste',
    subtitulo: 'Catálogos base para asignar líneas',
  },
  {
    prefijo: '/importacion',
    titulo: 'Importación',
    subtitulo: 'Carga masiva de centros de coste y líneas',
  },
  {
    prefijo: '/',
    titulo: 'Dashboard',
    subtitulo: 'Resumen del inventario de líneas',
  },
];

/** Cabecera de la aplicación. */
export function Header() {
  const { pathname } = useLocation();
  const actual = TITULOS.find((titulo) =>
    titulo.prefijo === '/' ? pathname === '/' : pathname.startsWith(titulo.prefijo)
  );

  return (
    <header className="cabecera">
      <div>
        <h1 className="cabecera__titulo">{actual?.titulo ?? 'TELEFONO 2'}</h1>
        <p className="cabecera__subtitulo">{actual?.subtitulo ?? ''}</p>
      </div>
    </header>
  );
}

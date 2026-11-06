import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { FormatosCentros } from './pages/FormatosCentros';
import { Importacion } from './pages/Importacion';
import { Lineas } from './pages/Lineas';

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

/** Raíz de la SPA de TELEFONO 2. */
export function App() {
  return (
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lineas" element={<Lineas />} />
            <Route path="/catalogos" element={<FormatosCentros />} />
            <Route path="/importacion" element={<Importacion />} />
            <Route path="*" element={<p className="estado">Página no encontrada</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

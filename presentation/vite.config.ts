import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Puerto del servidor de Vite.
 *
 * Se puede sobreescribir con `VITE_PORT` (por defecto 5173). Así los tests E2E
 * pueden levantar su propia SPA en otro puerto sin chocar con el dev server.
 */
const PUERTO_VITE = Number(process.env.VITE_PORT ?? 5173);

/**
 * SPA de TELEFONO 2.
 *
 * En desarrollo el servidor de Vite corre en el puerto 5173 y redirige `/api` al
 * backend Fastify (por defecto `http://localhost:3000`), de modo que no hace
 * falta CORS ni configuración extra de proxy en el navegador.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: PUERTO_VITE,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

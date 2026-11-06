# ADR-008 · Interfaz web: SPA React + Vite

- **Estado**: Aceptado (sustituye la decisión original de templates de servidor)
- **Fecha**: 2026-11-04

## Contexto

La constitución original preveía una interfaz renderizada en el servidor con templates (Handlebars/eta). La especificación 001 (Q8) y el plan técnico laxaron esa decisión en favor de una SPA independiente: el módulo de líneas exige filtros por columna, paginación por cursor, selección múltiple y cambio de estado masivo, y la importación exige drag & drop con reporte en vivo.

## Decisión

SPA en `presentation/`, como paquete propio del workspace pnpm, con **React 18 + TypeScript + React Router 6 + TanStack Query 5 + Vite 5**.

- Servidor de desarrollo en el puerto **5173**, con proxy `/api` → `http://localhost:3000`.
- Los datos, la caché y la invalidación se gestionan con TanStack Query; el cliente HTTP (`services/api.ts`) traduce los errores RFC 7807 a `ApiError`.
- La API permanece JSON puro (coherente con la importación/exportación CSV).

## Consecuencias

- Dos configuraciones de build: `tsdown` para el backend y `vite` para la SPA.
- Rutas: `/` (Dashboard), `/lineas`, `/catalogos` (formatos y centros de coste), `/importacion`.
- `CORS_ORIGIN` del backend debe permitir el origen de la SPA (`http://localhost:5173`).
- La tabla de stack de `docs/constitution.md` pasa de `Templates: Handlebars / eta` a `UI: SPA React + Vite (ADR-008)`.

## Alternativas descartadas

- **Templates en el servidor (Handlebars/eta)**: no permiten filtros, selección múltiple ni actualización sin recargar.
- **Next.js**: aporta SSR y convenciones de enrutado innecesarias para una app interna.

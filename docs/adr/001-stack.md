# ADR-001 · Stack base: Node.js 20 LTS + TypeScript 5 + pnpm

- **Estado**: Aceptado
- **Fecha**: 2026-11-04

## Contexto

El proyecto TELEFONO 2 (control de líneas telefónicas) parte de un proyecto previo ("Control de Líneas Telefónicas") construido en Python. El código se reescribe desde cero, pero se conserva la estructura de carpetas (`specs/`, `docs/`, `tests/`) y el flujo Spec-Driven Development.

## Decisión

- **Runtime**: Node.js 20 LTS.
- **Lenguaje**: TypeScript 5.x en `strict` (`tsconfig.json` con `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- **Gestor de paquetes**: pnpm 9.x (workspace con la SPA en `presentation/`).
- **Ejecución**: `tsx` en desarrollo; `tsdown` para el bundle de producción.

## Consecuencias

- Tipado estático de extremo a extremo (shared types entre backend y front).
- `pnpm install` instala 2 proyectos (raíz + `presentation/`).
- El bundle de producción no emite declaraciones (`dts: false`): es una app, no una librería.

## Alternativas descartadas

- **Python/FastAPI + pytest**: era el stack del proyecto original; se descartó para unificar el monolito con la SPA React.
- **npm/yarn**: pnpm aportalinked store y soporte nativo de workspaces.

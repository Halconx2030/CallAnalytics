---
description: Diseña el plan técnico de una spec aprobada
agent: plan
---

Escribe `specs/NNN-nombre-slug/plan.md`. Esta fase traduce requisitos en una estrategia de
construcción concreta.

## Contenido obligatorio

1. **Mapa RF → componente**: una fila por requisito con el módulo, función o tabla que lo satisface.
   Si un RF no tiene ningún componente asignado, el plan está incompleto.
2. **Migraciones**: qué tablas y columnas crean, en qué orden, con qué índices, constraints y
   claves foráneas. Los nombres de constraint se escriben aquí para que se puedan referenciar.
3. **Estructura de módulos**: rutas, responsabilidades y qué NO hace cada módulo.
4. **Estrategia de datos**: consultas SQL concretas de las operaciones principales, sobre todo las
   agregaciones. Si un cálculo de negocio no cabe en un `SELECT` obvious, explica el algoritmo.
5. **Estrategia de pruebas**: qué prueba cubre qué RF, y qué fixtures necesita.
6. **Orden de implementación.** Justificada por dependencias reales, no por numeración.

## Reglas

- **Este es el último momento antes de escribir código.** Si el plan no es aprobado, no se
  implementa nada.
- Un plan que no se puede ejecutar en tareas de 20-30 minutos está mal dimensionado.
- Nombra archivos, funciones y tablas de verdad. "Un servicio de gestión" no es un plan.
- El plan no puede contradecir la constitución. Si necesita contradecirla, la constitución se
  cambia primero, explícitamente, y se anota el porqué en `MEMORY.md`.
- Incluye cómo se manejan las operaciones que pueden fallar a mitad: transacciones, qué se
  revierte, qué queda registrado.
- Nada de sobre-ingeniería: si el stack es SQLite local y 2 usuarios, no propongas cachés,
  colas ni microservicios.

## Al terminar

Presenta el plan y **espera aprobación explícita del usuario** (TELEFONO 2). Escribe la fecha de aprobación en
la sección final de `plan.md` solo cuando el usuario la haya dado.

$ARGUMENTS

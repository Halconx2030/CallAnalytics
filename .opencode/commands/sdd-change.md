---
description: Gestiona un cambio de alcance de una spec ya implementada
agent: plan
---

Modifica una spec que ya pasó por todas las fases. Un cambio post-implementación es el escenario
más fácil de hacer mal: si se edita el spec sin más, la documentación miente sobre el código.

## Procedimiento

1. **Clasifica el cambio** antes de tocar nada:

| Tipo                         | Qué significa                               | Ruta                                              |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------- |
| **Corrección**               | El código no hacía lo que el spec pedía     | Se arregla el código. El spec estaba bien.        |
| **Ampliación**               | Se agrega comportamiento nuevo              | Actualiza spec, plan y tareas.                    |
| **Refactor**                 | Se cambia cómo se hace, no qué se obtiene   | Actualiza plan. Spec no cambia.                   |
| **Revisión de constitución** | El cambio contradice una regla del proyecto | ADR primero, constitución después, spec al final. |

Confirma la clasificación con el usuario antes de actuar. Es el error más caro del flujo tratar un
refactor como ampliación o al revés.

2. **Propón el impacto** antes de editar: qué RF cambian, si hay migración nueva, si hay tareas
   que rehacer, si algo ya hecho se rompe.

3. **Actualiza los artefactos** en orden, de arriba hacia abajo:
   `constitution.md` (si aplica) → `docs/adr/` (si cambia el stack) → `spec.md` → `plan.md` →
   `tasks.md` (tareas nuevas con `[ ]`).

4. **Nunca borres el historial**: si un RF se elimina o cambia de significado, márcalo como
   sustituido y anota por qué. Un spec reescrito desde cero pierde el registro de por qué se decidió
   algo y vuelve a discusión lo que ya se resolvió.

5. **Añade al `spec.md`** una sección de fecha de última modificación y resumen del cambio.

## Regla dura

Un cambio de alcance **no se implementa en la misma pasada**. Se actualizan los documentos, se pide
aprobación, y recién después se ejecuta `/sdd-implement` sobre las tareas nuevas.

## Al terminar

Muestra el diff conceptual de los documentos y qué tareas quedan pendientes. **Actualiza
`MEMORY.md` (TELEFONO 2).**

$ARGUMENTS

---
description: Muestra en qué fase del flujo SDD está cada spec
agent: plan
---

Analiza el estado del proyecto Spec-Driven Development y reporta dónde estamos.

## Qué hacer

1. Lee `MEMORY.md` para el estado declarado.
2. Lista el contenido de `specs/`. Cada spec es `NNN-nombre/` con `spec.md`, `plan.md`, `tasks.md`.
3. Para cada spec, mira qué artefactos existen y qué checkboxes están marcados:

| Artefacto presente                 | Fase alcanzada        |
| ---------------------------------- | --------------------- |
| solo `spec.md`                     | Spec                  |
| `spec.md` + `plan.md` sin aprobar  | Clarificar / Plan     |
| `plan.md` con "Aprobación" marcado | Tareas                |
| `tasks.md` con checkboxes marcados | Implementar / Validar |

4. Cuenta los checkboxes de cada `tasks.md`: hechos vs pendientes.
5. Revisa si hay respuestas sin resolver: las "Preguntas abiertas" de los `spec.md` y la sección
   "Abiertas" de `MEMORY.md`.

## Reglas

- No modifiques ningún archivo. Este comando solo informa.
- Si alguna spec tiene `plan.md` o `tasks.md` pero le falta la aprobación del usuario, dilo
  explícitamente: **el flujo no puede avanzar a la siguiente fase sin esa aprobación.**
- Si detectas un requisito de la constitución que una spec contradice, señálalo.

## Salida

Un resumen corto: estado general, tabla por spec con fase y progreso, y la lista de bloqueos
concretos (preguntas sin responder, aprobaciones faltantes). Termina indicando cuál es el próximo
comando que corresponde y por qué (TELEFONO 2).

$ARGUMENTS

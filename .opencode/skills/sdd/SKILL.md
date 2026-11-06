---
name: sdd
description: Usa esta skill al trabajar en TELEFONO 2 (Control de Líneas Telefónicas) con Spec-Driven Development (flujo Constitución → Spec → Clarificar → Plan → Tareas → Implementar → Validar) o cuando el usuario mencione un spec, /sdd, requisitos EARS, o el flujo SDD. Carga las reglas del proceso y de qué fase está el proyecto.
---

# Spec-Driven Development

## Qué es

Un flujo donde **la especificación se escribe y se aprueba antes de existir el código**. Cada fase
produce un artefacto en disco, y **ninguna fase avanza sin aprobación explícita del usuario**.

## El flujo

```
Constitución → Spec → Clarificar → Plan → Tareas → Implementar → Validar
     ↑                                                        │
     └──────────────── loop si aparece algo no cubierto ───────┘
```

| Fase              | Artefacto                   | Comando             |
| ----------------- | --------------------------- | ------------------- |
| Constitución      | `docs/constitution.md`      | `/sdd-constitution` |
| Spec              | `specs/NNN-nombre/spec.md`  | `/sdd-spec`         |
| Clarificar        | spec actualizado            | `/sdd-clarify`      |
| Plan              | `specs/NNN-nombre/plan.md`  | `/sdd-plan`         |
| Tareas            | `specs/NNN-nombre/tasks.md` | `/sdd-tasks`        |
| Implementar       | `app/`                      | `/sdd-implement`    |
| Validar           | tabla de trazabilidad       | `/sdd-validate`     |
| Cambio de alcance | documentos actualizados     | `/sdd-change`       |
| Ver dónde estamos | —                           | `/sdd-status`       |

## La regla que hace que esto funcione

**Nunca avances de fase sin que el usuario apruebe explícitamente.**

Se trata como aprobación: "sí, dale", "ok", "adelante". **No** es aprobación:

- Que el usuario haya pedido la funcionalidad.
- Que la fase anterior haya salido bien.
- Que el siguiente paso "sea obvio".
- Que el usuario se haya ido a otra cosa y vuelva a preguntar qué falta.

Si el usuario pide implementar algo que no tiene spec aprobado, la respuesta es decir que falta el
plan y proponer `/sdd-plan`, no escribir el código.

## Reglas transversales

- **Una spec, un concern.** Si necesita dos, son dos specs.
- **EARS en español**: `EL SISTEMA <x>` · `CUANDO <e>, EL SISTEMA <r>` ·
  `SI <c>, ENTONCES EL SISTEMA <r>` · `MIENTRAS <e>, EL SISTEMA <x>`.
- **Todo requisito es verificable.** Si no se puede probar con una prueba, está mal escrito.
- **Ningún supuesto silencioso.** Si no sabes algo, va a "Preguntas abiertas". Un supuesto
  inventado se convierte en bug silencioso.
- **La constitución manda.** Si un spec la contradice, se cambia la constitución primero, de forma
  explícita, con el porqué anotado en `MEMORY.md`.
- **Cambiar el stack requiere ADR nuevo** en `docs/adr/`.
- **Migraciones inmutables.** Nunca edites una ya aplicada; crea la siguiente.
- **Al terminar cada tarea, actualiza `MEMORY.md`.**

## Antes de escribir código, verifica

- [ ] `spec.md` existe y está aprobado
- [ ] No quedan preguntas bloqueantes abiertas
- [ ] `plan.md` existe con la aprobación marcada
- [ ] `tasks.md` existe y el usuario lo aprobó
- [ ] Entendiste qué archivos vas a tocar

Si algo de esta lista falla, para y dilo.

## Al evaluar si esto aplica

Aplica a: escribir funcionalidades, corregir comportamiento, agregar requisitos.
**No** aplica a: preguntas sobre el código ya existente, explicar la constitución, o tareas
mecánicas como corregir un typo. Para esas, responde directamente.

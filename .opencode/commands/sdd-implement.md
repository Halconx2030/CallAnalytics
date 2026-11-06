---
description: Implementa las tareas aprobadas, una a una, con verificación
agent: build
---

Ejecuta las tareas de `specs/NNN-nombre-slug/tasks.md` **de una en una**, en orden de dependencias.

## Antes de empezar

Verifica que existen y están aprobados: `spec.md`, `plan.md` con aprobación marcada, y `tasks.md`.
Si falta algo, **para y avisa**. No implementes sin plan aprobado.

## Ciclo por tarea

Para cada tarea pendiente:

1. **Marca el checkbox** `[ ]` → `[~]` al empezar.
2. **Escribe la prueba primero** cuando la tarea tenga "Hecho cuando:". La prueba debe fallar antes
   de escribir el código: si pasa sin implementación, la prueba está mal.
3. **Implementa.** Código mínimo que hace pasar la prueba. Nada más.
4. **Ejecuta la suite completa:**
   ```powershell
   .\.venv\Scripts\python.exe -m pytest
   ```
5. **Verifica el "Hecho cuando:"** de forma observable, no solo "los tests pasan".
6. Marca `[x]` solo si el paso 4 y el 5 se cumplieron.

## Reglas duras

- **Una tarea a la vez.** No agrupes varias ni digas "hice las 5 primeras" sin haber verificado cada una.
- Si la tarea resulta más grande de lo estimado, **divídela** y anótalo. No sigas adelante con una
  tarea a medio hacer.
- Si descubres que el spec no cubre algo que necesitas: **para**. Vuelve a `/sdd-spec`. No inventes
  alcance ni resuelvas por tu cuenta.
- Si una migración ya aplicada necesita cambios: crea una migración nueva. **Nunca edites una
  anterior.**
- Los números de teléfono se normalizan **siempre** con la función única del proyecto. Ningún otro
  punto del código los transforma.
- Nada de `DELETE` sobre datos de negocio. Bajas son cambios de estado con fecha y motivo.
- Comentarios: explica **por qué**, no qué hace el código. El código ya se explica solo.
- Español en nombres de dominio, UI y reportes.

## Al terminar todas las tareas

Ejecuta la suite completa una vez más y reporta: cuántas tareas se hicieron, qué quedó pendiente, y
si apareció algún RF sin cubrir. Propón `/sdd-validate`. **Actualiza `MEMORY.md` (TELEFONO 2).**

$ARGUMENTS

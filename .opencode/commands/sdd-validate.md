---
description: Valida que la implementación cumple cada requisito del spec
agent: build
---

Verifica, requisito por requisito, que lo implementado cumple lo especificado.

## Método

1. **Tabla de trazabilidad**: recorre los `RF-x.y` del `spec.md`. Por cada uno:
   - ¿Existe una prueba que falle si el requisito no se cumple?
   - ¿Esa prueba pasa?
   - ¿La implementación realmente satisface el requisito, o solo su test?
2. **Rutasodinarias**: camina a mano los flujos principales de la UI.
3. **Suite completa**: `.\.venv\Scripts\python.exe -m pytest`
4. **Invariantes**: confirma que las reglas de la constitución §5 se respetan en el esquema real.
5. **Cierre de tareas**: todos los checkboxes de `tasks.md` en `[x]`.

## Preguntas obligatorias

- ¿Hay algún RF sin prueba?
- ¿Hay alguna prueba que pase sin que el comportamiento exista de verdad?
- ¿SeRDebe algo quedó "para después" dentro del código?
- ¿Hay números de teléfono guardados sin pasar por la función de normalización?
- ¿Alguna consulta de costo cruza contra el estado de la línea, o solo contra el número?
- ¿La app arranca de verdad con el comando de `AGENTS.md`?
- ¿Los archivos del proveedor se guardan en `imports/`?

## Reglas

- **No corrijas nada en esta fase.** Valida y reporta. Si hay que arreglar algo, vuelve a
  `/sdd-implement`.
- Sé escéptico de tus propias pruebas: una prueba escrita junto al código para que pase tiende a
  validar la implementación en vez del requisito.
- Distingue claramente entre **bloqueante** (el requisito no se cumple) y **diferencia menor**
  (se cumple pero de otra forma).

## Al terminar

Presenta la tabla de trazabilidad completa con estado por RF. Pide aprobación antes de cerrar la
fase, y actualiza `MEMORY.md` (TELEFONO 2) con lo que se aprendió.

$ARGUMENTS

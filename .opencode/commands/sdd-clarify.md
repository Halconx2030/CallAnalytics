---
description: Resuelve las ambigüedades de un spec antes de planificar
agent: plan
---

Trabaja sobre `specs/NNN-nombre-slug/spec.md` para eliminar todo lo que quede ambiguo.

## Método

1. Lee el spec completo y `docs/constitution.md`.
2. Extrae **todo** lo que no está determinado:
   - Formatos de archivo de entrada (¿cuáles son las columnas exactas?)
   - Valores permitidos y sus defaults
   - Casos límite no cubiertos por ningún RF
   - Conflictos entre requisitos
   - Supuestos que hiciste sin basis
3. Para cada ambigüedad, decide cuál de estas dos es:
   - **Bloqueante**: no se puede implementar sin respuesta. Pregunta al usuario.
   - **Resoluble con criterio**: se puede decidir leyendo la constitución y el dominio. Decide,
     escribe la decisión y explica el porqué en una línea para que la pueda revertir.
4. Actualiza `spec.md`: resuelve las ambigitudes resolubles **en el spec mismo**, para que el
   documento sea la fuente de verdad y no el chat.
5. Deja en "Preguntas abiertas" solo lo que sea realmente bloqueante.

## Señales de una spec poco clara

- "el usuario", "el sistema" sin objeto concreto.
- Requisitos que se contradicen entre sí.
- Un RF que necesita un dato que nadie tiene.
- Nada dice qué pasa en el camino de error.
- El modelo de datos no soporta algo que los RF prometen.

## Regla dura

No inventes respuestas para cerrar huecos. Un supuesto silencioso se convierte en bug y nadie lo
detecta hasta meses después. Si el usuario no sabe algo, se escribe "por definir" y se sigue con
el resto.

## Al terminar

Lista las preguntas bloqueantes y **espera las respuestas del usuario** (TELEFONO 2). No avances a `/sdd-plan`
sin ellas.

$ARGUMENTS

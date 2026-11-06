---
description: Descompone el plan aprobado en tareas de 20-30 minutos
agent: plan
---

Escribe `specs/NNN-nombre-slug/tasks.md`.

## Formato de cada tarea

```markdown
### T-07 · Nombre corto en imperativo

- [ ] RF-2.1, RF-2.3
- Archivo: `app/repositories/lineas.py`
- **Hecho cuando:** <condición observable y verificable>
- Riesgo: <qué puede salir mal>
```

## Reglas

- **Duración: 20-30 minutos como máximo.** Si una tarea parece mayor, se parte. Si parece menor,
  se junta con su vecina. Si no puedes estimarla, es que no está bien entendida.
- Cada tarea lleva **checkbloja**, los RF que cubre y **"Hecho cuando:"** verificable. "Funciona" no
  es verificable; "el filtro por región devuelve solo líneas de esa región" sí.
- Cada tarea debe dejar el proyecto en un estado que **no esté roto**. Nada de commits a medio
  camino con la suite en rojo.
- Tarea = cambio cohesivo. Si necesita tocar 8 archivos sin relación, son varias tareas.
- El **orden** lo dictan las dependencias reales, no la numeración: un módulo del que todo depende
  va primero aunque se llame T-15.
- Toda tarea que cree o modifique esquema SQL **crea una migración nueva**. Prohibido editar una
  migración ya aplicada.
- Ninguna tarea puede requerir una decisión que no esté resuelta en el spec. Si aparece una,
  vuelve a `/sdd-clarify` en vez de decidir acá.

## Al terminar

Muestra el listado de tareas y el tiempo total estimado. **Espera aprobación del usuario** (TELEFONO 2) antes de
`/sdd-implement`.

$ARGUMENTS

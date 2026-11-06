---
description: Escribe o actualiza la constitución del proyecto
agent: plan
---

Produce `docs/constitution.md`: las reglas no negociables que todo spec, plan y tarea debe cumplir.

## Qué debe contener

1. **Propósito** — qué resuelve el sistema, en términos de negocio, con una tabla "objetivo → qué
   significa en la práctica".
2. **Alcance** — explícitamente dentro / fuera. Lo que está fuera no se cuela en el código.
3. **Stack tecnológico** — tabla capa → elección → razón. Referencia al ADR correspondiente.
4. **Reglas del dominio** — las invariantes del negocio, escritas de forma que no se puedan
   interpretar de dos maneras.
5. **Invariantes de la base de datos** — las reglas que el código no puede romper aunque se intente.
6. **Proceso de desarrollo** — el flujo y la regla de aprobación.
7. **Manejo de archivos** — qué es gitignored, qué se respalda y cómo.
8. **Pruebas** — qué exige cada requisito.
9. **Fuera de alcance** — lo que se decidió postergar, para que nadie lo construya por entusiasmo.
10. **Referencias** — a dónde ir por el resto.

## Reglas

- Escribe en **español**. Los identificadores de base de datos van sin tilde ni ñ; los labels
  visibles con tilde.
- Cada regla debe ser **verificable**: si no se puede comprobar, es prosa decorativa, fuera.
- Si el stack no está decidido todavía, no lo inventes: escribe la pregunta abierta y para.
- Si la constitución ya existe, **actualízala en lugar de reemplazarla**. Conserva lo que siga
  siendo válido y marca como obsoleto lo que cambió.
- Cambiar una decisión de stack requiere un ADR nuevo en `docs/adr/`.

## Al terminar

Muestra el diff conceptual de lo que cambiaste y pregunta al usuario si lo aprueba. La constitución
es la entrada de todo el flujo (TELEFONO 2), así que necesita aprobación explícita antes de seguir.

$ARGUMENTS

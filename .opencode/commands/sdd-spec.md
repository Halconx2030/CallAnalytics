---
description: Escribe la especificación de una funcionalidad en formato EARS
agent: plan
---

Crea `specs/NNN-nombre-slug/spec.md` para **una** funcionalidad. Una spec, un concern.

## Estructura obligatoria

1. **Problema** — qué pregunta del negocio no se puede responder hoy. Concreto, no genérico.
2. **Qué incluye** — lista de alcance.
3. **Fuera de esta spec** — lista explícita. Esto evita que el alcance crezca durante la
   implementación.
4. **Modelo de datos** — tablas y columnas propuestas, con tipo y notas. Si el modelo ya tiene que
   dejar espacio para specs futuras, dilo aquí.
5. **Requisitos en EARS** — numerados `RF-x.y`, agrupados por capability.
6. **Preguntas abiertas** — lo que no sabes y necesita respuesta del usuario.

## Formato EARS (obligatorio, en español)

| Patrón                                            | Cuándo usarlo                        |
| ------------------------------------------------- | ------------------------------------ |
| `EL SISTEMA <comportamiento>`                     | Invariante permanente                |
| `CUANDO <evento>, EL SISTEMA <respuesta>`         | Reacción a un disparador             |
| `SI <condición>, ENTONCES EL SISTEMA <respuesta>` | Respuesta condicional                |
| `MIENTRAS <estado>, EL SISTEMA <comportamiento>`  | Comportamiento durante una situación |

## Reglas

- Cada requisito describe **comportamiento observable**, no implementación. "El sistema guarda el
  archivo" sí; "el sistema usa la clase `ArchivoRepo`" no.
- Cada requisito debe ser **verificable con una prueba**. Si no se puede probar, reescrívelo.
- Un requisito = un comportamiento. Si lleva "y", probablemente son dos.
- Cubre el camino de error, no solo el feliz: qué pasa con datos inválidos, archivos duplicados,
  permisos insuficientes.
- No inventes datos que no tienes. Si no sabes el esquema del Excel del proveedor, es una pregunta
  abierta, no un supuesto silencioso.
- No escribas `plan.md` ni `tasks.md` todavía: eso es de otras fases.

## Al terminar

Presenta los requisitos al usuario y **espera aprobación** (TELEFONO 2) antes de seguir a `/sdd-clarify`. Si el
usuariorequested algo que contradice la constitución, señálalo y propón el ajuste en vez de
aplicarlo por tu cuenta.

$ARGUMENTS

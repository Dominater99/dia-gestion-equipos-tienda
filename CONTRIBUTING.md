# Guía de contribución

## Responsabilidad documental

Este documento define el flujo reutilizable de colaboración: preparación, ramas, commits,
revisión y entrega. Las decisiones concretas de cada aplicación —comandos, ramas protegidas,
entornos y requisitos adicionales— pertenecen a `docs/domain/SPECIFICATION.md`.

No define arquitectura, convenciones de código, pruebas, seguridad ni despliegue. Esos contratos
viven en sus documentos especializados.

## Antes de empezar

1. Lee `AGENTS.md` y la especificación de la aplicación.
2. Consulta los documentos especializados que afecten al cambio.
3. Inspecciona el código, el manifiesto de Apps Script y las pruebas antes de asumir contratos.
4. Describe el comportamiento actual y el esperado en los cambios funcionales.
5. No uses datos, recursos o credenciales de producción durante el desarrollo.

## Preparación del entorno

Usa las versiones, dependencias y comandos declarados en la especificación y en `package.json`.
No documentes aquí comandos que no existan en el repositorio.

## Ramas y alcance

- Trabaja en una rama corta y enfocada, siguiendo la convención indicada en la especificación.
- Separa renombrados, refactorizaciones amplias y cambios funcionales cuando sea posible.
- No mezcles correcciones oportunistas fuera del alcance; regístralas como hallazgos.
- Mantén los cambios reversibles y evita migraciones destructivas.

## Commits

Se recomienda Conventional Commits cuando el proyecto no establezca otro formato:

```text
tipo(área): resumen en imperativo
```

Tipos habituales: `feat`, `fix`, `refactor`, `docs`, `test`, `chore` y `security`.
El mensaje explica el propósito; no reproduce el diff ni incluye información sensible.

## Implementación

- Sigue `docs/development/CONVENTIONS.md` y los límites confirmados de Apps Script.
- Mantén separadas reglas de negocio e integraciones con Google Workspace.
- Valida antes de producir efectos externos.
- Conserva idempotencia, trazabilidad segura y mínimo privilegio.
- No cambies scopes, servicios avanzados, permisos o comunicaciones sin revisar su impacto.

## Verificación

Ejecuta la comprobación local indicada en la especificación. Añade pruebas proporcionales al
riesgo y cubre reintentos, fallos parciales y entradas inválidas cuando correspondan. Las pruebas
que afecten servicios reales deben usar recursos temporales inequívocos y entornos autorizados.

## Pull requests y revisión

Una propuesta de cambio debe indicar:

- problema y comportamiento esperado;
- solución y alternativas relevantes;
- archivos, datos y flujos afectados;
- pruebas realizadas y resultado;
- cambios de permisos, OAuth, servicios o configuración;
- riesgos, limitaciones y reversión.

La revisión aplica la matriz de `AGENTS.md` y la estrategia de
`docs/development/TESTING.md`. Los cambios visibles, de seguridad o incompatibles se registran en
`CHANGELOG.md`.

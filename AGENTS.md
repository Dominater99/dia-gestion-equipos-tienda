# AGENTS.md — Protocolo de mantenimiento para Google Apps Script

## Propósito

Este documento define cómo debe trabajar cualquier agente o desarrollador en un proyecto Google
Apps Script. Es reutilizable: las decisiones y nombres de la aplicación actual viven únicamente en
`docs/domain/SPECIFICATION.md`.

Antes de modificar el proyecto, inspecciona el código, `appsscript.json`, las pruebas y la
documentación aplicable. No presupongas hojas, campos, funciones, triggers, carpetas, propiedades,
roles, scopes ni comandos.

## Prioridad y fuentes de verdad

Respeta, en este orden:

1. instrucciones explícitas del usuario y políticas de seguridad aplicables;
2. el `AGENTS.md` más cercano al archivo modificado;
3. la especificación de la aplicación;
4. los documentos especializados;
5. el comportamiento verificado por código, manifiesto y pruebas.

Si documentación y ejecución divergen, no elijas en silencio: confirma el contrato correcto y
actualiza la fuente desfasada.

## Rol

Actúa como principal engineer especializado en Apps Script y Google Workspace. Evalúa corrección,
seguridad, privacidad, arquitectura, fiabilidad, rendimiento, escalabilidad, mantenibilidad y
operación. Prefiere la solución más simple que sea segura, comprobable y reversible.

No amplíes el alcance sin petición. Los problemas ajenos se registran como hallazgos; no se
corrigen de forma oportunista.

## Mapa documental

- `README.md`: propósito, inicio rápido e índice; no define contratos detallados.
- `docs/domain/SPECIFICATION.md`: único perfil específico de la aplicación.
- `docs/architecture/ARCHITECTURE.md`: principios y opciones arquitectónicas reutilizables.
- `docs/development/CONVENTIONS.md`: contratos de código y estructura.
- `docs/development/STYLE_GUIDE.md`: sistema visual y accesibilidad.
- `docs/development/TESTING.md`: estrategia y niveles de prueba.
- `docs/domain/API.md`: reglas para interfaces; el inventario real queda en la especificación.
- `docs/operations/OPERATIONS.md`: ciclo operativo general.
- `docs/operations/SECURITY.md`: controles técnicos de seguridad y privacidad.
- `.github/SECURITY.md`: reporte responsable de vulnerabilidades.
- `CONTRIBUTING.md`: colaboración, commits y revisiones.
- `GLOSSARY.md`: definiciones, nunca reglas.
- `CHANGELOG.md`: historia del repositorio.

Cada tema tiene un propietario. Los demás documentos enlazan a esa fuente en lugar de repetirla.

## Principios de ingeniería

- **Seguridad y privacidad:** mínimo privilegio, minimización de datos y validación en servidor.
- **Integridad:** operaciones idempotentes, concurrencia controlada y recuperación explícita.
- **DRY:** una sola fuente para reglas, configuración, estados y transformaciones.
- **SOLID:** responsabilidades cohesionadas, contratos pequeños y dependencias dirigidas.
- **KISS y YAGNI:** sin capas, cachés o extensibilidad para necesidades hipotéticas.
- **Separación de intereses:** dominio, acceso a Google, presentación y orquestación no se mezclan.
- **Fail fast:** valida entradas y precondiciones antes de producir efectos externos.
- **Reversibilidad:** evita migraciones destructivas y conserva compatibilidad pública.

Ante tensión, prioriza: seguridad y privacidad, integridad, corrección, simplicidad,
mantenibilidad y rendimiento medido.

## Implementación

- Sigue las capas, nombres e idioma adoptados en la especificación.
- Prefiere `const` y `let`; no impongas límites arbitrarios de líneas.
- Divide funciones por responsabilidad y complejidad comprobada.
- Centraliza constantes, mensajes, estados, nombres de hojas y propiedades.
- No guardes secretos, tokens, IDs sensibles ni datos personales en Git.
- No captures excepciones para ignorarlas; añade contexto y propaga o devuelve un estado explícito.
- Usa `LockService` cuando ejecuciones concurrentes puedan mutar el mismo recurso.
- Reduce llamadas remotas y opera Sheets en bloques.
- Usa caché solo para datos reconstruibles, con alcance, TTL e invalidación definidos.
- Mantén compatibles triggers y funciones públicas o documenta la migración.

Las normas detalladas están en `docs/development/CONVENTIONS.md`.

## Seguridad de Drive y Workspace

Antes de compartir una carpeta, verifica acceso general, permisos directos, herencia, propietario,
cuenta ejecutora y tipo de unidad. No distribuyas enlaces si falla una operación crítica de
permisos. No intentes retirar herencia con una API que solo gestiona permisos directos.

No añadas scopes ni servicios avanzados si la capacidad actual basta. Las reglas completas están
en `docs/operations/SECURITY.md`; los requisitos concretos, en la especificación.

## Auditoría

Clasifica hallazgos como Crítica, Alta, Media o Baja. Cada hallazgo incluye evidencia, impacto,
escenario de fallo y recomendación. Distingue hechos de hipótesis y no declares que algo es seguro,
escalable u optimizado sin verificación proporcional al riesgo.

## Validación

Después de un cambio, ejecuta las comprobaciones indicadas en la especificación y cubre el camino
principal, entradas límite, reintentos, fallos parciales, concurrencia y permisos cuando apliquen.
No uses producción sin autorización.

Antes de publicar, sigue `docs/operations/OPERATIONS.md` y el procedimiento específico. No borres
filas, archivos, permisos o recursos existentes sin autorización explícita y objetivo verificado.

## Entrega

Al finalizar:

1. resume comportamiento y archivos modificados;
2. declara supuestos y limitaciones;
3. indica cómo se verificó;
4. informa de scopes, servicios o reautorización necesarios;
5. registra riesgos fuera de alcance;
6. aporta medidas cuando exista impacto de rendimiento.

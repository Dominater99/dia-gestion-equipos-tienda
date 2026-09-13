# Arquitectura de referencia para Google Apps Script

## Responsabilidad documental

Este documento define principios, capas conceptuales y criterios de elección reutilizables. La
topología, carpetas, componentes y flujos reales de una aplicación pertenecen a
`../domain/SPECIFICATION.md`.

No prescribe siete capas, una SPA, caché multinivel ni Spoke & Hub para todos los proyectos.

## Criterio de diseño

La arquitectura debe ser la mínima que preserve seguridad, integridad, capacidad de prueba y
operación. Clasificar informalmente el sistema ayuda a evitar extremos:

- **Pequeño:** automatización o macro con pocos efectos y una fuente de datos.
- **Mediano:** sidebar, complemento o web app con varios casos de uso.
- **Grande:** aplicación multiintegración, alto volumen o múltiples equipos y despliegues.

La clasificación no decide la arquitectura por sí sola. Registra en la especificación los riesgos
que justifican cada capa o patrón.

## Capas conceptuales

Una aplicación puede separar, cuando aporten valor:

```text
Entradas y presentación
          |
          v
Casos de uso / aplicación
          |
          v
Dominio y contratos
          ^
          |
Adaptadores de Google Workspace y sistemas externos
```

- **Dominio:** reglas y transformaciones independientes de APIs de Google.
- **Aplicación:** coordina casos de uso, transacciones lógicas y recuperación.
- **Infraestructura:** implementa Sheets, Drive, Mail, Properties, Cache y APIs externas.
- **Entradas/presentación:** adapta triggers, web app, menús, formularios y cliente HTML.
- **Fundación:** constantes o utilidades pequeñas sin dependencias hacia arriba, si se necesitan.

Las dependencias apuntan hacia contratos más estables. Una capa inferior no llama a una superior.
Los números y nombres de carpetas son una decisión específica, no parte del modelo universal.

## Flujo de efectos externos

Un caso de uso con mutaciones sigue normalmente esta secuencia:

1. adaptar y validar la entrada;
2. autorizar la operación;
3. adquirir el bloqueo necesario;
4. comprobar identidad y, cuando aplique, idempotencia;
5. ejecutar reglas de dominio;
6. aplicar efectos en orden seguro;
7. verificar el resultado crítico;
8. persistir estado y notificar;
9. compensar o dejar un punto de recuperación si falla;
10. liberar recursos en `finally`.

El orden concreto y qué fallo es compensable se documentan en la especificación.

## Frontend de Apps Script

Para interfaces pequeñas puede bastar una plantilla. Cuando crece, separa componentes, servicios y
vistas, manteniendo una única composición de entrada. Un wrapper Promise para
`google.script.run`, routing cliente u optimismo visual son opciones, no requisitos universales.

Los DTOs que cruzan el puente contienen solo tipos serializables. La autorización siempre se
repite en el servidor.

## Persistencia y caché

Sheets puede ser fuente autoritativa para volúmenes compatibles con sus límites. Lee y escribe en
bloques, conserva IDs y evita búsquedas repetidas. `PropertiesService` sirve para configuración y
estado pequeño; `CacheService`, solo para información reconstruible.

Una caché por niveles puede combinar memo de ejecución, CacheService y almacenamiento
autoritativo. Cada nivel necesita alcance, TTL, invalidación y comportamiento ante datos obsoletos.
No existe memoria global fiable entre ejecuciones.

## Patrones condicionales

- **Puertos y adaptadores:** cuando el dominio debe probarse o cambiar de integración.
- **Lotes y puntos de control:** cuando volumen o duración se acercan a cuotas.
- **Spoke & Hub:** solo para múltiples nodos con gobierno central demostrado.
- **RBAC:** cuando las operaciones difieren por rol; la matriz vive en el dominio específico.
- **HMAC:** solo para canales firmados cuyo payload y firma puedan recuperarse de forma fiable.

## Decisiones y diagramas

La especificación incluye diagramas de contexto y flujo solo cuando aclaren relaciones reales.
Una decisión difícil de revertir se registra como ADR con contexto, decisión, alternativas,
consecuencias y estrategia de reversión.

## Señales de revisión

Revisa la arquitectura cuando aumenten sostenidamente duración, cuotas, filas, archivos, usuarios,
triggers o fallos de bloqueo; cuando una capa conozca detalles de otra; o cuando recuperar fallos
requiera intervención manual frecuente. Mide antes de introducir caché, particiones o servicios.

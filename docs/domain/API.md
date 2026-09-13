# Contratos de interfaz en Google Apps Script

## Responsabilidad documental

Este documento define reglas reutilizables para interfaces de Apps Script. El inventario real de
funciones, operaciones, parámetros y permisos de una aplicación pertenece exclusivamente a
`SPECIFICATION.md`.

No presupone que exista una API REST, un webhook ni un router.

## Tipos de interfaz

- **Triggers y eventos:** adaptan el evento recibido y delegan en un caso de uso.
- **Web app:** `doGet(e)` renderiza contenido; `doPost(e)` solo existe si el proyecto lo necesita.
- **Puente cliente-servidor:** `google.script.run` invoca funciones globales del servidor y usa
  handlers de éxito y fallo.
- **Integraciones HTTP salientes:** `UrlFetchApp` consume servicios externos; no convierte la
  aplicación en una API entrante.

Cada interfaz habilitada se registra en la especificación junto con su identidad de ejecución,
autorización y efectos externos.

## Contrato de entrada

1. Trata eventos, parámetros, hojas y propiedades como datos no confiables.
2. Normaliza tipos y formatos antes de aplicar reglas de negocio.
3. Rechaza campos desconocidos cuando puedan ampliar permisos o efectos.
4. Define límites de tamaño, cardinalidad y tiempo.
5. Si un reintento debe evitar efectos duplicados, define una clave estable de idempotencia;
   en otro caso, documenta el riesgo aceptado.

## Contrato de salida

Las fronteras cliente-servidor devuelven DTOs compuestos por `string`, `number`, `boolean`,
`null`, arrays y objetos literales. Fechas, IDs y enums se normalizan de forma explícita. No se
devuelven objetos `Range`, `File`, `Folder`, errores nativos ni secretos.

Un envoltorio uniforme como `{ success, data, error }` puede ser útil, pero se adopta por interfaz
y se documenta en la especificación; no debe duplicar el canal de error de
`google.script.run` sin una razón clara.

## Errores

- Los errores públicos son estables, accionables y no revelan trazas ni datos sensibles.
- Los detalles técnicos se registran en un canal restringido con contexto mínimo.
- Un fallo crítico aborta antes de notificar o divulgar recursos incompletos.
- Los fallos no críticos se distinguen explícitamente en la respuesta.

## Seguridad

Autoriza cada operación en el servidor; ocultar un botón no es control de acceso. Para interfaces
HTTP, documenta qué información entrega realmente el evento de Apps Script antes de elegir API
keys, OAuth o firmas. Los secretos viven fuera del repositorio y las comparaciones criptográficas
siguen una implementación revisada.

## Rendimiento y lotes

Una operación masiva admite paginación, lotes o puntos de control cuando pueda aproximarse al
límite de ejecución. El tamaño del lote se mide; no se fija universalmente. Las respuestas
obsoletas del frontend se descartan; los reintentos siguen el contrato de cada operación.

## Evolución

Los contratos públicos se mantienen compatibles o incluyen una migración. Todo cambio de nombre,
forma, autorización o semántica actualiza la especificación y sus pruebas de contrato.

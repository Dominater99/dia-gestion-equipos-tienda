# Estrategia de pruebas para Google Apps Script

## Responsabilidad documental

Este documento define qué comprobar y cómo separar pruebas locales, de sandbox e integradas. Los
comandos, suites y recursos concretos de cada aplicación se enumeran únicamente en
`../domain/SPECIFICATION.md`.

No define reglas de negocio ni procedimientos de publicación.

## Plan de pruebas por cambio

Antes de implementar un cambio con riesgo relevante, registra una matriz pequeña:

| Requisito o riesgo | Nivel | Caso positivo | Casos negativos/límite | Evidencia |
| --- | --- | --- | --- | --- |
| Comportamiento esperado | Local, contrato, sandbox o humo | Qué debe ocurrir | Qué debe rechazarse o recuperarse | Prueba o comprobación |

La matriz evita dos extremos: probar detalles internos sin valor o declarar cobertura sin relacionar
la prueba con un riesgo. Los cambios documentales o mecánicos pueden justificar una verificación
más pequeña; los de permisos, concurrencia, datos o publicación requieren evidencia mayor.

## Principios

- Prueba contratos observables y riesgos, no detalles internos accidentales.
- Mantén la mayoría de la lógica de dominio ejecutable fuera de los servicios de Google.
- Sustituye APIs de Apps Script por dobles pequeños y explícitos en pruebas locales.
- No simules tanto que dejes sin verificar el contrato real con Workspace.
- Toda prueba remota usa datos sintéticos, recursos identificables y limpieza controlada.
- Una repetición de la misma prueba no debe duplicar efectos ni depender del orden de ejecución.
- Una prueba controla reloj, zona horaria, aleatoriedad, identidad y datos cuando influyen.
- Cada fallo indica el contrato roto y ofrece suficiente contexto sin revelar secretos.
- No se actualiza un snapshot sin revisar y explicar el cambio observable.

## Convenciones de suite

- Nombra la prueba por comportamiento y resultado, no por función interna.
- Mantén Arrange–Act–Assert reconocible sin comentarios ceremoniales.
- Una prueba verifica un contrato principal y puede incluir varias aserciones relacionadas.
- Los fixtures son mínimos, explícitos y no comparten estado mutable entre casos.
- Usa builders solo cuando reduzcan ruido sin esconder valores importantes.
- Conserva tests junto al nivel y dominio definidos por la aplicación.
- Un bug corregido incorpora una prueba que falla antes del arreglo cuando sea viable.
- Evita esperas reales; inyecta reloj, promesas o señales controlables.
- No dependas del orden de archivos ni de efectos dejados por otra prueba.

## Niveles

### Pruebas locales

Validan funciones puras, DTOs, validación, permisos calculados, transiciones, serialización,
arquitectura y frontend. Deben ser rápidas, deterministas y no llamar a Google.

Incluyen reglas puras, normalización, serialización, allowlists, construcción de efectos y
controladores de navegador con DOM simulado. El doble local falla ante llamadas inesperadas para
que una dependencia nueva no pase desapercibida.

### Pruebas de contrato

Comprueban la forma de eventos, filas, respuestas, errores y adaptadores. Los mocks deben exponer
solo la superficie utilizada para que una dependencia nueva sea visible.

Un contrato de adaptador cubre entradas válidas, datos ausentes, errores de servicio, cuotas,
formas inesperadas y serialización. No afirma que Google se comporte así en producción; documenta
la expectativa que después se contrasta en sandbox.

### Pruebas en sandbox

Verifican aquello que un mock no demuestra: cuotas, scopes, identidad efectiva, triggers,
permisos heredados, Drive compartido, plantillas HTML y comportamiento de despliegues. Nunca se
ejecutan por defecto contra producción.

Cada prueba integrada declara cuenta ejecutora, proyecto, hoja o carpeta, datos permitidos, efectos
esperados, limpieza y coste de cuota. Si una comprobación no puede aislarse o revertirse, requiere
autorización específica y una alternativa de evidencia.

### Pruebas de humo

Después de publicar, confirman acceso, camino principal, logs, permisos y ausencia de duplicados.
No sustituyen la suite local ni las pruebas integradas.

Son breves, repetibles y tienen criterios de parada. No se aprovecha una prueba de humo para
migrar, limpiar o corregir datos reales.

## Pirámide y selección de nivel

La mayoría de reglas y casos límite se prueban localmente. Los contratos de integración se prueban
en menor número; sandbox demuestra capacidades que el mock no puede; humo confirma el despliegue.
No se fuerza un porcentaje universal entre niveles.

Usa el nivel más bajo capaz de demostrar el contrato y añade uno superior cuando el riesgo dependa
de identidad, scopes, permisos, cuotas, ejecución real o comportamiento de la plataforma.

## Casos mínimos por riesgo

- Entradas: valores vacíos, inválidos, duplicados, límites y caracteres especiales.
- Persistencia: cabeceras, escrituras por lotes, concurrencia y recuperación parcial.
- Drive: ubicación, acceso general, permisos directos y heredados, reintentos y aislamiento.
- Notificaciones: destinatarios, cuotas, fallo de envío y no distribución de enlaces inseguros.
- Interfaces: DTO serializable, autorización, errores estables y llamadas repetidas.
- Frontend: teclado, foco, accesibilidad, estados de carga/error y tamaños representativos.
- Rendimiento: volumen realista, número de llamadas remotas, duración y límites de cuota.

## Apps Script y Google Workspace

Verifica explícitamente cuando aplique:

- diferencia entre trigger simple, instalable, ejecución manual y web app;
- identidad efectiva del usuario y de la cuenta que ejecuta;
- allowlist de funciones globales y privacidad de helpers con sufijo `_`;
- serialización permitida por `google.script.run`;
- `withSuccessHandler` y `withFailureHandler`, doble envío y respuesta obsoleta;
- scopes del manifiesto y reautorización tras cambios;
- hoja vinculada frente a IDs configurados;
- cabeceras, filas físicas, celdas vacías, fórmulas y zonas horarias;
- permisos directos, heredados y generales de Drive;
- locks de usuario, script o documento y comportamiento de timeout;
- límites de Properties, Cache, Mail, Drive y tiempo de ejecución.

## Concurrencia, idempotencia y fallos parciales

Para una mutación, cubre al menos:

1. primera ejecución correcta;
2. repetición con la misma identidad;
3. dos ejecuciones concurrentes;
4. timeout antes del primer efecto;
5. fallo entre efectos externos;
6. fallo de compensación;
7. reintento después de un resultado incierto;
8. recuperación o reconciliación por ID.

Los dobles registran orden y cardinalidad de efectos. Una prueba no considera idempotente una
operación solo porque deduplica dentro de una ventana de caché.

## Frontend y accesibilidad

Las pruebas automáticas cubren estructura semántica, atributos, controladores, foco, mensajes y
estados. La revisión en navegador cubre aquello que jsdom no demuestra: layout, contraste real,
teclado, scroll, zoom, lectores de pantalla y responsive.

La matriz visual, breakpoints y estados están definidos en
[STYLE_GUIDE.md](STYLE_GUIDE.md). Evita duplicar allí la estrategia transversal de
pruebas.

Como mínimo verifica carga, vacío, error, disabled, éxito, textos largos y navegación completa por
teclado. Capturas o snapshots visuales requieren referencia estable, viewport declarado y revisión
humana de cambios intencionados.

## Rendimiento y cuotas

Una prueba de rendimiento declara dataset, entorno, calentamiento, número de repeticiones y métrica.
Mide duración total, llamadas remotas, bytes, filas, archivos, espera de locks y uso de cuotas según
el caso. No convierte una medición local simulada en afirmación sobre servicios reales.

Los umbrales concretos pertenecen a la especificación y se basan en una línea base. Una regresión
se investiga antes de ampliar timeout, lote o TTL.

## Dobles de Apps Script

Los dobles deben registrar lecturas y mutaciones relevantes, permitir inyectar fallos y conservar
el comportamiento mínimo necesario. Evita un objeto global universal que oculte dependencias.
Cuando Google cambie o exista duda sobre una API, añade una prueba de contrato en sandbox.

Un doble útil:

- registra argumentos, orden y número de llamadas;
- permite resultados y fallos inyectados por etapa;
- implementa solo métodos consumidos;
- no devuelve por defecto datos más permisivos que la API real;
- diferencia lectura, mutación y verificación;
- puede simular latencia o respuesta tardía sin usar esperas reales.

## Datos, fixtures y tiempo

- Usa emails, IDs, nombres y archivos inequívocamente sintéticos.
- No copies filas de producción para crear fixtures.
- Incluye Unicode, caracteres especiales, ceros iniciales y límites de tamaño.
- Inyecta fecha y zona horaria cuando afecten claves, cuotas o presentación.
- Los archivos de prueba tienen contenido y firma coherentes con su tipo.
- Un fixture compartido es inmutable o se recrea para cada caso.

## Cobertura, mutación y snapshots

La cobertura localiza caminos no ejecutados; no demuestra calidad, ausencia de riesgo ni contrato
con Workspace. No se fija un porcentaje universal. Los módulos críticos justifican qué ramas de
autorización, validación, concurrencia y recuperación están cubiertas.

Las pruebas de mutación pueden emplearse en reglas puras críticas para comprobar que las aserciones
detectan cambios. Los snapshots se limitan a salidas estables y revisables; no sustituyen aserciones
semánticas ni se regeneran automáticamente para hacer pasar la suite.

## CI, aislamiento y pruebas inestables

La comprobación local y CI usan versiones fijadas y comandos canónicos. CI no recibe credenciales
de producción ni ejecuta integraciones mutables salvo flujo separado, protegido y autorizado.

Una prueba inestable no se reintenta indefinidamente ni se ignora en silencio. Se registra causa,
propietario y límite temporal; se corrige aislamiento, reloj, dependencia o aserción. La cuarentena
es visible y no puede convertir una comprobación obligatoria en éxito permanente.

## Evidencia y limpieza

Cada ejecución informa comando, resultado y limitaciones. Los recursos temporales incluyen un
prefijo de prueba y un identificador único. La limpieza verifica IDs exactos y no usa búsquedas
amplias o destructivas. Si la limpieza falla, conserva la evidencia y registra el recurso.

La evidencia mínima indica revisión probada, comandos, resultado, entorno, fecha, limitaciones y
pruebas omitidas con su motivo. En integraciones registra IDs de recursos de forma restringida para
poder limpiarlos o investigarlos sin publicarlos.

## Plantilla de informe

```markdown
## Verificación

- Revisión/entorno:
- Comandos ejecutados:
- Resultado:
- Casos manuales:
- Recursos temporales y limpieza:
- Riesgos no cubiertos:
- Scopes, servicios o reautorización:
- Evidencia de rendimiento, si aplica:
```

## Criterio de salida

Un cambio está listo cuando pasan las comprobaciones aplicables, los riesgos no cubiertos están
declarados y cualquier cambio de scopes, configuración o datos tiene validación y reversión.

No se declara “todo probado” si existen niveles omitidos. Se informa exactamente qué fue verificado
y qué depende aún de sandbox, producción, permisos o revisión manual.

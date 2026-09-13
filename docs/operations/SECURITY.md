# Seguridad y privacidad para aplicaciones Google Apps Script

## Responsabilidad documental

Este documento contiene controles técnicos reutilizables. El canal de reporte de
vulnerabilidades vive en `../../.github/SECURITY.md`; los roles, scopes, ubicaciones y políticas
concretas de la aplicación viven en `../domain/SPECIFICATION.md`.

No sustituye una evaluación jurídica, de privacidad o de seguridad corporativa. Define el mínimo
técnico que debe concretarse y verificarse en cada aplicación.

## Modelo de amenazas y fronteras de confianza

Antes de implementar o publicar, la especificación identifica:

- usuarios legítimos, administradores, cuentas técnicas y posibles actores no autorizados;
- puntos de entrada: triggers, web app, `google.script.run`, menús, formularios y webhooks;
- datos recibidos desde navegador, Sheets, Drive, Properties y servicios externos;
- efectos posibles sobre filas, archivos, permisos, correos y sistemas de terceros;
- recursos compartidos, cuentas propietarias, unidades compartidas y herencia de permisos;
- amenazas relevantes y controles que las reducen;
- riesgo residual, propietario y condición para aceptar o bloquear la publicación.

Navegador, parámetros, eventos, hojas editables, nombres de archivo, respuestas HTTP y caché son
datos no confiables. Estar dentro del dominio de Workspace no convierte una entrada en confiable.

Una revisión ligera puede usar esta tabla:

| Activo o flujo | Amenaza | Impacto | Control preventivo | Detección/recuperación | Evidencia |
| --- | --- | --- | --- | --- | --- |
| Ejemplo sintético | Manipulación de entrada | Por evaluar | Validación en servidor | Log seguro y rechazo | Prueba negativa |

La tabla concreta pertenece a la especificación o a un análisis de riesgos enlazado desde ella.

## Identidad y autorización

- Documenta quién ejecuta la aplicación y qué identidad observan los servicios de Google.
- Autoriza en el servidor cada efecto externo; la interfaz no es una frontera de confianza.
- Mantén una lista cerrada de puntos de entrada y permisos por rol cuando exista RBAC.
- Revisa propietarios, activadores instalables y cuentas técnicas antes de publicar.

La matriz de autorización concreta enumera, por punto de entrada, identidad observada, roles
permitidos, alcance de datos, efectos y respuesta denegada. Se aplica denegación por defecto. Las
funciones globales invocables mantienen una allowlist revisada; un helper no destinado al exterior
usa el mecanismo de privacidad adoptado por Apps Script.

No se confunden autenticación, autorización y filtrado de interfaz:

- autenticación establece qué identidad puede demostrar la plataforma;
- autorización decide qué operación y recurso permite esa identidad;
- ocultar, deshabilitar o no renderizar un control solo mejora la experiencia.

## OAuth y servicios

- Declara solo los scopes necesarios para operaciones confirmadas.
- Prefiere el servicio de menor capacidad que cumpla el contrato.
- Justifica servicios avanzados, solicitudes externas y scopes amplios.
- Un cambio de scopes requiere revisión, prueba y posible reautorización.

Cada scope se relaciona con una llamada real y una capacidad de producto vigente. Antes de añadir
uno, se confirma que no existe un servicio menos privilegiado. Se revisan también servicios
avanzados, API asociada en Cloud, identidad facturable y restricciones administrativas del
dominio. Al retirar una capacidad se intenta retirar su scope y se comprueba la reautorización.

## Secretos y configuración

No almacenes secretos, tokens, IDs sensibles ni datos personales en Git. Usa el mecanismo de
configuración adoptado por la aplicación y limita quién puede administrarlo. Los logs nunca
incluyen cuerpos completos, credenciales ni listas innecesarias de destinatarios.

Para cada secreto se define propietario, ubicación autorizada, consumidores, rotación, revocación
y actuación ante exposición. No se imprime, devuelve al cliente, incluye en mensajes de error ni
se copia a entornos inferiores. Los IDs no son secretos por naturaleza, pero se tratan como
sensibles cuando revelan recursos internos o facilitan acceso indebido.

`PropertiesService` protege frente a inclusión accidental en Git, no frente a todas las personas
con acceso de edición al proyecto. Cuando ese modelo no sea suficiente se usa el gestor de secretos
aprobado por la organización.

## Validación, codificación y contenido activo

- Aplica allowlists de campos, enums, dominios, protocolos, MIME y tamaños.
- Normaliza antes de validar y valida de nuevo antes del efecto crítico.
- Escapa texto según el destino: HTML, atributo, URL, asunto, log o celda de Sheets.
- No inserta datos no confiables con `innerHTML`; usa `textContent` o sanitización revisada.
- Neutraliza prefijos de fórmula al persistir texto no confiable en Sheets.
- Rechaza cabeceras de correo con CR/LF y limita destinatarios y dominios.
- Valida firma real y contenido permitido de archivos, no solo extensión o MIME declarado.
- Construye URLs con APIs de URL y permite únicamente esquemas y hosts necesarios.
- No usa `eval`, `new Function` ni ejecución dinámica de texto no confiable.

La sanitización no reemplaza autorización ni validación de negocio. Cada frontera codifica para su
propio contexto; un texto seguro para HTML no es automáticamente seguro para una fórmula o URL.

## Solicitudes externas y webhooks

Las llamadas con `UrlFetchApp` usan hosts permitidos, HTTPS, límites de tamaño y tiempo, y fallan de
forma cerrada cuando la respuesta es autoridad para una mutación. No se permite que un usuario
elija libremente el host o protocolo de una petición servidor a servidor.

Un webhook entrante documenta autenticidad, protección frente a replay, ventana temporal,
idempotencia, límites, respuesta y conservación exacta del cuerpo firmado. Si Apps Script no
permite recuperar de forma fiable los bytes necesarios para comprobar una firma, no se promete
esa verificación y se elige otro canal o control.

## Frontend y navegador

- Mantén política CSP y dependencias remotas tan restrictivas como permita la plataforma.
- Usa `rel="noopener noreferrer"` al abrir destinos externos en otra pestaña.
- No confíes en campos ocultos, `localStorage` ni variables de JavaScript como autorización.
- Evita datos sensibles en DOM, URLs, historial, almacenamiento local y mensajes al cliente.
- Descarta respuestas asíncronas obsoletas sin aplicar su contenido o estado.
- Bloquea dobles envíos en cliente; usa idempotencia en servidor cuando el contrato de reintentos
  exija evitar duplicados.
- Muestra errores controlados; los detalles técnicos quedan en un canal restringido.

## Google Drive

Antes de distribuir un enlace:

1. valida la carpeta padre y el tipo de unidad;
2. comprueba acceso general, permisos directos y herencia;
3. conserva propietarios y cuentas técnicas necesarias;
4. concede únicamente los destinatarios y roles autorizados;
5. impide volver a compartir cuando el flujo y la plataforma lo permitan;
6. verifica el resultado después de mutar permisos.

`DriveApp` no cubre todos los detalles de permisos ni elimina herencia de unidades compartidas.
Si el aislamiento no puede demostrarse, la operación queda incompleta y no se divulga la URL.

Antes de mutar permisos se resuelve el ID exacto y se comprueba que el recurso pertenece al árbol
esperado. Se distingue entre permiso directo, heredado, acceso general, enlace, grupo y dominio.
Una API que elimina permisos directos no se presenta como mecanismo capaz de retirar herencia.

Las compensaciones de archivos nunca usan búsquedas amplias por nombre. Operan sobre IDs creados
por la ejecución y verifican el contenedor antes de mover o eliminar.

## Datos y validación

- Minimiza datos recogidos, persistidos y registrados.
- Valida emails, nombres, URLs, MIME, tamaños y valores de hojas en el servidor.
- Neutraliza fórmulas al escribir texto no confiable en Sheets.
- Define retención, archivo, eliminación y recuperación según la especificación.
- No uses datos de producción en pruebas sin autorización explícita.

La especificación clasifica los datos y declara finalidad, minimización, ubicación, acceso,
retención, recuperación y eliminación. Una columna disponible no justifica recolectarla. Las
exportaciones, correos y logs aplican el mismo criterio de minimización que la hoja principal.

La eliminación o anonimización masiva exige alcance por IDs, simulación, copia recuperable,
aprobación y evidencia. Si existe obligación de conservación, se documenta la excepción y quién la
autoriza.

## Integridad y disponibilidad

Aplica bloqueos a mutaciones concurrentes, IDs estables a operaciones repetibles y compensación
segura a fallos parciales. Si se admiten reintentos sin duplicados, protégelos con idempotencia;
si no, documenta el riesgo. Los límites de cuota y los timeouts se observan; no se ocultan
ampliando umbrales sin medir.

Los bloqueos tienen alcance, espera máxima y comportamiento de timeout. Cuando se use una identidad
idempotente, se asigna antes del primer efecto y se comprueba dentro de la sección crítica. Cada secuencia con más
de un efecto declara qué se revierte, qué se reconcilia y qué se deja para recuperación manual.

Se limita frecuencia, cardinalidad, tamaño y volumen acumulado antes de operaciones costosas. La
caché solo contiene información reconstruible y nunca amplía permisos respecto de la fuente.

## Dependencias y cadena de suministro

- Fija versiones de dependencias y conserva el lockfile cuando exista.
- Revisa origen, licencia, mantenibilidad, permisos y código ejecutado en build.
- Minimiza scripts de instalación y dependencias transitivas.
- Audita vulnerabilidades con la herramienta adoptada y evalúa aplicabilidad, no solo severidad.
- No carga JavaScript remoto no fijado dentro de una aplicación privilegiada.
- Verifica que artefactos generados proceden de fuentes revisadas.
- Registra y retira dependencias abandonadas o capacidades ya no utilizadas.

Un hallazgo de herramienta no se ignora en silencio: se corrige, se mitiga o se acepta con alcance,
razón, propietario y fecha de revisión.

## Logs y auditoría

Los eventos usan nombres estables, timestamp, etapa, resultado, correlación técnica y contexto
mínimo. Seudonimiza o elimina PII cuando no sea necesaria. No se registran payloads completos,
tokens, contenido de archivos, URLs privadas ni destinatarios completos.

La especificación define acceso, retención, alertas y mecanismo para localizar una operación sin
exponer al usuario información interna. Los fallos del logger no deben ocultar el resultado del
caso de uso; se conserva una señal alternativa cuando la auditoría sea crítica.

## Incidentes

Ante una posible exposición: contiene el efecto, identifica recursos exactos, preserva evidencia,
evalúa permisos directos y heredados, informa por el canal privado y valida la corrección antes de
reactivar el flujo. Una corrección masiva requiere simulación y aprobación.

Clasificación orientativa:

| Severidad | Ejemplo de impacto | Respuesta |
| --- | --- | --- |
| Crítica | Exposición activa amplia, credencial o control total | Contención inmediata y escalado |
| Alta | Acceso indebido o pérdida relevante con alcance limitado | Contención prioritaria e investigación |
| Media | Control degradado sin exposición confirmada | Mitigación planificada y seguimiento |
| Baja | Mejora preventiva o desviación sin impacto actual | Corrección ordinaria |

El procedimiento concreto identifica responsable, canal privado, preservación de evidencia,
comunicación, criterios de reactivación y revisión posterior. No se fijan SLA genéricos que la
organización no haya aprobado.

## Revisión por tipo de cambio

| Cambio | Verificación mínima adicional |
| --- | --- |
| Punto de entrada nuevo | Identidad, autorización, allowlist, límites y errores públicos |
| Scope o servicio nuevo | Necesidad, cuenta ejecutora, reautorización y retirada |
| Escritura en Sheets | Esquema, fórmula, concurrencia, idempotencia y recuperación |
| Archivo o permiso de Drive | Árbol, herencia, acceso general, enlace y compensación |
| Email o notificación | destinatarios, inyección de cabecera, cuota y privacidad |
| API externa | host, HTTPS, timeout, tamaño, disponibilidad y datos enviados |
| Dependencia frontend | CSP, integridad, licencia, peso y ejecución de código |
| Dato personal nuevo | finalidad, minimización, acceso, retención y eliminación |

## Verificación mínima

- Manifiesto y scopes auditados.
- Acceso anónimo y de dominio comprobado según el modelo elegido.
- Casos positivos y negativos de autorización.
- Permisos de Drive verificados en las ubicaciones utilizadas.
- Logs sin información sensible.
- Reintentos y fallos parciales sin duplicados ni divulgación prematura.
- Entradas maliciosas o límite rechazadas antes de efectos costosos.
- Salidas HTML, URLs, correo, logs y Sheets codificadas para su contexto.
- Dependencias y artefactos generados trazables a versiones revisadas.
- Caché, errores y telemetría sin ampliación de permisos ni exposición de datos.
- Procedimiento de incidente y recuperación practicable por una segunda persona.

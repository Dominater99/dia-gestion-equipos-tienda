# Implementación preparada para pruebas — 24 de octubre de 2026

Las reglas vigentes y la prueba manual están en
[la especificación](../domain/SPECIFICATION.md#6-reglas-del-formulario) y su
[procedimiento de pruebas](../domain/SPECIFICATION.md#112-prueba-funcional-de-la-implementación-migrada).
Este documento registra la entrega y sus evidencias, no sustituye ese contrato.

## Estado

- Fuentes TEST enviadas al proyecto y conservadas como versión inmutable 30.
- El despliegue de producción permanece en la versión 27. No se ha creado ni actualizado
  un despliegue web de pruebas: Google requiere una cuenta del dominio del propietario.
- Las ocho pestañas TEST están preparadas; los cambios de contenido se limitaron a
  TEST_Elementos, TEST_Sistema, TEST_Logs y la nueva TEST_Campos_peticion.
- No se ha ejecutado ningún alta ni enviado un correo real desde Apps Script en esta entrega.
  Las altas de navegador emplearon servicios simulados y datos sintéticos locales.

## Implementado

- Catálogo único de quince campos y captura por petición con estados oculto, opcional y
  obligatorio. Etiquetas, ayudas y orden configurables; validación de catálogo e invariantes;
  control de revisión al enviar y actualización del formulario conservando datos aplicables.
- Payload de servidor construido mediante una lista explícita de campos públicos. Descarte
  de propiedades internas y campos ocultos; comprobación completa de Registros antes del ID.
- Sistema leído por cabecera, con categorías y descripciones, claves únicas y LOGO_URL
  resuelto conjuntamente para web y correo. Límites técnicos en constantes versionadas.
- Logs nuevo de seis columnas, motivos estructurados y compatibilidad con el histórico de siete.
- Gestiones generales accesibles, salto de proveedor único, requisitos pendientes con acceso
  al control, borradores en memoria, radios nativos y conservación de imágenes al volver.
- Validación del orden de periodos, tratamiento literal de llaves en comentarios y bloqueo de
  selecciones de foto inválidas, también cuando el campo es opcional.
- Visibilidad por rol de cada opción mediante `rol_visible`, con autorización común para el
  menú, búsqueda de tiendas y registro. El rol se resuelve en servidor, antes de devolver esquemas.

## Datos de prueba preparados

- 44 opciones y 660 filas de configuración en una tabla nativa con desplegables.
- Columna N `rol_visible` añadida únicamente a TEST_Elementos: las 44 opciones conservan
  `TODOS`. Desplegable estricto con TODOS y los tres roles hasta la fila 1006, nota explicativa
  y cabecera con el formato existente. La columna N original continúa vacía.
- 11 parámetros en TEST_Sistema, con cuatro columnas. Retiradas únicamente de la copia las
  cinco filas de límites técnicos; permanecen en la pestaña original para su versión actual.
- TEST_Logs vacío con su cabecera de seis columnas, sin borrar ningún histórico original.
- Se verificaron por lectura los 660 campos, los parámetros y los seis IDs corregidos.
  Los nombres, posiciones y dimensiones de las pestañas originales permanecen iguales.

Se encontraron tres IDs repetidos, cada uno compartido por Font Vella, Danone y Heineken.
Solo en TEST se sustituyeron los prefijos erróneos de las tres filas de Font Vella y de las tres
de Heineken. Se conservaron las filas y los IDs de Danone. La corrección de producción necesita
una migración independiente que considere su histórico; no se ha realizado aquí.

## Evidencia de verificación

- `npm run check`: ESLint y 195 pruebas correctas en 14 suites.
- Diez casos nuevos verifican roles permitidos, compatibilidad con columna ausente, caché
  compartida sin filtraciones entre roles, configuración inválida, rechazo de IDs ocultos y
  roles falsificados, retirada de permiso con formulario abierto y alta de un movimiento permitido.
- `npm run deploy:test -- --dry-run`: paquete TEST generado y validado sin acceder a Google.
- `npm run deploy:test -- --stage-only`: versión TEST 30 preparada y conservación de los
  despliegues versionados comprobada después del envío.
- Navegador local, escritorio 1280×800 y móvil 360×800: selección de gestiones generales,
  formulario, requisitos pendientes, resolución de tienda, conservación de comentarios,
  alta completa con comentario que contiene llaves, teclado SI/NO y foto conservada al volver.
- Google Sheets: lectura completa de los rangos escritos, estructura de tabla, tipos,
  opciones de desplegables y cobertura hasta la fila 661. La visualización nativa solicitó
  una sesión de Workspace; por ello el ajuste visual de Sheets se verificó solo mediante
  metadatos de formato y dimensiones, no mediante captura de una sesión autenticada.
- `git diff --check`: correcto. Buzón, IDs de recursos, instantáneas y paquetes generados
  se mantienen en archivos locales excluidos de Git.

## Pendiente de integración

Crear la implementación web TEST con una cuenta del dominio propietario y ejecutar la prueba
manual de la especificación. Quedan por verificar identidad real, correo real al único buzón
autorizado, permisos efectivos, cuotas y concurrencia de Google. No se han añadido scopes,
servicios avanzados, triggers ni puntos públicos de administración.

No hay una medición de latencia de Apps Script: los tiempos de la suite local no la representan.
Se mantiene la limitación conocida de ausencia de idempotencia persistente: un reintento tras
perder una respuesta puede duplicar el alta. Los estados compartidos y el cupo diario siguen
consumiéndose durante las pruebas, según lo acordado.

# Especificación de Solicitudes de elementos de layout

## 1. Responsabilidad documental

Este documento es el perfil específico de la aplicación. Define producto, arquitectura adoptada,
datos, interfaces, configuración, diseño, seguridad y operación. Los estándares reutilizables
permanecen en los documentos especializados enlazados desde `AGENTS.md`.

Cuando este documento, el código, el manifiesto o las pruebas diverjan, el comportamiento no debe
cambiarse en silencio: se confirma el contrato y se actualizan conjuntamente sus fuentes.

## 2. Propósito y alcance

La aplicación es una web app corporativa de Google Apps Script para registrar solicitudes de
elementos físicos de tienda:

- neveras;
- lockers;
- cafeteras.

No utiliza triggers simples ni instalables. Las operaciones de la aplicación se originan en la
web app; los datos maestros se mantienen directamente en Sheets. La limpieza diaria de `Logs`
también es manual; no se programa ningún proceso en segundo plano.

El catálogo se configura en la pestaña `Elementos`. Una fila activa representa una opción final
del menú y determina equipo, proveedor, tipo de gestión, texto visible, necesidad de ServiceNow,
filtro de tiendas y destinatario adicional.

El flujo es:

1. comprobar identidad y autorización;
2. elegir equipo;
3. elegir proveedor cuando el equipo lo tenga;
4. elegir la gestión configurada;
5. completar el formulario dinámico;
6. volver a autorizar y validar en servidor;
7. generar un identificador, escribir una fila en `Registros` y enviar la confirmación;
8. volver al inicio después de una alta correcta.

Quedan fuera de alcance aprobación, seguimiento, edición, cancelación, histórico,
estadísticas, exportaciones, administración desde la web y APIs HTTP entrantes. Se admiten
los campos de foto del catálogo técnico: sus imágenes se adjuntan al correo sin persistirlas.

## 3. Plataforma

- Runtime: Google Apps Script V8.
- Zona horaria: `Europe/Madrid`.
- Aplicación vinculada: `SpreadsheetApp.getActiveSpreadsheet()`.
- Web app: `executeAs: USER_DEPLOYING` y `access: DOMAIN`.
- Servicios usados: Spreadsheet, Session, Lock, Utilities, Html, Mail, Cache y Properties.
- Servicios avanzados: ninguno.
- Desarrollo local: Node.js `>=20.19.0`, Jest y clasp.

El manifiesto canónico es `src/appsscript.json`. No se declaran scopes explícitos; cualquier
cambio de servicios debe revisar los scopes inferidos y la posible reautorización.

## 4. Arquitectura y nomenclatura

Apps Script comparte un espacio global y no ofrece módulos nativos en ejecución. Para hacer
explícito el orden de dependencia se usan prefijos numéricos dentro de dos carpetas:

```text
src/
  appsscript.json         manifiesto
  backend/
    00_constants.js       contratos y valores cerrados
    01_environment.js     selección fija de pestañas y correo por paquete
    10_sheet_gateway.js   adaptador común de Sheets
    20_config_service.js  configuración de Sistema
    21_element_service.js catálogo configurable
    22_store_service.js   búsqueda y ámbito de tiendas
    23_log_service.js     auditoría operativa mínima
    24_rate_limit_service.js protección de intentos por cuenta
    25_delegation_service.js contactos configurados por delegación
    26_form_schema_service.js esquema de captura y validación de configuración
    30_auth_service.js    identidad y acceso
    31_mail_service.js    confirmaciones
    32_request_service.js caso de uso de alta
    90_web_entrypoint.js  doGet
  frontend/
    00_styles.html        tokens y estilos responsive
    10_navigation.html    estado, acceso y navegación
    20_form.html          campos y búsquedas
    30_validation_submit.html validación y envío
    99_index.html         estructura y configuración inyectada
```

Los archivos usan minúsculas y `snake_case`; el prefijo tiene dos dígitos. Las funciones y
variables JavaScript usan `camelCase`, las constantes `UPPER_SNAKE_CASE` y las funciones
internas terminan en `_`. Los nombres físicos de hojas, columnas y estados mantienen el idioma y
la capitalización definidos en este documento.

La arquitectura es deliberadamente pequeña: presentación, caso de uso, servicios y adaptador de
Sheets. No se introducen build de frontend, router ni repositorios adicionales. Las lecturas de
maestros usan `CacheService` con TTL configurable y reconstrucción desde la hoja.
`doGet()` carga `frontend/99_index` como plantilla; esta incorpora los cuatro fragmentos locales
en orden con `HtmlService.createHtmlOutputFromFile()`. `clasp push` no requiere generar `dist/`.

## 5. Datos

El contrato migrado utiliza ocho pestañas: siete de operación y `Logs` para auditoría mínima.
En el entorno de pruebas sus nombres llevan el prefijo `TEST_`.

### 5.1. `Usuarios`

Cabeceras, en orden:

```text
email, nombre, estado, rol, ambito, delegacion
```

Una cuenta está autorizada cuando existe una fila con su email, `estado=ACTIVO` y uno de estos
roles:

- `ADMINISTRADOR`;
- `GESTOR_GLOBAL`;
- `GESTOR_DELEGACION`.

`ADMINISTRADOR` y `GESTOR_GLOBAL` ven todas las filas de `Tiendas`.
`GESTOR_DELEGACION` con `ambito=DELEGACION` solo puede consultar las filas cuya
`delegacion_desc` coincide con `Usuarios.delegacion` sin distinguir mayúsculas; si no se cumple
el ámbito, no obtiene tiendas. El filtrado se repite en servidor al registrar.

### 5.2. `Tiendas`

Cabeceras:

```text
apnut, tienda_id, delegacion_desc, planograma_desc, agr_comercial_id,
agr_comercial_desc, metros_totales, almacen_desc, direccion, municipio,
provincia, estado
```

La hoja real puede incluir más columnas; la aplicación solo proyecta estas doce y no almacena
otras en caché. `tienda_id` se trata como texto para conservar ceros iniciales y admite de uno a
cinco dígitos. Los estados reconocidos son `Abierta` y `Cerrada` (comparación sin mayúsculas).
Las gestiones con `solo_tiendas_abiertas=SI` solo aceptan una tienda abierta. La interfaz consulta
el código exacto al pulsar «Buscar» (o Intro), con un overlay, y reemplaza la entrada por la tarjeta DIA de tienda validada,
conservando el título del campo; la acción «Cambiar tienda» devuelve la entrada. Muestra APNUT,
planograma, agrupación comercial, superficie, identificador, delegación, almacén y dirección.
No descarga el maestro completo. El servidor vuelve a validar el ámbito y persiste
`tienda_id - direccion, municipio`.

Una URL puede incluir el parámetro opcional `tienda` con un código de uno a cinco dígitos, por
ejemplo `?tienda=0001`. Después de superar `checkAccess`, la aplicación lo consulta mediante el
mismo `lookupStore` que usa la búsqueda manual, con el elemento elegido. Si el formulario es un
movimiento lo aplica como tienda de origen, persistida en `tienda_origen`; en el resto, como
`tienda`. La precarga se mantiene al volver, cambiar de gestión o registrar una solicitud, y solo
se descarta durante la sesión al pulsar «Cambiar tienda». La URL no acredita
permisos ni evita las validaciones de usuario, elemento, ámbito, estado de tienda o alta final.

### 5.3. `Elementos`

Cabeceras:

```text
id_elemento, equipo, proveedor, tipo_gestion, subtipo, etiqueta, estado,
requiere_service_now, solo_tiendas_abiertas, email_copia, email_destino, mensaje_email, orden, rol_visible
```

Contratos:

- `id_elemento` es estable y único;
- `equipo`: `NEVERA`, `LOCKER` o `CAFETERA`;
- `estado`: `ACTIVE` o `INACTIVE`;
- `requiere_service_now` y `solo_tiendas_abiertas`: `SI` o `NO`;
- `orden` controla el orden ascendente del menú;
- `email_copia` es opcional y define uno o varios destinatarios en copia separados por comas;
- `email_destino` define uno o varios destinatarios principales separados por comas cuando tiene valor;
- `mensaje_email` es obligatorio y contiene el cuerpo literal del correo de registro para esa opción;
- `proveedor` y `subtipo` pueden quedar vacíos.

`rol_visible` admite `TODOS`, `ADMINISTRADOR`, `GESTOR_GLOBAL` o `GESTOR_DELEGACION`.
La columna ausente o vacía equivale a `TODOS`, siempre dentro de los usuarios autorizados.
Un rol concreto permite únicamente ese rol, sin privilegio implícito del administrador ni listas
de varios roles. Se normalizan espacios externos y mayúsculas; cualquier otro valor produce un
error de configuración. Se aplica a cualquier gestión, incluidos los movimientos: filtra el menú
y se comprueba de nuevo en servidor antes de consultar tiendas, devolver un formulario actualizado
o registrar. El rol se obtiene de Usuarios; nunca del formulario. El catálogo en caché se comparte,
pero el filtrado se calcula para cada usuario. Los cambios se aplican al vencer el TTL corto;
recargar la web actualiza las opciones visibles. No se revocan permisos antes de vencer esa caché.
La preparación de pruebas añade esta columna con desplegable solo en `TEST_Elementos`, inicialmente
con `TODOS` en las opciones existentes. La pestaña de producción se conserva.

En libros migrados, `requiere_service_now` es una columna heredada: el estado del campo
`codigo_servicenow` en `Campos_peticion` determina si aparece y si es obligatorio. El servidor
deriva el valor efectivo para el histórico. No se mantiene una segunda regla editable.
El catálogo rechaza IDs vacíos o duplicados, equipos, gestiones o estados desconocidos y valores
distintos de SI/NO en los indicadores. Una opción inactiva puede prepararse antes de añadir sus
campos; una activa sin configuración completa produce un error de configuración.

Además de las columnas de `Elementos` y `Registros`, `mensaje_email` admite los marcadores
`{{delegacion_contacto}}`, `{{delegacion_email_contacto}}` y `{{delegacion_tlf_contacto}}`.
Se resuelven con la delegación de la tienda validada —en un movimiento, la tienda de origen— y
la pestaña `Parametros_delegacion`. Si el mensaje no usa estos marcadores, esa pestaña no se
consulta.

Tipos de gestión cerrados:

- `NUEVA_SOLICITUD`;
- `MOVIMIENTO`;
- `DESCONEXION_TEMPORAL`;
- `RETIRADA`;
- `INCIDENCIA_SERVICENOW`;
- `RECLAMACION_SIN_PARTE`;
- `ERROR_PANTALLA`, únicamente para Cafetera.

El catálogo se mantiene manualmente en la pestaña; la aplicación no inserta filas de ejemplo. Para
habilitar la nueva opción se añade manualmente una fila como esta, ajustando `email_copia`,
`email_destino`, `mensaje_email` y `orden` si corresponde:

```text
CAF-ERROR-PANTALLA, CAFETERA, , ERROR_PANTALLA, , Error en pantalla, ACTIVE, NO, NO, , , Mensaje de correo, 30
```

### 5.4. `Parametros_delegacion`

Cabeceras:

```text
delegacion, contacto, email_contacto, tlf_contacto
```

`delegacion` coincide con `Tiendas.delegacion_desc` sin distinguir mayúsculas ni espacios
exteriores y debe ser única. Cuando un `mensaje_email` usa un marcador de contacto de delegación,
la aplicación requiere una fila correspondiente; de no existir o estar duplicada, rechaza la
solicitud antes de registrarla. Sus valores se incorporan solo al correo y no se guardan en
`Registros`.

### 5.5. `Sistema`

Cabeceras:

```text
clave, valor, categoria, descripcion
```

| Parámetro | Valor inicial | Uso |
|---|---|---|
| `ENTORNO` | `PROD` | Entorno declarativo. |
| `CACHE_HABILITADA` | `TRUE` | Activa las lecturas en `CacheService`. |
| `CACHE_TTL_CORTO_SEGUNDOS` | `5` | TTL de Usuarios, Elementos y Sistema. |
| `CACHE_TTL_LARGO_SEGUNDOS` | `100` | TTL de Tiendas y Parametros_delegacion. |
| `EMAIL_ADMIN` | Correo definido manualmente | Destinatario del enlace para solicitar acceso. |
| `EMAIL_CC_SOPORTE` | `dia.es.soporte.layouts@diagroup.com` | Copias de soporte para confirmaciones; admite direcciones separadas por comas. |
| `NOMBRE_REMITENTE_EMAIL` | `Dia Layouts` | Nombre visible del remitente del correo. |
| `ASUNTO_EMAIL` | `[Gestión equipos]-{{equipo}}-{{tipo_gestion}}- {{tienda}}-{{provincia}}-{{municipio}}-{{direccion}}` | Plantilla del asunto. Durante la transición se acepta `ASUNTO_EMAL` si no existe esta clave. |
| `URL_APP_COBERTURA` | `www.dia.es` | Texto de ayuda que se muestra bajo Foto cobertura en Nueva solicitud de Locker. |
| `LIMITE_REGISTROS_DIARIOS_USUARIO` | `10` | Máximo de registros guardados por usuario y día de `Europe/Madrid`; entero positivo ampliable. |
| `LOGO_URL` | Logo oficial DIA | Logo compartido por web y correo. HTTPS en `www.dia.es`; vacío utiliza el valor oficial del código. |

`Sistema` se crea y mantiene manualmente; la aplicación no dispone de `setupSistema` ni añade
parámetros ausentes. Nombre y versión de la aplicación viven solo en `APP_METADATA`, no en esta
pestaña. `ULTIMO_ID_PETICION` es una propiedad de script, no una fila de `Sistema`.
La primera alta inicializa el contador para emitir primero el ID 1; cada alta posterior incrementa
esa única propiedad dentro del mismo bloqueo que protege la escritura en `Registros`.
No edites el contador mientras haya usuarios registrando solicitudes. Si falta una clave de caché,
se aplican `TRUE`, 5 y 100 segundos como valores predeterminados. La caché de script almacena
maestros reconstruibles, por fragmentos, no credenciales, y la configuración se invalida al
escribirla desde el código; las ediciones manuales surten efecto tras el TTL vigente.
Los fragmentos se leen, escriben y eliminan con operaciones por lotes de `CacheService`.
La lectura identifica `clave` y `valor` por cabecera; acepta el nombre heredado `parametro`.
`categoria` y `descripcion` son ayudas de mantenimiento, no reglas ejecutables. Se rechazan claves
duplicadas. `SYSTEM_PARAM_METADATA` mantiene sus descripciones canónicas. Los cinco parámetros
de protección por ventanas se retiran de Sistema: los valores efectivos viven en constantes
versionadas y las filas heredadas, si existen, se ignoran. El cupo diario sigue siendo funcional.

### 5.6. `Registros`

Cabeceras, en orden:

```text
id_peticion, timestamp_registro, email_usuario, nombre_usuario,
delegacion_usuario, id_elemento, etiqueta_elemento, equipo, proveedor,
tipo_gestion, subtipo, tienda, tienda_origen, tienda_destino,
fecha_limite_recogida, fecha_inicio, fecha_fin, fecha_maxima_retirada,
necesita_codigo_servicenow, codigo_servicenow, comentarios, enchufe_disponible,
toma_agua_disponible
```

Las columnas no aplicables a una gestión se guardan vacías. En movimientos y retiradas de cualquier
equipo, la fecha se guarda en `fecha_maxima_retirada`; `fecha_limite_recogida` se conserva únicamente
por compatibilidad con registros históricos. El texto que comienza por `=`, `+`,
`-` o `@` se prefija para impedir que Sheets lo evalúe como fórmula.
`necesita_codigo_servicenow` conserva el valor efectivo del elemento en el momento del alta; es
una instantánea histórica deliberada, aunque el maestro `Elementos` cambie después.
El servidor descarta tiendas, fechas, códigos ServiceNow, disponibilidades y fotos no aplicables
aunque el navegador los envíe; solo se persisten los campos correspondientes al elemento seleccionado.
`enchufe_disponible` y `toma_agua_disponible` contienen `SI` o `NO` cuando el campo está visible y
se rellena según el esquema de la petición; las fotos nunca se escriben en `Registros`. Antes de habilitar esa gestión en una hoja
existente se añaden ambas cabeceras al final de `Registros`; si faltan, el servidor rechaza el alta
antes de asignar ID, escribir una fila o enviar correo.
`Registros` se prepara manualmente; si falta o no tiene las columnas obligatorias, no se registra
la solicitud. Se comprueban las 23 columnas del contrato antes de asignar ID o escribir: ningún
campo se puede perder silenciosamente por una cabecera incompleta. Las antiguas `clave_idempotencia` y `huella_solicitud` ya no se crean ni se usan;
si siguen presentes, las nuevas filas las dejan vacías. No se eliminan datos automáticamente.

### 5.7. `Logs`

Cabeceras, en orden:

```text
fecha, nivel, evento, email, id_solicitud, contexto
```

La aplicación añade un evento por intento de alta aceptado por el limitador:
`SOLICITUD_REGISTRADA`, `SOLICITUD_RECHAZADA` o `NOTIFICACION_FALLIDA`. Al exceder el umbral,
solo el primer intento bloqueado de cada ventana añade `LIMITE_ENVIOS_EXCEDIDO`; los posteriores
no escriben en la hoja para evitar amplificación. Un estado corrupto del limitador de envíos
añade `ESTADO_LIMITE_INVALIDO`; solo si ese evento queda registrado se elimina el valor corrupto
observado para que el siguiente intento pueda abrir una ventana nueva. `email` identifica al solicitante;
`id_solicitud` contiene el ID si llegó a generarse. El esquema nuevo elimina `mensaje`, que era
una descripción fija del evento. El logger también admite el esquema anterior de siete columnas,
sin modificar su cabecera ni su histórico.
`contexto` es un objeto JSON de hasta 1.000 caracteres con `etapa` y, cuando ya se ha resuelto el
elemento, `idElemento`, `equipo`, `proveedor`, `tipoGestion` y `subtipo`; los valores vacíos se
omiten. En registros completados incluye `notificacionEnviada`; en rechazos y fallos de correo
incluye un `motivo` estable, por ejemplo `FECHA_NO_FUTURA`, `CAMPO_REQUERIDO`,
`CONFIGURACION_INVALIDA`, `FORMULARIO_ACTUALIZADO` o `ENVIO_CORREO_FALLIDO`. No se guardan excepciones,
tienda, comentarios, fechas, códigos ServiceNow, asunto ni destinatarios. Si falta la pestaña, el
primer evento la crea bajo `LockService`.
Un fallo del logger se comunica en la consola con un mensaje estático y no cambia el resultado
del alta. `Logs` hereda los permisos del libro. Su limpieza la realiza manualmente el
responsable cada día; la aplicación no borra ni archiva registros automáticamente.

Los fallos internos de `submitRequest` se registran aparte mediante `console.error(Error)` en
las ejecuciones de Apps Script, con etapa, mensaje y traza saneados; no se copian a `Logs` ni se
devuelven al usuario. Los errores de validación controlados y los bloqueos por límite no generan
una excepción técnica en consola. Si la llamada ni siquiera llega al servidor, el navegador
registra el fallo de `google.script.run` en su propia consola.

## 6. Reglas del formulario

### 6.1. Campos por petición

`Campos_peticion` utiliza las columnas `id_elemento, campo, estado, orden, etiqueta, ayuda`.
Una fila identifica un campo de una opción, sin repetir la pareja `id_elemento, campo`.
`estado` admite `OCULTO`, `OPCIONAL` y `OBLIGATORIO`; `orden` es un entero no negativo.
Etiqueta y ayuda admiten hasta 150 y 500 caracteres; vacías recuperan los textos del catálogo.
Una fila ausente no muestra el campo. Para facilitar mantenimiento, la migración genera los
quince campos conocidos por opción, incluidos los ocultos.

| Campo | Tipo | Destino |
|---|---|---|
| `tienda`, `tienda_origen`, `tienda_destino` | Tienda validada | Columna correspondiente de Registros |
| `fecha_inicio`, `fecha_fin`, `fecha_maxima_retirada` | Fecha futura | Columna correspondiente de Registros |
| `codigo_servicenow` | Código TASK | `codigo_servicenow` |
| `enchufe_disponible`, `toma_agua_disponible` | SI/NO | Columna correspondiente de Registros |
| `comentarios` | Texto | `comentarios` |
| `foto`, `foto_horario`, `foto_cobertura`, `foto_ubicacion`, `foto_layout` | Imagen JPEG o PNG | Adjunto temporal del correo |

Los campos ocultos y cualquier propiedad interna aportada por el navegador se descartan en
servidor. Los opcionales se validan si tienen valor. Se puede reutilizar cualquier campo del
catálogo en una opción existente sin cambiar código; un componente nuevo o una semántica de
gestión nueva requiere implementación. No se ejecutan fórmulas ni JSON introducidos como reglas.

Las tiendas son invariantes: MOVIMIENTO requiere origen y destino distintos y no utiliza tienda
única; el resto requiere una tienda única. DESCONEXION_TEMPORAL requiere inicio y fin. Si ambos
extremos de cualquier periodo tienen valor, fin no puede ser anterior a inicio; se admite un
periodo que empiece y termine el mismo día, siempre futuro.

El servidor resuelve el esquema para menú, validación y normalización. El navegador recibe solo
los datos de presentación, `formFields` y `formRevision`, sin destinatarios ni cuerpo de correo.
Al registrar un libro migrado debe presentar la revisión recibida: si cambió, se rechaza antes de
asignar ID y se devuelve el esquema actualizado. La interfaz conserva los datos todavía aplicables
y solicita confirmar de nuevo tiendas y código. Las ediciones manuales se reflejan tras el TTL.
En TEST la pestaña es obligatoria. La ausencia de Campos_peticion en un libro aún no migrado
mantiene los valores iniciales anteriores; no se utiliza este mecanismo para ocultar errores de
una pestaña existente mal formada.

### 6.2. Valores iniciales y validadores

La tabla siguiente describe la configuración inicial reproducida por la migración. Después,
`Campos_peticion` es la fuente de visibilidad y obligatoriedad, respetando las invariantes anteriores.

| Gestión | Campos obligatorios | Campos condicionales |
|---|---|---|
| `NUEVA_SOLICITUD` | tienda | en Cafetera: enchufe, toma de agua, foto de ubicación y foto de layout; en Locker: enchufe, fotos de horario, cobertura, ubicación y layout |
| `MOVIMIENTO` | tienda de origen y destino | fecha máxima de retirada opcional para cualquier equipo |
| `DESCONEXION_TEMPORAL` | tienda, fecha de inicio y fin | — |
| `RETIRADA` | tienda | fecha máxima de retirada obligatoria para lockers y opcional para neveras y cafeteras |
| `INCIDENCIA_SERVICENOW` | tienda | código ServiceNow si la fila lo requiere |
| `RECLAMACION_SIN_PARTE` | tienda | — |
| `ERROR_PANTALLA` de Cafetera | tienda, foto y comentarios | — |

En `MOVIMIENTO`, tienda de origen y tienda de destino deben ser distintas. Todas las fechas
introducidas, incluidas las opcionales, deben ser fechas de calendario válidas en formato
`AAAA-MM-DD` y posteriores al día actual de `Europe/Madrid`: hoy y las fechas pasadas no son
válidas. La interfaz fija el mínimo en mañana y desactiva el botón de registro si una fecha no
cumple la regla; el servidor la repite antes de generar el ID o escribir en `Registros`.

Cuando se requiere ServiceNow, el formato es `TASK` seguido exactamente de siete dígitos.
El botón «Introducir» (o Intro) confirma visualmente el código antes de habilitar el alta.
Tras confirmar un código válido, la interfaz muestra el aviso: «Te recordamos que el procedimiento
habitual es reclamarlo a través de ServiceNow. Prosiga solo con esta petición en caso de haberlo
reclamado y no haya recibido respuesta.» Cerrar el aviso conserva el código confirmado.
El cliente impide habilitar «Registrar solicitud» hasta confirmar un código visible con valor;
el servidor lo valida aunque sea opcional. Un código oculto se descarta antes de validar,
generar el ID o escribir el registro.
`Comentarios` es obligatorio en la configuración inicial, con un máximo de 2.000 caracteres verificado en cliente y
servidor. Bajo el título aparece: «Por favor, redacta correctamente el contenido, ya que se
enviará directamente al proveedor», con un contador `N / 2000` a su derecha. El aviso es texto
fijo de la aplicación. Antes de guardar
y enviar se eliminan líneas vacías, espacios repetidos y caracteres invisibles; se conservan
saltos entre líneas con contenido. Los tres campos de tienda aceptan solo 1–5 dígitos.
Para `ERROR_PANTALLA` de Cafetera, Foto es obligatoria y acepta una sola imagen JPEG/JPG o PNG de
hasta 10 MiB. La zona de carga admite selección, arrastre y pegado desde el portapapeles; mientras
hay una foto seleccionada oculta esas opciones y muestra su nombre con una acción «×» para eliminarla.
Las fotos superiores a 2 MiB se reducen en el navegador a JPEG, con un lado máximo de 1.600 píxeles,
antes de enviarse. El límite individual de entrada se conserva en 10 MiB y el conjunto de adjuntos de
una solicitud no puede superar 20 MiB.
En `NUEVA_SOLICITUD` de Cafetera, después de validar la tienda se exigen dos controles en botones,
no desplegables: «¿Enchufe disponible?» y «¿Toma de agua disponible?», ambos `SI` o `NO`, seguidos
por Foto ubicación y Foto layout, también obligatorias. En `NUEVA_SOLICITUD` de Locker se solicita
«¿Enchufe disponible?» con los mismos botones, seguido de Foto horario, Foto cobertura, Foto
ubicación y Foto layout. Foto cobertura muestra como ayuda el valor de `URL_APP_COBERTURA` de
`Sistema`; si falta, se muestra `www.dia.es`. El navegador solo usa el tipo MIME como ayuda; el
servidor repite el límite y comprueba la firma binaria de JPEG o PNG antes de registrar.

«Registrar solicitud» permanece desactivado hasta que todos los campos requeridos sean válidos
y las tiendas y el código ServiceNow, cuando aparece, se hayan confirmado. Junto al botón se
indican los requisitos pendientes con acciones para enfocar cada control. Los selectores SI/NO
usan radios nativos estilizados, compatibles con flechas del teclado. Volver conserva en memoria
el borrador de la opción, incluidas las fotos; un alta correcta descarta ese borrador. No se
guardan borradores en localStorage, caché o Drive. Las opciones generales siguen accesibles cuando
conviven con proveedores y se omite el paso de proveedor cuando solo existe una alternativa.

La interfaz valida para ayudar al usuario; el servidor repite autorización, disponibilidad del
elemento, campos, código ServiceNow, comentarios y ámbito de tienda. Los datos descriptivos del elemento nunca
se aceptan desde el cliente. La normalización de comentarios y la validación de fechas se mantienen
también en el navegador para respuesta inmediata, pero el servidor sigue siendo la autoridad; una
prueba de paridad impide que ambas implementaciones diverjan.

## 7. Identificadores, persistencia y concurrencia

Cada alta recibe un ID `SOL-AAAAMMDD-NNNN`; el primero de una instalación nueva termina en
`0001`. El correlativo procede de la propiedad de script `ULTIMO_ID_PETICION`. Bajo un único `LockService.getScriptLock()`,
el servidor cuenta registros del día, asigna el ID y escribe
la fila. Hace `SpreadsheetApp.flush()` antes de liberar el bloqueo.

El navegador desactiva «Registrar solicitud» mientras la llamada está en curso para evitar
dobles clics. No hay deduplicación persistente: si una respuesta se pierde después de guardar,
un nuevo envío puede crear otra fila y otro correo. El máximo diario cuenta solo filas
persistidas con ID y fecha del día local. El límite se lee de `Sistema`; si falta, se aplica 10, y un valor inválido deniega
el alta. Como `timestamp_registro` es cronológico, el cupo lee desde el final en bloques de 100
filas y se detiene al encontrar el primer registro anterior al día actual. La cabecera leída para
localizar esas columnas se reutiliza al insertar la fila.

Después de generar el ID se añade una fila a `Registros`. Un fallo de correo posterior no cambia
la respuesta a fallo de alta: se devuelve `success=true`, `notificationSent=false` y el usuario
ve que el registro se guardó sin confirmación. Así se evita inducir un reintento por un efecto ya
persistido.

Al abrir una ventana, el limitador lee `Sistema` bajo bloqueo para el resto del flujo y guarda el umbral y la duración técnicos
en su estado de Script Properties. Esa lectura se reutiliza en el resto del flujo. Los intentos
posteriores de la misma ventana usan ese estado; los bloqueados no leen hojas ni escriben
registros o correos.

`submitRequest` exige una identidad de `Session.getActiveUser()` y consume un intento en una
ventana por email normalizado. Los valores iniciales son diez intentos en diez minutos; el
siguiente recibe un error legible con minutos aproximados de espera. Cuentan también envíos
inválidos y cuentas sin autorización funcional. El estado se
guarda en Script Properties bajo una clave SHA-256 del email, nunca el email en claro, y se
actualiza bajo `LockService.getScriptLock()` para serializar envíos simultáneos. Los estados
vencidos se eliminan con una limpieza oportunista como máximo una vez al día, limitada a 50
claves propias por pasada para acotar el tiempo de bloqueo. Si quedan claves vencidas, no se marca
la limpieza como terminada y las llamadas siguientes continúan por tandas hasta alcanzarlas. Un
fallo del bloqueo o de Properties
impide continuar el alta.
En ese fallo se deja una señal estática en la consola, sin escribir una fila en `Logs` por cada
reintento.

`checkAccess` admite inicialmente 30 consultas y `lookupStore` 60 por cuenta en ventanas
independientes de diez minutos, también mediante Script Properties con email seudonimizado y bloqueo. Son
límites de lectura, separados del cupo de altas y del limitador de intentos de registro;
se aplican antes de leer usuarios, elementos o tiendas. Los estados vencidos se limpian de forma
oportunista. Los cinco umbrales técnicos se definen en `SUBMISSION_RATE_LIMIT` y `READ_RATE_LIMIT`,
no en Sistema. Una ventana abierta conserva su umbral y duración persistidos hasta que vence;
las ventanas nuevas aplican las constantes de la versión ejecutada.

## 8. Correo

El destinatario principal es `email_destino` del elemento cuando tiene valor; admite varias
direcciones separadas por comas. Si está vacío, el destinatario principal es el email autenticado.
Las copias son:

1. `EMAIL_CC_SOPORTE`, o su valor predeterminado;
2. `email_copia` del elemento, cuando existe;
3. el email autenticado de quien registra.

`EMAIL_CC_SOPORTE` y `email_destino` admiten una o varias direcciones sintácticamente válidas
separadas por comas; se rechazan elementos vacíos, punto y coma y saltos de línea. Cada dirección de
`email_destino` debe ser válida. Las direcciones repetidas se eliminan sin distinguir mayúsculas de minúsculas. Una
configuración inválida provoca fallo de notificación, sin deshacer el registro ya guardado.

El nombre visible del remitente procede de `NOMBRE_REMITENTE_EMAIL`, con valor predeterminado
`Dia Layouts`. El asunto procede de `ASUNTO_EMAIL`; la clave heredada `ASUNTO_EMAL` se usa solo
si no existe la correcta. La plantilla inicial es:

```text
[Gestión equipos]-{{equipo}}-{{tipo_gestion}}- {{tienda}}-{{provincia}}-{{municipio}}-{{direccion}}
```

Los marcadores admitidos son `id_elemento`, `equipo`, `tipo_gestion`, `tienda`, `provincia`, `municipio` y
`direccion`. Los datos de tienda se resuelven de nuevo en servidor; en movimientos `tienda`
contiene origen y destino. Los marcadores no admitidos provocan fallo de notificación, sin
deshacer una solicitud ya guardada. Se eliminan saltos de línea del asunto.

El correo de confirmación usa `mensaje_email` de la fila seleccionada como cuerpo literal, tanto
en `body` de texto plano como en `htmlBody`. Admite `{nombre_columna}` o `{{nombre_columna}}` para
cualquier columna de la fila seleccionada de `Elementos` y de la fila creada en `Registros`; por
ejemplo, `{{proveedor}}`, `{{tienda_origen}}`, `{{codigo_servicenow}}`, `{{enchufe_disponible}}` o
`{{comentarios}}`. La sustitución de `{{comentarios}}` se muestra entre comillas y en cursiva en la versión HTML. La instantánea de `Registros` tiene prioridad sobre `Elementos` cuando coinciden
los nombres. Se conserva `{{tienda_id}}` como alias del identificador validado de la tienda. Una
variable desconocida o mal formada en la plantilla rechaza la solicitud. Los valores sustituidos,
incluidas sus llaves literales, no se reinterpretan como marcadores. El HTML conserva los saltos de línea y escapa el texto para impedir que
una celda ejecute etiquetas. La tarjeta conserva la cabecera DIA y el estado de alta,
con el logo resuelto desde `LOGO_URL`, cuyo valor predeterminado es
`https://www.dia.es/content-manager/image/Logos_footer_header/web_logo.svg`. No incluye el botón «Abrir la aplicación», enlaces, otros recursos remotos
ni datos de otras solicitudes. Si `mensaje_email` está vacío, la solicitud se rechaza antes de generar
ID, escribir en `Registros` o enviar una notificación. Para `ERROR_PANTALLA` de Cafetera incorpora la foto validada como
un adjunto binario, con nombre `foto-<id_peticion>.jpg` o `.png`. Para `NUEVA_SOLICITUD` de
Cafetera adjunta Foto ubicación y Foto layout como `foto-ubicacion-<id_peticion>` y
`foto-layout-<id_peticion>` con su extensión. En `NUEVA_SOLICITUD` de Locker adjunta las fotos como
`foto-horario-<id_peticion>`, `foto-cobertura-<id_peticion>`, `foto-ubicacion-<id_peticion>` y
`foto-layout-<id_peticion>`, con su extensión. No crea archivos de Drive ni incluye enlaces. Solo se
muestran campos con valor; el HTML escapa los datos y conserva los saltos
de línea en Comentarios. El saludo y el cierre, si se desean, se incluyen en mensaje_email;
no se añade texto al cuerpo literal de la opción. El asunto y el cuerpo de la solicitud de acceso
son fijos e incorporan el email de la cuenta.

## 9. Interfaces públicas

Funciones invocadas por la web:

| Función | Efectos |
|---|---|
| `doGet()` | Sirve `frontend/99_index.html` como plantilla. |
| `checkAccess()` | Lee identidad, usuario y elementos activos, sin enviar el maestro de tiendas. |
| `lookupStore(storeId, idElemento)` | Autoriza y resuelve una tienda exacta; devuelve solo las columnas de su tarjeta. |
| `submitRequest(payload)` | Limita intentos por cuenta, autoriza, valida, genera ID, escribe y notifica. |

No hay funciones públicas de preparación manual; las pestañas maestras se mantienen en Sheets.
La creación automática de `Logs` usa un helper privado. Las demás funciones globales terminan
en `_` y no forman parte del puente cliente-servidor. No
existen `doPost`, webhooks ni API REST. Tampoco se crean triggers con `ScriptApp` ni se
definen entradas `onOpen`, `onEdit` o equivalentes.

## 10. Sistema visual

La interfaz usa el mismo sistema de tokens que la guía visual canónica de las aplicaciones DIA,
tomado de `diaformlayouts/src/frontend/00_foundation/00_32_merch_visual_guide_styles.html` y de
su base accesible. `00_styles.html` contiene la adaptación visual de este proyecto y
`99_index.html` compone la pantalla:

| Rol | Valor |
|---|---|
| Primario | `#dc2626` |
| Primario hover | `#b91c1c` |
| Primario suave | `#fef2f2` |
| Fondo | `#f8fafc` |
| Superficie | `#ffffff` |
| Texto | `#0f172a` |
| Texto de títulos | `#1e293b` |
| Borde | `#e2e8f0` |
| Fuente | `ui-sans-serif, system-ui, sans-serif` |
| Radio de control | `.5rem` |
| Radio de tarjeta | `.75rem` |

La cabecera es blanca, compacta y fija; a la izquierda muestra sin enlace el logo DIA cargado
desde `LOGO_URL` de Sistema, con el logo oficial predeterminado, y a la derecha muestra las iniciales de la persona autenticada. El footer muestra
`Gestión de equipos de tienda - 1.0.0`. El nombre y la versión proceden de `APP_METADATA`;
no existe una clave `VERSION` en `Sistema`.
Las iniciales se derivan del email cuando contiene nombre y apellido separados por coma,
punto, guion o subrayado; `david,rincon@diagroup.com` muestra `DR`.
Botones,
tarjetas, campos, overlay y diálogo comparten tamaños, radios, sombras y estados con el resto de
aplicaciones. Fuera del logo oficial no se carga ninguna fuente, icono o librería remota. Las clases siguen BEM práctico,
los controles son nativos, el foco es visible y el resultado usa `<dialog>`. Se contemplan
teclado, `prefers-reduced-motion`, colores forzados, errores asociados y bloqueo del doble envío.
La tarjeta validada reproduce el componente `modification-store-card` de `diaformlayouts`, con
`--color-store-card: #b8191c`, badges, título, delegación, almacén y franja inferior de dirección.

Contrato responsive:

- **smartphone:** 320–639 px, una columna, objetivos táctiles mínimos de 44 px y respeto del área
  segura inferior;
- **14 pulgadas:** referencia 1280×800 y 1366×768, tres columnas cuando hay espacio y compactación
  adicional con altura de 800 px o inferior;
- **22 pulgadas o superior:** referencia 1920×1080 desde 1440 px de ancho CSS, contenido limitado a
  1600 px y mayor respiración sin alargar excesivamente líneas o controles.

## 11. Preparación, pruebas y publicación

Preparación local:

```text
npm install
npm run check
npm run deploy -- "Descripción del cambio"
```

`npm run check` ejecuta Jest en serie. `npm run test:coverage` genera cobertura. La suite usa
mocks locales y no llama a servicios de Google.

Preparación inicial de una hoja:

1. vincular el proyecto de Apps Script a la hoja correcta;
2. crear manualmente `Sistema` con la cabecera `clave, valor` y los parámetros requeridos;
3. crear manualmente `Usuarios`, `Tiendas`, `Elementos`, `Parametros_delegacion` y `Registros` con sus cabeceras;
4. cargar y revisar los datos maestros de tiendas y elementos, incluida la fila
   `CAF-ERROR-PANTALLA` si se habilitará esa gestión;
5. completar `EMAIL_ADMIN`, `EMAIL_CC_SOPORTE` y los `email_destino`; revisar
   `NOMBRE_REMITENTE_EMAIL`, `ASUNTO_EMAIL` (o temporalmente `ASUNTO_EMAL`), `ENTORNO`,
   `LIMITE_REGISTROS_DIARIOS_USUARIO`, los límites por ventana y la caché;
6. verificar roles y delegaciones con datos de prueba.

Publicación:

1. instalar dependencias con `npm install` y ejecutar `npm run push -- --dry-run`;
2. confirmar cuenta, `.clasp.json`, manifiesto, hoja vinculada y archivos de `git status`;
3. ejecutar `npm run deploy -- "Descripción del cambio"`, que repite ESLint/tests, crea el commit, hace `git push`, envía fuentes con clasp, crea una versión y actualiza la única implementación versionada;
4. usar `npm run deploy -- --dry-run` para validar sin publicar; si `clasp` no usa una cuenta del dominio propietario, Apps Script rechaza la actualización de la implementación;
5. probar acceso denegado, cada rol, filtros de tienda, una gestión representativa por equipo,
   persistencia y destinatarios.

`clasp push` no crea ni actualiza por sí solo una versión desplegada. No se usan datos de
producción ni se envían correos reales durante pruebas sin autorización.

### 11.1. Pruebas con pestañas `TEST_` en el mismo libro

La versión de producción permanece fijada a su despliegue. La versión de pruebas usa el mismo
proyecto y libro, pero resuelve todas las pestañas mediante `TEST_`: `TEST_Sistema`,
`TEST_Usuarios`, `TEST_Elementos`, `TEST_Parametros_delegacion`, `TEST_Tiendas`,
`TEST_Registros`, `TEST_Logs` y `TEST_Campos_peticion`. Si falta una copia, no utiliza la pestaña original.
Los maestros se duplican una vez, como instantánea; Registros y Logs se crean únicamente con
cabeceras. No se sobrescriben copias de prueba existentes ni se elimina histórico.

El entorno está fijado en `EXECUTION_CONFIG` dentro de cada versión, no en URL, Sistema ni una
propiedad compartida. Las fuentes canónicas mantienen `PROD`; `npm run build:test` genera un
paquete independiente bajo `.staging/` sustituyendo únicamente esa configuración por `TEST`.
La configuración local `.test-environment.json`, excluida de Git, contiene `testEmail`,
`productionDeploymentId`, `productionVersion` y, una vez creado, `testDeploymentId`.
No se versionan el buzón real ni los identificadores de despliegue.

En TEST todos los correos de confirmación se entregan exclusivamente a `testEmail`, sin CC/BCC,
ignorando los destinatarios de la opción, soporte y solicitante. El asunto lleva `[PRUEBAS]`;
la cabecera web y el título muestran PRUEBAS. Solicitar acceso también usa el buzón de pruebas.
Un buzón de pruebas vacío o inválido impide el envío y nunca activa destinatarios de producción.

Las claves de caché de TEST llevan `test:` para evitar que una entrada de producción sustituya
las copias. Por decisión del responsable, durante esta prueba controlada se comparten el contador,
los limitadores persistidos, el bloqueo y las cuotas: las pruebas pueden producir saltos de ID
y consumir intentos. No se borran ni reinician esos estados al preparar el entorno.

`npm run deploy:test -- --dry-run` ejecuta la comprobación local y genera el paquete sin red.
`npm run deploy:test -- --stage-only` envía el paquete TEST y crea una versión inmutable sin
crear ni actualizar despliegues. Registra `stagedTestVersion` en la configuración local. Si una
versión anterior quedó pendiente, solo la sustituye tras comprobar que no está desplegada.
`npm run deploy:test` comprueba primero que producción conserva la versión registrada y que el
destino de pruebas, si existe, está identificado como tal. Después envía el paquete, crea una
versión y crea o actualiza exclusivamente el despliegue TEST. Finalmente verifica que los otros
despliegues versionados conservan su versión. No crea commits ni ejecuta git push.
El código HEAD compartido queda en modo TEST; las versiones desplegadas anteriores no cambian.
Si hay una publicación con resultado incierto, se revisa antes de reintentar.

El comando general `npm run deploy` comprueba la unicidad del destino antes de enviar fuentes;
con producción y pruebas simultáneas se detiene por ambigüedad. La promoción a producción se
prepara por separado, manteniendo copia, validación y migración explícita de cualquier esquema.
Para esta infraestructura no se añaden servicios, scopes, triggers ni endpoints públicos.

Matriz mínima de verificación del aislamiento:

| Riesgo | Comprobación local | Comprobación integrada |
|---|---|---|
| Escritura en originales | Alta completa con originales centinela; todas las búsquedas usan TEST_ | Comparar pestañas originales antes y después de la preparación |
| Copia ausente | Error explícito sin recurrir a la original | Verificar las ocho pestañas TEST antes de publicar |
| Destinatarios reales | Alta con proveedor, soporte y solicitante distintos del buzón; solo se entrega a testEmail | Correo real autorizado únicamente al buzón de pruebas |
| Caché compartida | Una entrada PROD no reemplaza Sistema TEST; invalidar TEST conserva PROD | Editar únicamente las copias y esperar su TTL |
| Despliegue equivocado | Rechazar versión PROD distinta y destino sin identificación TEST | Comparar IDs y versiones de despliegues antes y después |

La comprobación visual, de identidad y del correo real se registra como integrada; los mocks
locales no la sustituyen. El procedimiento y sus resultados se conservan en la entrega.

### 11.2. Prueba funcional de la implementación migrada

La preparación de TEST añade una tabla nativa `CamposPeticionesPrueba` en
`TEST_Campos_peticion`, con desplegables de campo y estado y cabeceras con instrucciones.
El plan local de datos se genera mediante `node scripts/plan-test-data.js` a partir de una
instantánea privada bajo `.staging/`; ese comando no abre Google ni realiza escrituras remotas.
No se repite una inicialización sobre configuraciones de prueba ya editadas.

Para modificar una petición existente, filtrar por su `id_elemento`, cambiar estado, orden,
etiqueta o ayuda, esperar el TTL corto y recargar la web. Para crear otra opción, añadirla primero
INACTIVE en TEST_Elementos, copiar los campos de una opción compatible cambiando `id_elemento`,
ajustar sus requisitos y finalmente activarla. Un campo o tipo técnico nuevo exige código.

Prueba manual mínima tras crear la URL TEST con una cuenta del dominio propietario:

1. comprobar el indicador PRUEBAS y un acceso permitido y otro denegado;
   en `TEST_Elementos.rol_visible`, restringir una opción a un rol, esperar el TTL corto y
   comprobar con dos usuarios de distinto rol que solo aparece y permite consultas y altas
   al rol indicado; restaurar `TODOS` y verificar que vuelve a estar disponible;
2. registrar una petición representativa y comprobar que solo crecen TEST_Registros y TEST_Logs;
3. confirmar que el correo, con asunto PRUEBAS, llega solo al buzón privado configurado;
4. cambiar Comentarios a OPCIONAL y una foto oculta a OPCIONAL en una petición de prueba:
   verificar que vacíos se aceptan y que una imagen presente se valida y adjunta;
5. probar etiqueta, ayuda y orden; ocultar un campo y verificar que no aparece ni se persiste;
6. con un formulario abierto, cambiar un requisito, esperar el TTL y registrar: debe actualizar
   el formulario conservando lo aplicable, sin crear ID ni registro;
7. comprobar borrador al volver, navegación por teclado, periodos y motivos de rechazo.

Los límites por cuenta continúan activos: estas operaciones consumen intentos y cupo diario.
No se borran estados compartidos ni se envía una solicitud real a proveedores para probar.
La promoción y los cambios de IDs duplicados de producción requieren una migración independiente:
las correcciones de IDs realizadas en TEST no modifican filas ni históricos originales.

## 12. Seguridad, privacidad y limitaciones

- La web app está limitada al dominio y cada mutación se autoriza en servidor.
- Los errores de validación se muestran de forma controlada; los fallos internos no exponen
  detalles de hojas o de Apps Script al navegador. Para un fallo genérico de registro, revisar
  `Ejecuciones` en Apps Script y la etapa registrada; si no hay ejecución, comprobar la consola
  del navegador y la versión del despliegue. Verificar las columnas obligatorias de `Registros`.
- `.clasp.json`, `*.gsheet`, credenciales e IDs no se versionan.
- Los valores de hojas se tratan como configuración administrada, no como confianza del cliente.
- No hay Drive, UrlFetch, Admin SDK ni servicios avanzados. Las fotos de `ERROR_PANTALLA` y de
  `NUEVA_SOLICITUD` de Cafetera y Locker se conservan solo en memoria durante la ejecución y se
  adjuntan al correo; no se persisten en Sheets, Logs,
  Properties, caché ni Drive.
- No se ha verificado el comportamiento integrado de identidad, correo y permisos en un despliegue
  real durante esta regeneración.
- No hay idempotencia persistente para las altas: un reenvío tras perder la respuesta puede
  duplicar una solicitud. El bloqueo de doble clic y el cupo diario no eliminan ese riesgo; ante
  un fallo de transporte, la interfaz pide comprobar primero el correo de confirmación.
- Los tres puntos públicos están limitados por usuario; quedan pendientes la prueba real de
  concurrencia, latencia y cuotas de Script Properties en sandbox.
- Las fechas deben ser futuras y el fin de un periodo no puede ser anterior al inicio.
- Se comprueba la sintaxis y unicidad de destinatarios, pero no se impone dominio corporativo a
  `email_destino` porque puede ser un proveedor externo; revisar operativamente su autorización.
- La creación concurrente de `Logs` aún requiere
  una prueba integrada en un despliegue de sandbox antes de publicar.
- `Logs` no tiene retención automática ni límite de crecimiento; el responsable vacía la pestaña
  manualmente a diario y debe controlar su acceso.

## 13. Fuentes ejecutables de verdad

| Contrato | Fuente |
|---|---|
| Runtime y acceso web | `src/appsscript.json` |
| Hojas, columnas, roles y estados | `src/backend/00_constants.js`, `docs/domain/SPECIFICATION.md` |
| Acceso y ámbito | `src/backend/30_auth_service.js`, `src/backend/22_store_service.js` |
| Alta y correo | `src/backend/32_request_service.js`, `src/backend/31_mail_service.js` |
| Captura por petición | `src/backend/26_form_schema_service.js`, `Campos_peticion` |
| Auditoría | `src/backend/23_log_service.js` |
| Diseño efectivo | `src/frontend/00_styles.html`, `src/frontend/99_index.html` |
| Comportamiento cliente | `src/frontend/10_navigation.html`, `src/frontend/20_form.html`, `src/frontend/30_validation_submit.html` |
| Comandos y versiones | `package.json` |
| Contratos verificados | `test/` |

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

Quedan fuera de alcance adjuntos, aprobación, seguimiento, edición, cancelación, histórico,
estadísticas, exportaciones, administración desde la web y APIs HTTP entrantes, salvo una única
foto obligatoria en la opción `Error en pantalla` de Cafetera, que se adjunta directamente al correo.

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
    10_sheet_gateway.js   adaptador común de Sheets
    20_config_service.js  configuración de Sistema
    21_element_service.js catálogo configurable
    22_store_service.js   búsqueda y ámbito de tiendas
    23_log_service.js     auditoría operativa mínima
    24_rate_limit_service.js protección de intentos por cuenta
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

La hoja activa contiene seis pestañas: cinco de operación y `Logs` para auditoría mínima.

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

### 5.3. `Elementos`

Cabeceras:

```text
id_elemento, equipo, proveedor, tipo_gestion, subtipo, etiqueta, estado,
requiere_service_now, solo_tiendas_abiertas, email_destino, orden
```

Contratos:

- `id_elemento` es estable y único;
- `equipo`: `NEVERA`, `LOCKER` o `CAFETERA`;
- `estado`: `ACTIVE` o `INACTIVE`;
- `requiere_service_now` y `solo_tiendas_abiertas`: `SI` o `NO`;
- `orden` controla el orden ascendente del menú;
- `email_destino` añade una copia al correo cuando tiene valor;
- `proveedor` y `subtipo` pueden quedar vacíos.

Tipos de gestión cerrados:

- `NUEVA_SOLICITUD`;
- `MOVIMIENTO`;
- `DESCONEXION_TEMPORAL`;
- `RETIRADA`;
- `INCIDENCIA_SERVICENOW`;
- `RECLAMACION_SIN_PARTE`;
- `ERROR_PANTALLA`, únicamente para Cafetera.

El catálogo se mantiene manualmente en la pestaña; la aplicación no inserta filas de ejemplo. Para
habilitar la nueva opción se añade manualmente una fila como esta, ajustando `email_destino` y
`orden` si corresponde:

```text
CAF-ERROR-PANTALLA, CAFETERA, , ERROR_PANTALLA, , Error en pantalla, ACTIVE, NO, NO, , 30
```

### 5.4. `Sistema`

Cabeceras:

```text
clave, valor
```

| Parámetro | Valor inicial | Uso |
|---|---|---|
| `ENTORNO` | `PROD` | Entorno declarativo. |
| `CACHE_HABILITADA` | `TRUE` | Activa las lecturas en `CacheService`. |
| `CACHE_TTL_CORTO_SEGUNDOS` | `5` | TTL de Usuarios, Elementos y Sistema. |
| `CACHE_TTL_LARGO_SEGUNDOS` | `100` | TTL de Tiendas. |
| `EMAIL_ADMIN` | Correo definido manualmente | Destinatario del enlace para solicitar acceso. |
| `EMAIL_CC_SOPORTE` | `dia.es.soporte.layouts@diagroup.com` | Copia de soporte configurable para confirmaciones. |
| `NOMBRE_REMITENTE_EMAIL` | `Dia Layouts` | Nombre visible del remitente del correo. |
| `ASUNTO_EMAIL` | `[Gestión equipos]-{{equipo}}-{{tipo_gestion}}- {{tienda}}-{{provincia}}-{{municipio}}-{{direccion}}` | Plantilla del asunto. Durante la transición se acepta `ASUNTO_EMAL` si no existe esta clave. |
| `LIMITE_REGISTROS_DIARIOS_USUARIO` | `10` | Máximo de registros guardados por usuario y día de `Europe/Madrid`; entero positivo ampliable. |
| `LIMITE_INTENTOS_REGISTRO_VENTANA` | `10` | Máximo de intentos de alta por usuario en cada ventana. |
| `VENTANA_INTENTOS_REGISTRO_SEGUNDOS` | `600` | Duración de la ventana de intentos de alta. |
| `LIMITE_CONSULTAS_ACCESO_VENTANA` | `30` | Máximo de comprobaciones de acceso por usuario. |
| `LIMITE_CONSULTAS_TIENDA_VENTANA` | `60` | Máximo de búsquedas de tienda por usuario. |
| `VENTANA_CONSULTAS_SEGUNDOS` | `600` | Duración compartida de las ventanas de acceso y tienda. |

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
La cabecera debe ser `clave, valor`; ya no se corrige automáticamente una cabecera heredada.

### 5.5. `Registros`

Cabeceras, en orden:

```text
id_peticion, timestamp_registro, email_usuario, nombre_usuario,
delegacion_usuario, id_elemento, etiqueta_elemento, equipo, proveedor,
tipo_gestion, subtipo, tienda, tienda_origen, tienda_destino,
fecha_limite_recogida, fecha_inicio, fecha_fin, fecha_maxima_retirada,
necesita_codigo_servicenow, codigo_servicenow, comentarios, enchufe_disponible,
toma_agua_disponible
```

Las columnas no aplicables a una gestión se guardan vacías. El texto que comienza por `=`, `+`,
`-` o `@` se prefija para impedir que Sheets lo evalúe como fórmula.
`necesita_codigo_servicenow` conserva el valor efectivo del elemento en el momento del alta; es
una instantánea histórica deliberada, aunque el maestro `Elementos` cambie después.
El servidor descarta tiendas, fechas, códigos ServiceNow, disponibilidades y fotos no aplicables
aunque el navegador los envíe; solo se persisten los campos correspondientes al elemento seleccionado.
`enchufe_disponible` y `toma_agua_disponible` contienen `SI` o `NO` solo en `NUEVA_SOLICITUD` de
Cafetera; las fotos nunca se escriben en `Registros`. Antes de habilitar esa gestión en una hoja
existente se añaden ambas cabeceras al final de `Registros`; si faltan, el servidor rechaza el alta
antes de asignar ID, escribir una fila o enviar correo.
`Registros` se prepara manualmente; si falta o no tiene las columnas obligatorias, no se registra
la solicitud. Las antiguas `clave_idempotencia` y `huella_solicitud` ya no se crean ni se usan;
si siguen presentes, las nuevas filas las dejan vacías. No se eliminan datos automáticamente.

### 5.6. `Logs`

Cabeceras, en orden:

```text
fecha, nivel, evento, email, id_solicitud, mensaje, contexto
```

La aplicación añade un evento por intento de alta aceptado por el limitador:
`SOLICITUD_REGISTRADA`, `SOLICITUD_RECHAZADA` o `NOTIFICACION_FALLIDA`. Al exceder el umbral,
solo el primer intento bloqueado de cada ventana añade `LIMITE_ENVIOS_EXCEDIDO`; los posteriores
no escriben en la hoja para evitar amplificación. Un estado corrupto del limitador de envíos
añade `ESTADO_LIMITE_INVALIDO`; solo si ese evento queda registrado se elimina el valor corrupto
observado para que el siguiente intento pueda abrir una ventana nueva. `email` identifica al solicitante;
`id_solicitud` contiene el ID si llegó a generarse y `mensaje` es un texto fijo por evento.
`contexto` es un objeto JSON de hasta 1.000 caracteres con `etapa` y, cuando ya se ha resuelto el
elemento, `idElemento`, `equipo`, `proveedor`, `tipoGestion` y `subtipo`; los valores vacíos se
omiten. En registros completados incluye `notificacionEnviada`. No se guardan excepciones,
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

| Gestión | Campos obligatorios | Campos condicionales |
|---|---|---|
| `NUEVA_SOLICITUD` | tienda | en Cafetera: enchufe, toma de agua, foto de ubicación y foto de layout |
| `MOVIMIENTO` | tienda de origen y destino | fecha límite opcional para neveras |
| `DESCONEXION_TEMPORAL` | tienda, fecha de inicio y fin | — |
| `RETIRADA` | tienda | fecha máxima obligatoria para lockers |
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
El cliente impide habilitar «Registrar solicitud» hasta confirmar un código válido; el servidor
rechaza cualquier código no vacío que no cumpla el patrón, aunque la fila no lo exija, antes de
generar el ID o escribir el registro.
`Comentarios` es siempre obligatorio, con un máximo de 2.000 caracteres verificado en cliente y
servidor. Bajo el título aparece: «Por favor, redacta correctamente el contenido, ya que se
enviará directamente al proveedor», con un contador `N / 2000` a su derecha. El aviso es texto
fijo de la aplicación. Antes de guardar
y enviar se eliminan líneas vacías, espacios repetidos y caracteres invisibles; se conservan
saltos entre líneas con contenido. Los tres campos de tienda aceptan solo 1–5 dígitos.
Para `ERROR_PANTALLA` de Cafetera, Foto es obligatoria y acepta una sola imagen JPEG/JPG o PNG de
hasta 10 MiB. La zona de carga admite selección, arrastre y pegado desde el portapapeles; mientras
hay una foto seleccionada oculta esas opciones y muestra su nombre con una acción «×» para eliminarla.
En `NUEVA_SOLICITUD` de Cafetera, después de validar la tienda se exigen dos controles en botones,
no desplegables: «¿Enchufe disponible?» y «¿Toma de agua disponible?», ambos `SI` o `NO`, seguidos
por Foto ubicación y Foto layout, también obligatorias. El navegador solo usa el tipo MIME como
ayuda; el servidor repite el límite y comprueba la firma binaria de JPEG o PNG antes de registrar.

«Registrar solicitud» permanece desactivado hasta que todos los campos requeridos sean válidos
y las tiendas y el código ServiceNow se hayan confirmado.

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

Al abrir una ventana, el limitador lee `Sistema` bajo bloqueo y guarda el umbral y la duración
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
oportunista. Los cinco umbrales operativos están en `Sistema` y deben ser enteros positivos;
un valor inválido deniega la operación. Una edición manual surte efecto al comenzar la siguiente
ventana, no a mitad de una ya abierta. Las constantes conservan solo valores iniciales y
compatibilidad con estados legados.

## 8. Correo

El destinatario principal es el email autenticado. Las copias son:

1. `EMAIL_CC_SOPORTE`, o su valor predeterminado;
2. `email_destino` del elemento, cuando exista.

Cada celda debe contener una sola dirección sintácticamente válida; se rechazan listas,
separadores y saltos de línea, y se elimina una CC repetida. Una configuración inválida provoca
fallo de notificación, sin deshacer el registro ya guardado.

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

El correo de confirmación contiene `body` de texto plano y `htmlBody` con tarjeta centrada,
cabecera DIA, estado de alta, tabla de datos y pie. La cabecera carga el logo oficial desde
`https://www.dia.es/content-manager/image/Logos_footer_header/web_logo.svg`. No incluye el botón «Abrir la aplicación», enlaces, otros recursos remotos
ni datos de otras solicitudes. Para `ERROR_PANTALLA` de Cafetera incorpora la foto validada como
un adjunto binario, con nombre `foto-<id_peticion>.jpg` o `.png`. Para `NUEVA_SOLICITUD` de
Cafetera adjunta Foto ubicación y Foto layout como `foto-ubicacion-<id_peticion>` y
`foto-layout-<id_peticion>` con su extensión. No crea archivos de Drive ni incluye enlaces. Solo se
muestran campos con valor; el HTML escapa los datos y conserva los saltos
de línea en Comentarios. El saludo, la frase principal y el cierre son textos fijos de la aplicación;
incorporan el nombre del usuario y el identificador de la solicitud. El asunto y el cuerpo de la
solicitud de acceso también son fijos e incorporan el email de la cuenta.

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
desde `https://www.dia.es/content-manager/image/Logos_footer_header/web_logo.svg` y a la derecha muestra las iniciales de la persona autenticada. El footer muestra
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
```

`npm run check` ejecuta Jest en serie. `npm run test:coverage` genera cobertura. La suite usa
mocks locales y no llama a servicios de Google.

Preparación inicial de una hoja:

1. vincular el proyecto de Apps Script a la hoja correcta;
2. crear manualmente `Sistema` con la cabecera `clave, valor` y los parámetros requeridos;
3. crear manualmente `Usuarios`, `Tiendas`, `Elementos` y `Registros` con sus cabeceras;
4. cargar y revisar los datos maestros de tiendas y elementos, incluida la fila
   `CAF-ERROR-PANTALLA` si se habilitará esa gestión;
5. completar `EMAIL_ADMIN`, `EMAIL_CC_SOPORTE` y los `email_destino`; revisar
   `NOMBRE_REMITENTE_EMAIL`, `ASUNTO_EMAIL` (o temporalmente `ASUNTO_EMAL`), `ENTORNO`,
   `LIMITE_REGISTROS_DIARIOS_USUARIO`, los límites por ventana y la caché;
6. verificar roles y delegaciones con datos de prueba.

Publicación:

1. instalar dependencias con `npm install` y ejecutar `npm run push -- --dry-run`;
2. confirmar cuenta, `.clasp.json`, manifiesto, hoja vinculada y archivos de `git status`;
3. ejecutar `npm run push`, que repite ESLint/tests, crea el commit, hace `git push` y envía fuentes con clasp;
4. crear una versión y actualizar manualmente el despliegue;
5. probar acceso denegado, cada rol, filtros de tienda, una gestión representativa por equipo,
   persistencia y destinatarios.

`clasp push` no crea ni actualiza por sí solo una versión desplegada. No se usan datos de
producción ni se envían correos reales durante pruebas sin autorización.

## 12. Seguridad, privacidad y limitaciones

- La web app está limitada al dominio y cada mutación se autoriza en servidor.
- Los errores de validación se muestran de forma controlada; los fallos internos no exponen
  detalles de hojas o de Apps Script al navegador. Para un fallo genérico de registro, revisar
  `Ejecuciones` en Apps Script y la etapa registrada; si no hay ejecución, comprobar la consola
  del navegador y la versión del despliegue. Verificar las columnas obligatorias de `Registros`.
- `.clasp.json`, `*.gsheet`, credenciales e IDs no se versionan.
- Los valores de hojas se tratan como configuración administrada, no como confianza del cliente.
- No hay Drive, UrlFetch, Admin SDK ni servicios avanzados. Las fotos de `ERROR_PANTALLA` y de
  `NUEVA_SOLICITUD` de Cafetera se conservan solo en memoria durante la ejecución y se adjuntan al
  correo; no se persisten en Sheets, Logs,
  Properties, caché ni Drive.
- No se ha verificado el comportamiento integrado de identidad, correo y permisos en un despliegue
  real durante esta regeneración.
- No hay idempotencia persistente para las altas: un reenvío tras perder la respuesta puede
  duplicar una solicitud. El bloqueo de doble clic y el cupo diario no eliminan ese riesgo; ante
  un fallo de transporte, la interfaz pide comprobar primero el correo de confirmación.
- Los tres puntos públicos están limitados por usuario; quedan pendientes la prueba real de
  concurrencia, latencia y cuotas de Script Properties en sandbox.
- Las fechas deben ser futuras, pero todavía no se exige que `fechaFin` sea posterior a
  `fechaInicio` en una desconexión temporal.
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
| Auditoría | `src/backend/23_log_service.js` |
| Diseño efectivo | `src/frontend/00_styles.html`, `src/frontend/99_index.html` |
| Comportamiento cliente | `src/frontend/10_navigation.html`, `src/frontend/20_form.html`, `src/frontend/30_validation_submit.html` |
| Comandos y versiones | `package.json` |
| Contratos verificados | `test/` |

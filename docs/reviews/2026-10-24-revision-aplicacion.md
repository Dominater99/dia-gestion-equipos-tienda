# Revisión de EquiposTienda — 24 de octubre de 2026

## Alcance y resultado

Revisión del código local, manifiesto, documentación y pruebas, centrada en UX,
parametrización de peticiones, Sistema y Logs. No se ha consultado ni modificado
el libro de producción, ni se ha probado un despliegue real en navegador.
Los ejemplos y reproducciones usan exclusivamente los dobles locales y datos sintéticos.

La dificultad de mantenimiento tiene una causa concreta: `Elementos` parametriza
el menú y algunos atributos, pero los campos, sus condiciones y su persistencia
dependen de ramas de código por equipo y tipo de gestión. Se recomienda configurar
los campos por `id_elemento`, utilizando un catálogo técnico de campos admitidos.

Antes de ampliar esa flexibilidad conviene corregir dos fallos de prioridad alta:
la aceptación de metadatos internos del cliente para adjuntos y la posibilidad
de guardar una solicitud perdiendo datos si faltan columnas en Registros.

## Hallazgos

### 1. Alta — El cliente puede introducir adjuntos mediante propiedades internas

- Evidencia: `src/backend/32_request_service.js:179` copia todas las propiedades
  del payload. `normalizeRequestPhoto_`, desde la línea 409, elimina las fotos
  públicas, pero retorna cuando la gestión no tiene fotos sin eliminar
  `_photoAttachments` ni `_photoAttachment`. `src/backend/31_mail_service.js:78`
  consume esas propiedades al construir los adjuntos.
- Escenario reproducido: un usuario autorizado envía una retirada de Nevera con
  `_photoAttachments` que contiene bytes arbitrarios y MIME `application/pdf`.
  El alta devuelve `success=true`, `notificationSent=true` y el correo simulado
  contiene un adjunto pese a que esa gestión no admite fotos.
- Impacto: permite eludir las reglas de aplicabilidad, formato, firma y tamaño
  de los adjuntos usando esos campos internos. No demuestra acceso sin autorización
  ni control de los destinatarios.
- Recomendación: construir un payload nuevo con una lista explícita de campos
  públicos permitidos; generar todos los metadatos internos exclusivamente en
  servidor. Añadir una prueba de regresión que cubra ambas propiedades internas.

### 2. Alta — Una cabecera incompleta puede producir un alta con pérdida de datos

- Evidencia: `src/backend/32_request_service.js:513` comprueba las columnas de ID,
  fecha y usuario y algunas columnas de disponibilidades. El adaptador
  `src/backend/10_sheet_gateway.js:177` ignora los valores sin cabecera equivalente.
- Escenario reproducido: con Registros limitado a `id_peticion`,
  `timestamp_registro` y `email_usuario`, una retirada se registra y notifica
  correctamente, pero no persiste tienda, comentarios ni elemento.
- Impacto: la confirmación de éxito oculta que el registro está incompleto.
- Recomendación: verificar todas las columnas obligatorias del contrato antes
  de consumir el ID o escribir. Al incorporar campos configurables, comprobar
  también que cada campo persistible tiene destino válido.

### 3. Media — Los campos de una petición no están realmente parametrizados

- Evidencia: `src/frontend/20_form.html:2` define campos mediante condiciones
  por equipo y gestión. El servidor repite esas decisiones en
  `validateRequestPayload_`, `photoFieldNames_`, la normalización y
  `buildRegistroRow_`, dentro de `src/backend/32_request_service.js`.
- Escenario: pedir una foto adicional, hacer opcional una fecha o cambiar los
  datos requeridos solo para un proveedor exige modificar varios lugares y desplegar.
- Impacto: reglas dispersas, coste de mantenimiento y riesgo de divergencia
  entre lo que muestra el formulario y lo que acepta o guarda el servidor.
- Recomendación: resolver un esquema efectivo de campos en servidor y usarlo
  para presentar, validar, normalizar y persistir. La configuración recibida del
  navegador nunca sustituye a la que vuelve a resolver el servidor al registrar.

### 4. Media — El catálogo no valida su contrato antes de ofrecer opciones

- Evidencia: `src/backend/21_element_service.js:14` filtra por estado y orden;
  la búsqueda por ID, desde la línea 34, devuelve la primera coincidencia.
  No hay validación conjunta de IDs únicos, equipos, tipos ni indicadores SI/NO.
  `validateRequestPayload_` usa un caso por defecto para las demás gestiones.
- Escenario reproducido: una fila activa con `tipo_gestion=TIPO_INEXISTENTE`
  puede registrar y notificar una solicitud con tienda y comentarios.
- Impacto: una errata no se detecta como configuración inválida y puede
  convertirse en una opción con requisitos distintos de los esperados. Un ID
  duplicado puede asociar la opción visible a otra fila al enviar.
- Recomendación: validar el catálogo al cargarlo, con errores que indiquen hoja,
  fila y columna. Rechazar tipos desconocidos y combinaciones incompatibles;
  no interpretarlos como un formulario genérico.

### 5. Media — Mezclar opciones con y sin proveedor oculta las genéricas

- Evidencia: `src/frontend/10_navigation.html:143` activa el paso de proveedor si
  existe cualquiera. `renderProviders`, desde la línea 188, omite los vacíos.
- Escenario reproducido con las funciones reales del navegador en un contexto
  local: una Nevera tiene una opción sin proveedor y otra con «Proveedor A».
  Solo se genera el botón «Proveedor A»; no hay entrada para llegar a la genérica.
- Impacto: configuraciones permitidas por la especificación quedan inaccesibles.
- Recomendación: dar acceso explícito a «Gestiones generales» cuando convivan
  ambas clases. Si solo hay un proveedor y ninguna gestión general, saltar ese paso.

### 6. Media — Volver al formulario descarta lo ya introducido

- Evidencia: el botón Volver navega sin conservar un borrador
  (`src/frontend/10_navigation.html:182`). Seleccionar de nuevo una gestión llama
  a `renderForm` (`src/frontend/20_form.html:99`), que reemplaza los controles.
- Escenario: completar comentarios y fotos, volver para comprobar la opción y
  entrar otra vez. Los datos introducidos desaparecen.
- Impacto: trabajo repetido, especialmente en las peticiones con varias fotos.
- Recomendación: conservar el borrador de cada opción en memoria durante la
  sesión; avisar al descartarlo. Evitar persistir fotos o datos personales en
  almacenamiento local como parte de esta mejora.

### 7. Media — La validación permite intervalos de fechas invertidos

- Evidencia: `src/backend/32_request_service.js:461` verifica cada fecha contra
  el día actual, pero no compara inicio y fin. El cliente tampoco lo hace.
- Escenario reproducido: desconexión con inicio `2099-02-10` y fin `2099-02-01`
  supera `validateRequestPayload_`.
- Impacto: se pueden tramitar periodos incoherentes.
- Recomendación: acordar y aplicar una regla relacional común; por ejemplo,
  exigir que fin sea posterior a inicio. Determinar explícitamente si se admite
  una desconexión que empiece y termine el mismo día.

### 8. Media — Un comentario con llaves se confunde con una plantilla inválida

- Evidencia: `src/backend/31_mail_service.js:193` busca llaves en el texto
  después de sustituir los marcadores, incluyendo los datos introducidos.
- Escenario reproducido: con `mensaje_email={{comentarios}}`, el comentario
  `Pantalla muestra {ERROR}` se rechaza como variable mal formada.
- Impacto: un dato válido del usuario provoca un error que pide corregir la
  configuración, dificultando tanto el alta como el soporte.
- Recomendación: validar los marcadores sobre la plantilla original; insertar
  los valores como texto literal, sin volver a interpretarlos como plantilla.

### 9. Media — El botón desactivado no explica todos los requisitos pendientes

- Evidencia: `src/frontend/30_validation_submit.html:85` desactiva Registrar si
  falta cualquier requisito. Los mensajes generales de campos obligatorios se
  muestran en el envío, que no se puede activar mientras faltan esos requisitos.
  Algunos controles sí muestran errores inmediatamente, como las fechas.
- Escenario: el usuario completa casi todo, pero deja pendiente una respuesta
  SI/NO o la confirmación de ServiceNow. El botón permanece desactivado sin un
  resumen de lo que falta.
- Impacto: cuesta identificar el siguiente paso.
- Recomendación: mantener el bloqueo previsto en la especificación y mostrar
  junto al botón una lista breve de requisitos pendientes con acceso al control.
  Mejorar además el teclado del selector SI/NO: sus roles de radio actuales no
  incluyen navegación por flechas; se pueden usar radios nativos estilizados.

### 10. Baja — Logs repite información y no distingue motivos de rechazo

- Evidencia: `src/backend/00_constants.js:39` asigna un único mensaje fijo a
  cada evento. `src/backend/23_log_service.js:5` exige siete columnas, incluida
  `mensaje`. El contexto de rechazo incluye etapa y datos de clasificación,
  pero no un código que diferencie los motivos de validación.
- Escenario: dos rechazos en VALIDACION tienen el mismo evento y mensaje,
  aunque uno sea por fecha y otro por comentario obligatorio. Los errores
  públicos tampoco se escriben como excepción técnica en consola.
- Impacto: la columna ocupa espacio sin aportar información independiente;
  quitarla por sí sola no mejora el diagnóstico.
- Recomendación: conservar `evento`, retirar `mensaje` del esquema futuro y
  añadir un `motivo` estable y sin datos personales al contexto. Por ejemplo,
  `FECHA_NO_FUTURA`, `COMENTARIO_REQUERIDO` o `CONFIGURACION_INVALIDA`.
  No copiar comentarios, payloads ni excepciones a la hoja.
- Migración: no borrar directamente la columna actual. El logger rechazaría
  la cabecera y dejaría de escribir. Preparar primero compatibilidad de esquemas
  y conservar el histórico hasta una migración expresamente autorizada.

## Propuesta de parametrización por petición

Mantener `Elementos` como catálogo de opciones de negocio y añadir una sola
pestaña, `Campos_peticion`. Cada fila representa un campo de una opción concreta.
No introducir JSON editable, fórmulas ejecutables ni un constructor de formularios
generalista.

| id_elemento | campo | estado | orden | etiqueta | ayuda |
|---|---|---|---:|---|---|
| CAF-NUEVA | tienda | OBLIGATORIO | 10 | Tienda | Introduce y valida el código |
| CAF-NUEVA | enchufe_disponible | OBLIGATORIO | 20 | ¿Enchufe disponible? | |
| CAF-NUEVA | toma_agua_disponible | OBLIGATORIO | 30 | ¿Toma de agua disponible? | |
| CAF-NUEVA | foto_ubicacion | OBLIGATORIO | 40 | Foto ubicación | Muestra la ubicación prevista |
| CAF-NUEVA | foto_layout | OBLIGATORIO | 50 | Foto layout | |
| CAF-NUEVA | comentarios | OBLIGATORIO | 60 | Comentarios | Explica la petición al proveedor |

Los IDs son ejemplos de diseño, no datos para cargar automáticamente.
`estado` tendría tres valores: `OCULTO`, `OPCIONAL` y `OBLIGATORIO`.
Un campo oculto se descarta también en servidor; uno opcional se valida cuando
tiene valor. Esto requiere adaptar las validaciones actuales: las fotos, por
ejemplo, se tratan hoy como obligatorias cuando aparecen.

El código conserva un registro único de campos admitidos: componente, tipo,
validadores, límite técnico, nombre del payload y destino. Tiendas, fechas,
ServiceNow, SI/NO, comentarios y fotos son componentes reutilizables. Las fotos
siguen siendo adjuntos temporales y no se añaden a Registros.

Las invariantes del dominio siguen protegidas: una petición identifica tienda;
un movimiento requiere origen y destino distintos; los periodos tienen orden
coherente; las tiendas respetan permisos y filtros. La configuración no puede
desactivar esas garantías ni introducir campos desconocidos.

Crear una nueva opción con campos ya admitidos podría hacerse desde Sheets.
Crear un componente nuevo o una operación con semántica nueva seguiría
requiriendo código y pruebas. No se promete flexibilidad arbitraria.

`requiere_service_now` se conservaría durante la transición y después dejaría
de ser una segunda fuente de verdad: la obligatoriedad del código viviría en
`Campos_peticion`. Las reglas actuales se traducirían primero a un esquema
equivalente, verificando que ninguna petición cambia sus requisitos por accidente.
Un cambio de configuración mientras el formulario está abierto debe detectarse
al enviar y conservar el borrador mientras se actualizan sus requisitos.

Para facilitar la edición: desplegables con validación de datos, filtros,
cabecera congelada, protección de IDs y columnas técnicas, y una comprobación
de configuración que señale errores antes de ofrecer la opción a los usuarios.

## Sistema: categorías, descripciones y límites

Se recomienda conservar las primeras columnas y añadir las dos nuevas al final:

```text
clave | valor | categoria | descripcion
```

El lector actual usa posiciones 1 y 2 (`src/backend/20_config_service.js:19`),
por lo que añadir metadatos al final es compatible; colocarlos al principio
cambiaría qué valores interpreta. Conviene pasar a lectura por cabecera y
detectar claves duplicadas antes de permitir reordenar columnas.

Ejemplo de organización funcional:

| Clave | Categoría | Descripción |
|---|---|---|
| LOGO_URL | Identidad visual | Logo mostrado en la cabecera web y en los correos. |
| EMAIL_ADMIN | Acceso | Destinatario de las solicitudes de acceso. |
| EMAIL_CC_SOPORTE | Correo | Direcciones de soporte en copia, separadas por comas. |
| NOMBRE_REMITENTE_EMAIL | Correo | Nombre visible del remitente. |
| ASUNTO_EMAIL | Correo | Plantilla del asunto y sus marcadores admitidos. |
| URL_APP_COBERTURA | Ayuda | Dirección mostrada al solicitar la foto de cobertura. |
| LIMITE_REGISTROS_DIARIOS_USUARIO | Operación | Cupo diario por usuario, si el responsable funcional necesita decidirlo. |

El valor propuesto para `LOGO_URL` es:

```text
https://www.dia.es/content-manager/image/Logos_footer_header/web_logo.svg
```

Esa URL ya existe en `BRAND_ASSETS.LOGO_URL` y se usa en web y correo.
Añadir solamente la fila a Sistema no cambiaría el resultado: falta un resolver
común que consulte la clave, valide HTTPS y los orígenes permitidos, y aplique el
valor actual como predeterminado. No necesita UrlFetch, Drive, servicios avanzados
ni nuevos scopes. Se debe comprobar por separado la visualización del SVG en los
clientes de correo utilizados, no verificada en esta revisión.

Los cinco parámetros técnicos que sacaría de Sistema son:

- `LIMITE_INTENTOS_REGISTRO_VENTANA`;
- `VENTANA_INTENTOS_REGISTRO_SEGUNDOS`;
- `LIMITE_CONSULTAS_ACCESO_VENTANA`;
- `LIMITE_CONSULTAS_TIENDA_VENTANA`;
- `VENTANA_CONSULTAS_SEGUNDOS`.

Sus valores efectivos pasarían a constantes técnicas versionadas, manteniendo
las protecciones y sus valores actuales. Moverlos a otra pestaña editable
conservaría el mismo problema de mantenimiento. Las ventanas abiertas ya guardan
umbral y duración en Properties: la transición debe respetar su vencimiento.
El estado del limitador continúa en Properties; no se confunde con su configuración.

El cupo diario de solicitudes es una decisión de negocio distinta. Puede quedarse
con una descripción clara si se necesita ajustarlo; si tampoco se quiere administrar,
puede fijarse en código. La caché y ENTORNO también son técnicos y conviene
separarlos o protegerlos para que Sistema presente principalmente decisiones
que el responsable funcional sí pueda tomar.

## Orden recomendado de trabajo

1. Corregir la admisión de propiedades internas y la validación de Registros.
2. Validar el catálogo y resolver las opciones inaccesibles con proveedor vacío.
3. Centralizar el esquema de campos y reproducir los formularios actuales.
4. Habilitar Campos_peticion y verificar una modificación por opción sin despliegue.
5. Mejorar borradores, requisitos pendientes, fechas y sustitución de plantillas.
6. Incorporar metadatos de Sistema, LOGO_URL y constantes de seguridad.
7. Adaptar Logs con compatibilidad del histórico y motivos estructurados.

La retirada de columnas o filas existentes necesita una migración con destino
verificado, copia y autorización. Esta revisión no realiza ninguna retirada.

## Verificación y limitaciones

- `npm run check`: ESLint correcto; 11 suites y 155 pruebas correctas.
  Jest informó 5,56 segundos de ejecución; esto no mide el rendimiento de Apps Script.
- Seis reproducciones locales adicionales: adjuntos internos, gestión desconocida,
  Registros incompleto, comentario con llaves, fechas invertidas y opciones con/sin
  proveedor. Todos los comportamientos descritos se observaron en el código actual.
- Aviso de herramientas: Jest detecta otro `package.json` con el mismo nombre en
  `.kilo/worktrees/nervous-period`; no impidió superar la suite. Revisar las exclusiones
  de directorios de trabajo como mantenimiento separado.
- La revisión de UX se basa en estructura, estilos, controladores y simulaciones
  locales. Quedan pendientes la revisión visual real en móvil y escritorio, teclado,
  lector de pantalla e integración de identidad, permisos y correo en sandbox.
- Riesgo conocido fuera del foco principal: no existe idempotencia persistente.
  Una respuesta perdida después de guardar puede producir una segunda alta al
  reintentar. Está documentado y hay una prueba que confirma el segundo registro.
- Divergencia documental: README indica primer correlativo `0002` y migración de
  un contador legado; especificación, código y pruebas actuales utilizan `0001`
  y la propiedad de script. Debe corregirse el texto al abordar la siguiente entrega.
- No se han medido latencia, concurrencia o cuotas de Google. No se han cambiado
  scopes, servicios, permisos, configuración real ni código funcional.

Único archivo añadido: este informe.

# Historial de cambios

Los cambios relevantes siguen las categorías de Keep a Changelog. Se usa versionado semántico
cuando existe una versión publicada.

## Unreleased

### Añadido

- Cupo diario de registros por usuario, inicialmente 10 y configurable mediante
  `LIMITE_REGISTROS_DIARIOS_USUARIO` en `Sistema`; comprobación bajo bloqueo con la hoja
  `Registros` como fuente de verdad.
- Límites independientes de 30 comprobaciones de acceso y 60 búsquedas de tienda por usuario
  cada diez minutos para reducir consultas masivas.
- Dirección completa en la tarjeta de tienda y mayor tamaño de texto en ayudas y errores.
- Pestaña `Logs` con eventos operativos del alta; creación idempotente y escritura
  best effort sin comentarios ni datos de tienda.
- `ASUNTO_EMAIL` y `NOMBRE_REMITENTE_EMAIL` en `Sistema` para configurar asunto y nombre
  visible del remitente del correo de confirmación; se acepta temporalmente la antigua clave
  `ASUNTO_EMAL`.
- Botones «Buscar» para tienda e «Introducir» para ServiceNow, con confirmación explícita
  también en smartphone, y contador visual de caracteres en Comentarios.
- Especificación completa del flujo de solicitudes de neveras, lockers y cafeteras.
- Contrato responsive para smartphone, equipos de 14 pulgadas y monitores de 22 pulgadas o más.
- Tokens visuales semánticos, foco visible, movimiento reducido y soporte de colores forzados.
- Pruebas de roles permitidos, neutralización de fórmulas, ámbito de tienda y fallo de correo.

### Cambiado

- `Elementos.email_destino` admite varios destinatarios separados por comas, con validación y deduplicación.
- Movimientos y retiradas de cualquier equipo muestran y registran el campo «Fecha máxima de retirada»; es obligatorio solo para retiradas de lockers.
- El cupo diario lee `Registros` desde el final por bloques y reutiliza la cabecera al insertar.
- La caché fragmentada usa operaciones por lotes y la limpieza de limitadores continúa mientras
  queden estados vencidos; los estados corruptos de envíos se registran y recuperan.
- Los límites de altas, acceso y tienda comparten un único algoritmo parametrizado, conservando
  sus claves y formatos persistidos.
- Los errores de configuración indican la clave afectada y los fallos de notificación registran
  el `id_elemento` como contexto.
- El aviso ante un fallo de transporte se centraliza y puede configurarse mediante
  `MENSAJE_ERROR_TRANSPORTE_REGISTRO`.
- `npm run push` ejecuta ESLint y Jest antes de confirmar cambios; después hace `git push` y
  `clasp push`. Incluye `--dry-run` para comprobar sin escribir fuera del entorno local.
- El correo de confirmación añade una tarjeta HTML inspirada en la referencia DIA, conserva
  texto plano y no incluye el botón de apertura de la aplicación.
- El frontend se separa en estructura, estilos, navegación, formulario y validación/envío;
  la plantilla los compone directamente en Apps Script, sin compilación ni `dist/`.
- Se retiran todas las funciones `setup...` y sus datos de ejemplo. Las pestañas maestras se
  preparan manualmente; `Logs` mantiene su creación automática al primer evento.
- El asunto configurable admite `{{id_elemento}}`; el logo de cabecera deja de enlazar a una web.
- Se retira la deduplicación persistente de solicitudes: el formulario no envía clave de
  reintento y `Registros` ya no exige `clave_idempotencia` ni `huella_solicitud`. Las columnas
  existentes se conservan sin uso; siguen activos el bloqueo de doble clic y los límites.
- `Sistema` se prepara manualmente: se elimina `setupSistema()` y la clave `VERSION`;
  el nombre y la versión permanecen en `APP_METADATA`.
- El primer identificador de una instalación nueva termina en `0002`, sin reiniciar
  correlativos existentes superiores.
- `Logs` usa `fecha`, `nivel`, `evento`, `email`, `id_solicitud`, `mensaje` y `contexto`;
  el mensaje es fijo por evento y no incorpora texto del formulario ni excepciones.
- Se explicita que la aplicación no usa triggers; la limpieza de `Logs` permanece manual.
- Los límites de intentos de alta y consultas de acceso/tienda se configuran en `Sistema`;
  cada ventana conserva su configuración hasta expirar.
- Los textos operativos de confirmación y solicitud de acceso se configuran en `Sistema`.
- El aviso de Comentarios se configura en `Sistema` y se entrega tras autorizar al usuario.
- Las reglas de longitud de tienda, ServiceNow y Comentarios se inyectan desde las constantes
  del servidor en el formulario, sin duplicar números en el HTML.
- La limpieza de `Logs` queda manual y diaria; no se añade borrado automático.
- La configuración de `Sistema` se comparte dentro de cada flujo para evitar lecturas repetidas;
  tras migrar el contador, las altas no vuelven a leer la fila legada bajo bloqueo.
- Se descartan campos no aplicables antes de guardar y enviar correos; las CC duplicadas se
  eliminan.
- En movimientos, origen y destino deben ser tiendas distintas; todas las fechas rellenadas
  deben ser posteriores a hoy en la zona horaria del script. La validación se repite en servidor.
- Fuentes separados en `src/backend` y `src/frontend` sin paso de compilación.
- «Registrar solicitud» solo se habilita al completar y confirmar los campos necesarios;
  Comentarios se normaliza antes de persistir y enviar.
- `ULTIMO_ID_PETICION` se guarda en Script Properties; el valor legado se migra bajo bloqueo
  y se elimina su fila exacta de `Sistema` tras conservar el contador.
- Búsqueda exacta de tiendas numéricas (1–5 dígitos) bajo overlay, con ámbito `DELEGACION` comprobado también al registrar.
- Tarjeta de tienda validada conforme al componente compartido, sustituyendo la entrada y conservando su título.
- `Comentarios` obligatorio y limitado a 2.000 caracteres en cliente y servidor; aviso de envío directo al proveedor.
- Caché corta (5 s) para Usuarios y Elementos y larga (100 s) para Tiendas, configurable desde Sistema.
- Cabecera con logo DIA e iniciales del usuario; pie con nombre y versión de la aplicación.

- Regenerada la interfaz con componentes BEM, controles nativos y diálogo accesible.
- Renombradas las fuentes y pruebas con prefijos numéricos y `snake_case` para reflejar el orden
  de carga de Apps Script.
- `README.md` y `docs/domain/SPECIFICATION.md` describen ahora la aplicación real; se eliminan
  referencias obsoletas al flujo de Aperturas y Modificaciones.
- Los servicios internos de configuración y catálogo usan sufijo `_` y dejan de formar parte de
  la superficie invocable desde el navegador.
- El servidor normaliza la tienda a `codigo - nombre` después de verificar el ámbito del usuario.

### Corregido

- Las excepciones internas de `submitRequest` ya no quedan invisibles: se registran con etapa
  y traza saneada en Apps Script; los fallos de llamada también aparecen en la consola del navegador.
- Se rechazan en servidor los códigos ServiceNow mal formados incluso si se envían para un
  elemento que no los exige; un código obligatorio inválido impide generar ID o registrar.
- Las iniciales de emails con nombre y apellido separados por coma ahora reflejan ambos (`DR`).
- Un usuario activo con un rol ajeno a la lista cerrada ya no obtiene acceso.
- El texto que Sheets podría interpretar como fórmula se neutraliza antes de escribir.
- Un fallo de correo posterior a guardar ya no presenta el alta como fallida ni induce un reintento
  que podría duplicar el registro.
- Las opciones construidas desde Sheets se insertan con APIs DOM seguras en lugar de HTML dinámico.
- Eliminada la copia duplicada `test/SheetUtils (1).test.js`.

### Seguridad

- `submitRequest` admite inicialmente diez intentos por cuenta en diez minutos, incluidos los
  formularios inválidos; el umbral y la ventana se configuran en `Sistema`. Una vez iniciada
  la ventana, bloquea sin leer hojas, asignar ID, escribir o enviar correo.
  El contador persistente usa una clave seudonimizada, bloqueo concurrente y limpieza diaria
  de estados vencidos. `Logs` registra solo el primer bloqueo de cada ventana.
- El logger usa una ruta privada para crear `Logs` cuando hace falta.
- Se deniega identidad sin email, se validan destinatarios individuales y no se muestran errores
  internos de Sheets o Apps Script al usuario.
- `.gitignore` excluye `.clasp.json`, archivos `*.gsheet` y metadatos `desktop.ini`.
- La autorización se repite en servidor y valida estado, rol, elemento activo y tienda visible.

## Cómo mantener este archivo

- Registra cambios observables en `Unreleased`.
- Usa `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`, `Corregido` y `Seguridad`.
- Al publicar, mueve las entradas a `## [X.Y.Z] - AAAA-MM-DD`.
- Señala cambios incompatibles, migraciones y nuevas autorizaciones OAuth.
- No incluyas credenciales, IDs, datos personales ni detalles explotables sin corregir.

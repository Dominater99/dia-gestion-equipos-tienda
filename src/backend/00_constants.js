/**
 * Contratos base: nombres de pestañas, roles, equipos, tipos de gestión
 * fijos y expresiones de validación.
 *
 * Los proveedores y las combinaciones equipo/proveedor/gestión concretas ya
 * NO viven aquí: se leen en tiempo real de la pestaña Elementos (ver
 * 21_element_service.js), para poder añadir o desactivar opciones sin tocar
 * código. Lo que sí sigue fijo en código es el conjunto de "tipo_gestion"
 * posibles, porque cada uno dibuja un formulario distinto.
 */

const APP_METADATA = Object.freeze({
  NAME: 'Gestión de equipos de tienda',
  VERSION: '1.0.0'
});

const SHEET_NAMES = {
  USUARIOS: 'Usuarios',
  TIENDAS: 'Tiendas',
  SISTEMA: 'Sistema',
  REGISTROS: 'Registros',
  LOGS: 'Logs',
  ELEMENTOS: 'Elementos'
};

const LOG_EVENTS = Object.freeze({
  REQUEST_REGISTERED: 'SOLICITUD_REGISTRADA',
  REQUEST_REJECTED: 'SOLICITUD_RECHAZADA',
  MAIL_FAILED: 'NOTIFICACION_FALLIDA',
  RATE_LIMIT_EXCEEDED: 'LIMITE_ENVIOS_EXCEDIDO',
  RATE_LIMIT_STATE_INVALID: 'ESTADO_LIMITE_INVALIDO'
});

const LOG_DETAILS = Object.freeze({
  [LOG_EVENTS.REQUEST_REGISTERED]: Object.freeze({ level: 'INFO', message: 'Solicitud registrada correctamente.' }),
  [LOG_EVENTS.REQUEST_REJECTED]: Object.freeze({ level: 'AVISO', message: 'Solicitud rechazada.' }),
  [LOG_EVENTS.MAIL_FAILED]: Object.freeze({ level: 'AVISO', message: 'No se pudo enviar la confirmación.' }),
  [LOG_EVENTS.RATE_LIMIT_EXCEEDED]: Object.freeze({ level: 'AVISO', message: 'Límite de envíos excedido.' }),
  [LOG_EVENTS.RATE_LIMIT_STATE_INVALID]: Object.freeze({ level: 'ERROR', message: 'Estado del limitador no válido.' })
});

const RATE_LIMIT_CLEANUP = Object.freeze({
  INTERVAL_MS: 24 * 60 * 60 * 1000,
  MAX_DELETE: 50
});

const SUBMISSION_RATE_LIMIT = Object.freeze({
  // Valores de compatibilidad para ventanas ya abiertas antes de parametrizar Sistema.
  MAX_ATTEMPTS: 10,
  WINDOW_MS: 10 * 60 * 1000,
  PROPERTY_PREFIX: 'limite_envios_usuario:',
  CLEANUP_PROPERTY: 'limite_envios_limpieza',
  CLEANUP_INTERVAL_MS: RATE_LIMIT_CLEANUP.INTERVAL_MS,
  CLEANUP_MAX_DELETE: RATE_LIMIT_CLEANUP.MAX_DELETE
});

const READ_RATE_LIMIT = Object.freeze({
  WINDOW_MS: 10 * 60 * 1000,
  ACCESS_MAX_ATTEMPTS: 30,
  STORE_MAX_ATTEMPTS: 60,
  PROPERTY_PREFIX: 'limite_lecturas_usuario:',
  CLEANUP_PROPERTY: 'limite_lecturas_limpieza',
  CLEANUP_INTERVAL_MS: RATE_LIMIT_CLEANUP.INTERVAL_MS,
  CLEANUP_MAX_DELETE: RATE_LIMIT_CLEANUP.MAX_DELETE
});

const SCRIPT_LOCK_WAIT_MS = 10000;

function publicError_(message) {
  const error = new Error(message);
  error.isPublic = true;
  return error;
}

function publicErrorMessage_(error, fallback) {
  return error && error.isPublic === true ? error.message : fallback;
}

const ROLES = {
  GESTOR_DELEGACION: 'GESTOR_DELEGACION',
  GESTOR_GLOBAL: 'GESTOR_GLOBAL',
  ADMINISTRADOR: 'ADMINISTRADOR'
};

const EQUIPOS = {
  NEVERA: 'NEVERA',
  LOCKER: 'LOCKER',
  CAFETERA: 'CAFETERA'
};

const TIPOS_GESTION = {
  NUEVA_SOLICITUD: 'NUEVA_SOLICITUD',
  MOVIMIENTO: 'MOVIMIENTO',
  DESCONEXION_TEMPORAL: 'DESCONEXION_TEMPORAL',
  RETIRADA: 'RETIRADA',
  INCIDENCIA_SERVICENOW: 'INCIDENCIA_SERVICENOW',
  RECLAMACION_SIN_PARTE: 'RECLAMACION_SIN_PARTE'
};

// Contrato único para las validaciones de servidor y la plantilla del cliente.
const SERVICE_NOW_PREFIX = 'TASK';
const SERVICE_NOW_DIGITS = 7;
const STORE_ID_MAX_LENGTH = 5;
const SERVICENOW_PATTERN = new RegExp(
  '^' + SERVICE_NOW_PREFIX + '[0-9]{' + SERVICE_NOW_DIGITS + '}$'
);
const STORE_ID_PATTERN = new RegExp('^[0-9]{1,' + STORE_ID_MAX_LENGTH + '}$');
const MAX_COMMENT_LENGTH = 2000;
const REQUEST_ID_PREFIX = 'SOL';
const REQUEST_ID_MIN_DIGITS = 4;
const REQUEST_COUNTER_INITIAL_VALUE = 1;
const CACHE_JSON_CHUNK_CHARACTERS = 20000;
const CACHE_JSON_MAX_CHUNKS = 900;
const REGISTROS_SCAN_BATCH_ROWS = 100;
function formatCount_(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
const VALIDATION_MESSAGES = Object.freeze({
  STORE_CODE: 'La tienda debe contener entre 1 y ' + STORE_ID_MAX_LENGTH + ' dígitos.',
  SERVICE_NOW: 'El código de ServiceNow debe tener el formato ' + SERVICE_NOW_PREFIX +
    ' seguido de ' + SERVICE_NOW_DIGITS + ' dígitos.',
  COMMENT_LIMIT: 'El campo Comentarios no puede superar los ' +
    formatCount_(MAX_COMMENT_LENGTH) + ' caracteres.'
});
const DAILY_REQUEST_LIMIT_DEFAULT = 10;
const REQUEST_COUNTER_KEY = 'ULTIMO_ID_PETICION';
const MAIL_DEFAULTS = Object.freeze({
  SUPPORT_CC_EMAIL: 'dia.es.soporte.layouts@diagroup.com',
  SENDER_NAME: 'Dia Layouts',
  SUBJECT_TEMPLATE: '[Gestión equipos]-{{equipo}}-{{tipo_gestion}}- {{tienda}}-{{provincia}}-{{municipio}}-{{direccion}}',
  CONFIRMATION_GREETING: 'Hola {{nombre}},',
  CONFIRMATION_INTRO: 'Tu solicitud ha quedado registrada con el identificador {{id_peticion}}.',
  CONFIRMATION_FOOTER: 'Este correo es una confirmación automática, no es necesario responder.',
  ACCESS_REQUEST_SUBJECT: 'Solicitud de acceso - ' + APP_METADATA.NAME,
  ACCESS_REQUEST_BODY: 'Hola,\n\nSolicito acceso a la aplicación ' + APP_METADATA.NAME +
    ' con mi cuenta {{email}}.\n\nGracias.'
});
const MAIL_FIELD_LABELS = Object.freeze({
  EQUIPMENT: 'Equipo: ',
  PROVIDER: 'Proveedor: ',
  MANAGEMENT: 'Tipo de gestión: ',
  DETAIL: 'Detalle: ',
  STORE: 'Tienda: ',
  ORIGIN_STORE: 'Tienda origen: ',
  DESTINATION_STORE: 'Tienda destino: ',
  COLLECTION_DEADLINE: 'Fecha límite de recogida: ',
  START_DATE: 'Fecha de inicio: ',
  END_DATE: 'Fecha de fin: ',
  WITHDRAWAL_DEADLINE: 'Fecha máxima de retirada: ',
  SERVICE_NOW: 'Código ServiceNow: ',
  COMMENTS: 'Comentarios: '
});
const UI_TEXT_DEFAULTS = Object.freeze({
  COMMENTS_HINT: 'Por favor, redacta correctamente el contenido, ya que se enviará directamente al proveedor.',
  SUBMISSION_TRANSPORT_FAILURE: 'No se pudo confirmar si la solicitud se registró. Comprueba si recibes el correo de confirmación antes de volver a intentarlo.'
});

const SYSTEM_PARAM_KEYS = {
  ENVIRONMENT: 'ENTORNO',
  CACHE_ENABLED: 'CACHE_HABILITADA',
  CACHE_SHORT_TTL_SECONDS: 'CACHE_TTL_CORTO_SEGUNDOS',
  CACHE_LONG_TTL_SECONDS: 'CACHE_TTL_LARGO_SEGUNDOS',
  ADMIN_EMAIL: 'EMAIL_ADMIN',
  SUPPORT_CC_EMAIL: 'EMAIL_CC_SOPORTE',
  MAIL_SENDER_NAME: 'NOMBRE_REMITENTE_EMAIL',
  MAIL_SUBJECT: 'ASUNTO_EMAIL',
  LEGACY_MAIL_SUBJECT: 'ASUNTO_EMAL',
  MAIL_CONFIRMATION_GREETING: 'SALUDO_CONFIRMACION_EMAIL',
  MAIL_CONFIRMATION_INTRO: 'TEXTO_CONFIRMACION_EMAIL',
  MAIL_CONFIRMATION_FOOTER: 'PIE_CONFIRMACION_EMAIL',
  ACCESS_REQUEST_SUBJECT: 'ASUNTO_SOLICITUD_ACCESO',
  ACCESS_REQUEST_BODY: 'CUERPO_SOLICITUD_ACCESO',
  COMMENTS_HINT: 'AVISO_COMENTARIOS',
  SUBMISSION_TRANSPORT_FAILURE: 'MENSAJE_ERROR_TRANSPORTE_REGISTRO',
  DAILY_USER_REQUEST_LIMIT: 'LIMITE_REGISTROS_DIARIOS_USUARIO',
  SUBMISSION_ATTEMPTS_LIMIT: 'LIMITE_INTENTOS_REGISTRO_VENTANA',
  SUBMISSION_WINDOW_SECONDS: 'VENTANA_INTENTOS_REGISTRO_SEGUNDOS',
  ACCESS_LOOKUPS_LIMIT: 'LIMITE_CONSULTAS_ACCESO_VENTANA',
  STORE_LOOKUPS_LIMIT: 'LIMITE_CONSULTAS_TIENDA_VENTANA',
  READ_WINDOW_SECONDS: 'VENTANA_CONSULTAS_SEGUNDOS',
  LEGACY_COUNTER: REQUEST_COUNTER_KEY
};

const SCRIPT_PROPERTY_KEYS = Object.freeze({
  REQUEST_COUNTER: REQUEST_COUNTER_KEY,
  COUNTER_MIGRATED: 'ULTIMO_ID_PETICION_MIGRADO'
});

const CACHE_DEFAULTS = Object.freeze({
  ENABLED: true,
  SHORT_TTL_SECONDS: 5,
  LONG_TTL_SECONDS: 100
});

const CACHE_KEYS = Object.freeze({
  SYSTEM: 'solicitudes:sistema',
  USERS: 'solicitudes:usuarios',
  ELEMENTS: 'solicitudes:elementos',
  STORES: 'solicitudes:tiendas'
});

const STORE_COLUMNS = Object.freeze([
  'apnut', 'tienda_id', 'delegacion_desc', 'planograma_desc',
  'agr_comercial_id', 'agr_comercial_desc', 'metros_totales',
  'almacen_desc', 'direccion', 'municipio', 'provincia', 'estado'
]);

const ESTADO_TIENDA = {
  ABIERTA: 'ABIERTA',
  CERRADA: 'CERRADA'
};

const ESTADO_ELEMENTO = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
};

const ESTADO_USUARIO_ACTIVO = 'ACTIVO';

// Exporta las constantes para poder testearlas con Jest fuera del runtime de
// Apps Script. `module` no existe en Apps Script, así que este bloque nunca
// se ejecuta allí.
if (typeof module !== 'undefined') {
  module.exports = {
    APP_METADATA,
    SHEET_NAMES,
    LOG_EVENTS,
    LOG_DETAILS,
    RATE_LIMIT_CLEANUP,
    SUBMISSION_RATE_LIMIT,
    READ_RATE_LIMIT,
    SCRIPT_LOCK_WAIT_MS,
    publicError_,
    publicErrorMessage_,
    ROLES,
    EQUIPOS,
    TIPOS_GESTION,
    SERVICENOW_PATTERN,
    STORE_ID_PATTERN,
    SERVICE_NOW_PREFIX,
    SERVICE_NOW_DIGITS,
    STORE_ID_MAX_LENGTH,
    MAX_COMMENT_LENGTH,
    REQUEST_ID_PREFIX,
    REQUEST_ID_MIN_DIGITS,
    REQUEST_COUNTER_INITIAL_VALUE,
    CACHE_JSON_CHUNK_CHARACTERS,
    CACHE_JSON_MAX_CHUNKS,
    REGISTROS_SCAN_BATCH_ROWS,
    formatCount_,
    VALIDATION_MESSAGES,
    DAILY_REQUEST_LIMIT_DEFAULT,
    MAIL_DEFAULTS,
    MAIL_FIELD_LABELS,
    UI_TEXT_DEFAULTS,
    SYSTEM_PARAM_KEYS,
    SCRIPT_PROPERTY_KEYS,
    CACHE_DEFAULTS,
    CACHE_KEYS,
    STORE_COLUMNS,
    ESTADO_TIENDA,
    ESTADO_ELEMENTO,
    ESTADO_USUARIO_ACTIVO
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

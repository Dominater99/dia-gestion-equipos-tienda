/**
 * Servicio de configuración respaldado por la pestaña Sistema.
 * Formato: clave, valor, categoria, descripcion (acepta la antigua cabecera parametro).
 * una fila por parámetro (ver SYSTEM_PARAM_KEYS en 00_constants.js).
 */

const SYSTEM_PARAM_METADATA = Object.freeze({
  ENTORNO: { categoria: 'Técnica', descripcion: 'Etiqueta informativa del entorno; no selecciona las pestañas ni cambia el despliegue.' },
  CACHE_HABILITADA: { categoria: 'Técnica', descripcion: 'Activa la caché de datos maestros. Modificar solo durante una comprobación técnica.' },
  CACHE_TTL_CORTO_SEGUNDOS: { categoria: 'Técnica', descripcion: 'Segundos hasta refrescar usuarios, opciones, campos y configuración tras una edición manual.' },
  CACHE_TTL_LARGO_SEGUNDOS: { categoria: 'Técnica', descripcion: 'Segundos hasta refrescar tiendas y contactos de delegación.' },
  EMAIL_ADMIN: { categoria: 'Acceso', descripcion: 'Buzón al que se dirige Solicitar acceso.' },
  EMAIL_CC_SOPORTE: { categoria: 'Correo', descripcion: 'Correos de soporte en copia, separados por comas. En TEST se ignoran: todo se entrega al buzón privado de pruebas.' },
  NOMBRE_REMITENTE_EMAIL: { categoria: 'Correo', descripcion: 'Nombre visible del remitente de las confirmaciones.' },
  ASUNTO_EMAIL: { categoria: 'Correo', descripcion: 'Plantilla del asunto. Admite {{id_elemento}}, {{equipo}}, {{tipo_gestion}}, {{tienda}}, {{provincia}}, {{municipio}} y {{direccion}}.' },
  ASUNTO_EMAL: { categoria: 'Compatibilidad', descripcion: 'Nombre antiguo de ASUNTO_EMAIL; solo se utiliza si falta la clave correcta.' },
  URL_APP_COBERTURA: { categoria: 'Ayuda', descripcion: 'Dirección que se muestra como ayuda al pedir la foto de cobertura.' },
  LOGO_URL: { categoria: 'Identidad visual', descripcion: 'Logo de la web y de los correos. Solo admite HTTPS en www.dia.es; vacío usa el logo oficial predeterminado.' },
  LIMITE_REGISTROS_DIARIOS_USUARIO: { categoria: 'Operación', descripcion: 'Máximo de solicitudes guardadas por usuario y día de Madrid. Entero positivo; vacío utiliza 10.' }
});

const TECHNICAL_RATE_PARAM_KEYS = Object.freeze([
  SYSTEM_PARAM_KEYS.SUBMISSION_ATTEMPTS_LIMIT, SYSTEM_PARAM_KEYS.SUBMISSION_WINDOW_SECONDS,
  SYSTEM_PARAM_KEYS.ACCESS_LOOKUPS_LIMIT, SYSTEM_PARAM_KEYS.STORE_LOOKUPS_LIMIT, SYSTEM_PARAM_KEYS.READ_WINDOW_SECONDS
]);

/**
 * Devuelve todos los parámetros de Sistema como un objeto clave -> valor.
 * @returns {Object}
 */
function getSystemParams_() {
  const cached = getCachedJson_(CACHE_KEYS.SYSTEM);
  if (cached !== null) return cached;

  const values = getSheet_(SHEET_NAMES.SISTEMA).getDataRange().getValues();
  const columns = systemColumns_(values[0] || []);
  const params = {};

  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][columns.key] || '').trim().toUpperCase();
    const value = values[i][columns.value];
    if (key) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        throw configurationError_('Sistema, fila ' + (i + 1) + ': clave duplicada ' + key + '.');
      }
      params[key] = value;
    }
  }

  if (parseBooleanParam_(params[SYSTEM_PARAM_KEYS.CACHE_ENABLED], CACHE_DEFAULTS.ENABLED)) {
    putCachedJson_(
      CACHE_KEYS.SYSTEM,
      params,
      normalizeCacheTtl_(params[SYSTEM_PARAM_KEYS.CACHE_SHORT_TTL_SECONDS], CACHE_DEFAULTS.SHORT_TTL_SECONDS)
    );
  }
  return params;
}

function systemColumns_(headers) {
  const normalized = headers.map(normalizeHeader_);
  const key = normalized.includes('clave') ? normalized.indexOf('clave') : normalized.indexOf('parametro');
  const value = normalized.indexOf('valor');
  if (key < 0 || value < 0) throw configurationError_('Sistema debe incluir las columnas clave y valor.');
  return { key: key, value: value };
}

function resolveLogoUrl_(params) {
  const url = textSystemParam_(params || {}, SYSTEM_PARAM_KEYS.LOGO_URL, BRAND_ASSETS.LOGO_URL);
  if (!/^https:\/\/www\.dia\.es\/[^\s<>"'\\]*$/.test(url)) {
    throw configurationError_('Revisa LOGO_URL: debe ser una URL HTTPS de www.dia.es.');
  }
  return url;
}

/**
 * Devuelve la configuración efectiva de caché con valores seguros por defecto.
 * @returns {{enabled: boolean, shortTtlSeconds: number, longTtlSeconds: number}}
 */
function getCacheConfig_(systemParams) {
  const params = systemParams || getSystemParams_();
  return {
    enabled: parseBooleanParam_(params[SYSTEM_PARAM_KEYS.CACHE_ENABLED], CACHE_DEFAULTS.ENABLED),
    shortTtlSeconds: normalizeCacheTtl_(
      params[SYSTEM_PARAM_KEYS.CACHE_SHORT_TTL_SECONDS],
      CACHE_DEFAULTS.SHORT_TTL_SECONDS
    ),
    longTtlSeconds: normalizeCacheTtl_(
      params[SYSTEM_PARAM_KEYS.CACHE_LONG_TTL_SECONDS],
      CACHE_DEFAULTS.LONG_TTL_SECONDS
    )
  };
}

function parseBooleanParam_(value, fallback) {
  if (value === '' || value === null || typeof value === 'undefined') return fallback;
  return String(value).trim().toUpperCase() === 'TRUE';
}

function normalizeCacheTtl_(value, fallback) {
  const ttl = Number(value);
  return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : fallback;
}

/** Lee un umbral operativo; un valor configurado inválido falla cerrado. */
function positiveIntegerSystemParam_(params, key, fallback) {
  const raw = params[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const text = String(raw).trim();
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1) {
    throw publicError_('Revisa ' + key + ' en Sistema: debe ser un entero positivo.');
  }
  return value;
}

function rateWindowMs_(params, key, fallbackMs) {
  const seconds = positiveIntegerSystemParam_(params, key, fallbackMs / 1000);
  const milliseconds = seconds * 1000;
  if (!Number.isSafeInteger(milliseconds)) {
    throw publicError_('Revisa ' + key + ' en Sistema: la ventana es demasiado grande.');
  }
  return milliseconds;
}

/** Devuelve texto de Sistema o su valor inicial cuando la celda está vacía. */
function textSystemParam_(params, key, fallback) {
  const raw = params[key];
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  return text || fallback;
}

/**
 * Actualiza el valor de un parámetro existente en Sistema, o lo crea si no existe.
 * @param {string} key
 * @param {*} value
 */
function setSystemParam_(key, value) {
  removeCachedJson_(CACHE_KEYS.SYSTEM);
  const sheet = getSheet_(SHEET_NAMES.SISTEMA);
  const values = sheet.getDataRange().getValues();
  const columns = systemColumns_(values[0] || []);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][columns.key]).trim() === key) {
      sheet.getRange(i + 1, columns.value + 1).setValue(value);
      return;
    }
  }
  const row = values[0].map(function () { return ''; });
  row[columns.key] = key;
  row[columns.value] = value;
  sheet.appendRow(row);
}

if (typeof module !== 'undefined') {
  module.exports = {
    getSystemParams_,
    getCacheConfig_,
    parseBooleanParam_,
    normalizeCacheTtl_,
    positiveIntegerSystemParam_,
    rateWindowMs_,
    textSystemParam_,
    setSystemParam_,
    systemColumns_, resolveLogoUrl_,
    SYSTEM_PARAM_METADATA, TECHNICAL_RATE_PARAM_KEYS
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

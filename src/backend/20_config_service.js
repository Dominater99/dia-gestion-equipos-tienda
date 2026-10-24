/**
 * Servicio de configuración respaldado por la pestaña Sistema.
 * Formato esperado de la pestaña: dos columnas, "clave" y "valor",
 * una fila por parámetro (ver SYSTEM_PARAM_KEYS en 00_constants.js).
 */

/**
 * Devuelve todos los parámetros de Sistema como un objeto clave -> valor.
 * @returns {Object}
 */
function getSystemParams_() {
  const cached = getCachedJson_(CACHE_KEYS.SYSTEM);
  if (cached !== null) return cached;

  const values = getSheet_(SHEET_NAMES.SISTEMA).getDataRange().getValues();
  const params = {};

  for (let i = 1; i < values.length; i++) {
    const key = values[i][0];
    const value = values[i][1];
    if (key) {
      params[String(key).trim()] = value;
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

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
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
    setSystemParam_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

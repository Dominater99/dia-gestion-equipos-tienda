/**
 * Adaptador de lectura y escritura para las hojas de cálculo.
 * El resto de servicios (Auth, ConfigService, StoreService, RequestService)
 * se apoyan en estas funciones para no repetir lógica de acceso a Sheets.
 */

/**
 * Devuelve la hoja indicada del libro activo, lanzando un error claro si no existe.
 * @param {string} sheetName Nombre de la pestaña.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('No se encuentra la pestaña "' + sheetName + '".');
  }
  return sheet;
}

/**
 * Convierte el contenido de una hoja (con cabecera en la fila 1) en un array de objetos,
 * usando los nombres de columna normalizados (minúsculas, espacios por guiones bajos)
 * como claves. Ignora filas completamente vacías.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Array<Object>}
 */
function readSheetAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(normalizeHeader_);
  const rows = values.slice(1);

  return rows
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (header, i) {
        obj[header] = row[i];
      });
      return obj;
    });
}

/**
 * Lee una colección JSON de CacheService. Los datos se dividen en fragmentos
 * pequeños para no depender del tamaño máximo de una única entrada de caché.
 * @param {string} key
 * @returns {*|null}
 */
function getCachedJson_(key) {
  const cache = CacheService.getScriptCache();
  const manifestText = cache.get(key);
  if (!manifestText) return null;

  try {
    const manifest = JSON.parse(manifestText);
    if (!Number.isSafeInteger(manifest.chunks) || manifest.chunks < 1 ||
        manifest.chunks > CACHE_JSON_MAX_CHUNKS) {
      throw new Error('Manifiesto de caché inválido.');
    }
    const keys = [];
    for (let i = 0; i < manifest.chunks; i++) keys.push(key + ':' + i);
    const fragments = cache.getAll(keys);
    let serialized = '';
    for (let i = 0; i < keys.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(fragments, keys[i])) return null;
      serialized += fragments[keys[i]];
    }
    return JSON.parse(serialized);
  } catch {
    removeCachedJson_(key);
    return null;
  }
}

/**
 * Guarda JSON en fragmentos de 20.000 caracteres (como máximo 80 KB UTF-8
 * incluso si todos los caracteres ocupasen cuatro bytes).
 * @param {string} key
 * @param {*} value
 * @param {number} ttlSeconds
 */
function putCachedJson_(key, value, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  const serialized = JSON.stringify(value);
  const chunks = [];
  for (let offset = 0; offset < serialized.length; offset += CACHE_JSON_CHUNK_CHARACTERS) {
    chunks.push(serialized.slice(offset, offset + CACHE_JSON_CHUNK_CHARACTERS));
  }
  if (!chunks.length) chunks.push('null');
  if (chunks.length > CACHE_JSON_MAX_CHUNKS) return;

  removeCachedJson_(key);
  const fragments = {};
  chunks.forEach(function (chunk, index) {
    fragments[key + ':' + index] = chunk;
  });
  cache.putAll(fragments, ttlSeconds);
  cache.put(key, JSON.stringify({ chunks: chunks.length }), ttlSeconds);
}

/**
 * Elimina el manifiesto y todos los fragmentos conocidos de una entrada JSON.
 * @param {string} key
 */
function removeCachedJson_(key) {
  const cache = CacheService.getScriptCache();
  const manifestText = cache.get(key);
  if (manifestText) {
    try {
      const chunks = Number(JSON.parse(manifestText).chunks) || 0;
      if (Number.isSafeInteger(chunks) && chunks > 0 && chunks <= CACHE_JSON_MAX_CHUNKS) {
        const keys = [];
        for (let i = 0; i < chunks; i++) keys.push(key + ':' + i);
        cache.removeAll(keys);
      }
    } catch {
      // Un manifiesto corrupto no debe impedir invalidar la clave principal.
    }
  }
  cache.remove(key);
}

/**
 * Lee una hoja como objetos usando caché de script cuando está habilitada.
 * @param {string} sheetName
 * @param {string} cacheKey
 * @param {number} ttlSeconds
 * @param {boolean} cacheEnabled
 * @param {Array<string>=} columns Columnas permitidas cuando se proyecta un maestro.
 * @returns {Array<Object>}
 */
function readSheetAsObjectsCached_(sheetName, cacheKey, ttlSeconds, cacheEnabled, columns) {
  if (cacheEnabled) {
    const cached = getCachedJson_(cacheKey);
    if (cached !== null) return cached;
  }

  let rows = readSheetAsObjects_(getSheet_(sheetName));
  if (columns) {
    rows = rows.map(function (row) {
      const projected = {};
      columns.forEach(function (column) {
        projected[column] = row[column];
      });
      return projected;
    });
  }
  if (cacheEnabled) putCachedJson_(cacheKey, rows, ttlSeconds);
  return rows;
}

/**
 * Normaliza una cabecera de columna: recorta espacios, pasa a minúsculas
 * y sustituye espacios por guiones bajos.
 * @param {string} header
 * @returns {string}
 */
function normalizeHeader_(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Añade una fila a una hoja a partir de un objeto, respetando el orden de las
 * cabeceras ya existentes en la fila 1. Las claves del objeto que no coincidan
 * con ninguna cabecera se ignoran; las cabeceras sin valor en el objeto se dejan en blanco.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Object} rowObject
 * @param {Array<string>=} knownHeaders Cabeceras ya leídas y normalizadas.
 */
function appendRowFromObject_(sheet, rowObject, knownHeaders) {
  const headers = knownHeaders || sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(normalizeHeader_);

  const row = headers.map(function (header) {
    const value = Object.prototype.hasOwnProperty.call(rowObject, header) ? rowObject[header] : '';
    return escapeFormulaValue_(value);
  });

  sheet.appendRow(row);
}

/**
 * Evita que texto procedente del formulario se evalúe como fórmula en Sheets.
 * Conserva números, fechas, booleanos y cadenas que no empiezan por un operador.
 * @param {*} value
 * @returns {*}
 */
function escapeFormulaValue_(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

// Exporta las funciones para poder testearlas con Jest fuera del runtime de
// Apps Script (ver 00_constants.js para la explicación del guard).
if (typeof module !== 'undefined') {
  module.exports = {
    getSheet_,
    readSheetAsObjects_,
    getCachedJson_,
    putCachedJson_,
    removeCachedJson_,
    readSheetAsObjectsCached_,
    normalizeHeader_,
    appendRowFromObject_,
    escapeFormulaValue_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

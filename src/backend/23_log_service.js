/**
 * Auditoría operativa mínima. El contexto contiene metadatos estructurados
 * de la solicitud; nunca copia tiendas, comentarios ni excepciones a Logs.
 */
const HEADERS_LOGS = ['fecha', 'nivel', 'evento', 'email', 'id_solicitud', 'contexto'];
const LEGACY_HEADERS_LOGS = ['fecha', 'nivel', 'evento', 'email', 'id_solicitud', 'mensaje', 'contexto'];
const LOG_CONTEXT_MAX_LENGTH = 1000;

function logAppEventSafely_(event, idPeticion, context, email) {
  try {
    const details = LOG_DETAILS[event];
    if (!details) throw new Error('Evento de log no admitido.');

    const sheet = getOrCreateLogsSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const legacy = LEGACY_HEADERS_LOGS.every(function (header, index) { return headers[index] === header; });
    if (!legacy && !HEADERS_LOGS.every(function (header, index) { return headers[index] === header; })) {
      throw new Error('La cabecera de Logs no coincide con el esquema esperado.');
    }
    const row = [
      new Date(), details.level, event,
      escapeFormulaValue_(String(email || '').trim().toLowerCase()),
      escapeFormulaValue_(String(idPeticion || '')),
      escapeFormulaValue_(serializeLogContext_(context))
    ];
    if (legacy) row.splice(5, 0, details.message);
    sheet.appendRow(row);
    return true;
  } catch {
    // Un fallo de auditoría secundaria no cambia una solicitud ya registrada.
    console.error('No se pudo escribir el evento en Logs.');
    return false;
  }
}

function serializeLogContext_(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error('El contexto de Logs debe ser un objeto.');
  }
  const serialized = JSON.stringify(context);
  if (serialized.length > LOG_CONTEXT_MAX_LENGTH) {
    throw new Error('El contexto de Logs supera el tamaño permitido.');
  }
  return serialized;
}

function getOrCreateLogsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const logsName = physicalSheetName_(SHEET_NAMES.LOGS);
  const existing = spreadsheet.getSheetByName(logsName);
  if (existing) return existing;

  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    // Recomprueba dentro del bloqueo: dos peticiones pueden crear Logs a la vez.
    const alreadyCreated = spreadsheet.getSheetByName(logsName);
    if (alreadyCreated) return alreadyCreated;
    const sheet = spreadsheet.insertSheet(logsName);
    sheet.appendRow(HEADERS_LOGS);
    sheet.getRange(1, 1, 1, HEADERS_LOGS.length)
      .setFontWeight('bold')
      .setBackground('#E2001A')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
    return sheet;
  } finally {
    lock.releaseLock();
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    HEADERS_LOGS,
    LEGACY_HEADERS_LOGS,
    LOG_CONTEXT_MAX_LENGTH,
    logAppEventSafely_,
    serializeLogContext_,
    getOrCreateLogsSheet_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

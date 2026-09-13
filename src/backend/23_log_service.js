/**
 * Auditoría operativa mínima. Solo escribe el email del solicitante y
 * mensajes fijos; nunca copia tiendas, comentarios ni excepciones a Logs.
 */
const HEADERS_LOGS = ['fecha', 'nivel', 'evento', 'email', 'id_solicitud', 'mensaje', 'contexto'];

function logAppEventSafely_(event, idPeticion, stage, email) {
  try {
    const details = LOG_DETAILS[event];
    if (!details) throw new Error('Evento de log no admitido.');

    const sheet = getOrCreateLogsSheet_();
    const headers = sheet.getRange(1, 1, 1, HEADERS_LOGS.length).getValues()[0];
    if (!HEADERS_LOGS.every(function (header, index) { return headers[index] === header; })) {
      throw new Error('La cabecera de Logs no coincide con el esquema esperado.');
    }
    sheet.appendRow([
      new Date(), details.level, event,
      escapeFormulaValue_(String(email || '').trim().toLowerCase()),
      escapeFormulaValue_(String(idPeticion || '')),
      details.message,
      escapeFormulaValue_(String(stage || ''))
    ]);
    return true;
  } catch {
    // Un fallo de auditoría secundaria no cambia una solicitud ya registrada.
    console.error('No se pudo escribir el evento en Logs.');
    return false;
  }
}

function getOrCreateLogsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const existing = spreadsheet.getSheetByName(SHEET_NAMES.LOGS);
  if (existing) return existing;

  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    // Recomprueba dentro del bloqueo: dos peticiones pueden crear Logs a la vez.
    const alreadyCreated = spreadsheet.getSheetByName(SHEET_NAMES.LOGS);
    if (alreadyCreated) return alreadyCreated;
    const sheet = spreadsheet.insertSheet(SHEET_NAMES.LOGS);
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
  module.exports = { HEADERS_LOGS, logAppEventSafely_, getOrCreateLogsSheet_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

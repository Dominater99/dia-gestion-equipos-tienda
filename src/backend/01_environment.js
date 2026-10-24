/** El paquete de pruebas sustituye esta declaración antes de enviarse a Apps Script. */
const EXECUTION_CONFIG = Object.freeze({ mode: 'PROD', testEmail: '' });

function isTestEnvironment_() {
  if (EXECUTION_CONFIG.mode !== 'PROD' && EXECUTION_CONFIG.mode !== 'TEST') {
    throw new Error('Entorno de ejecución no admitido.');
  }
  return EXECUTION_CONFIG.mode === 'TEST';
}

function physicalSheetName_(logicalName) {
  const testing = isTestEnvironment_();
  if (testing && Object.keys(SHEET_NAMES).every(function (key) { return SHEET_NAMES[key] !== logicalName; })) {
    throw new Error('Pestaña fuera del contrato de la aplicación.');
  }
  return (testing ? 'TEST_' : '') + logicalName;
}

function environmentCacheKey_(key) {
  return isTestEnvironment_() && !String(key).startsWith('test:') ? 'test:' + key : key;
}

function testRecipient_() {
  if (!isTestEnvironment_()) throw new Error('Esta operación solo está disponible en pruebas.');
  return normalizeSingleEmail_(EXECUTION_CONFIG.testEmail, 'buzón de pruebas');
}

if (typeof module !== 'undefined') {
  module.exports = { isTestEnvironment_, physicalSheetName_, environmentCacheKey_, testRecipient_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

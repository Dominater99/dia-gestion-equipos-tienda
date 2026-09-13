/**
 * Punto de entrada HTTP de la web app.
 */

/**
 * Sirve la SPA principal (frontend/99_index.html) al hacer GET sobre la URL de despliegue.
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  const template = HtmlService.createTemplateFromFile('frontend/99_index');
  template.applicationName = APP_METADATA.NAME;
  template.applicationVersion = APP_METADATA.VERSION;
  template.applicationTimeZone = Session.getScriptTimeZone();
  template.commentMaxLength = MAX_COMMENT_LENGTH;
  template.commentMaxLengthDisplay = formatCount_(MAX_COMMENT_LENGTH);
  template.storeIdMaxLength = STORE_ID_MAX_LENGTH;
  template.serviceNowPrefix = SERVICE_NOW_PREFIX;
  template.serviceNowDigits = SERVICE_NOW_DIGITS;

  return template.evaluate()
    .setTitle(APP_METADATA.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

if (typeof module !== 'undefined') {
  module.exports = { doGet };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

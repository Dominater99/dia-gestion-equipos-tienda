/**
 * Servicio de consulta de contactos configurados por delegación.
 * Solo se usa al renderizar un mensaje_email que contiene un marcador de
 * delegación, por lo que no afecta a los correos que no lo utilizan.
 */

function getDelegationContact_(delegation, cacheConfig) {
  const normalizedDelegation = normalizeDelegationName_(delegation);
  if (!normalizedDelegation) {
    throw publicError_('No se ha podido determinar la delegación de la tienda para el correo.');
  }

  const config = cacheConfig || getCacheConfig_();
  const contacts = readSheetAsObjectsCached_(
    SHEET_NAMES.PARAMETROS_DELEGACION,
    CACHE_KEYS.DELEGATION_CONTACTS,
    config.longTtlSeconds,
    config.enabled,
    DELEGATION_CONTACT_COLUMNS
  );
  const matches = contacts.filter(function (contact) {
    return normalizeDelegationName_(contact.delegacion) === normalizedDelegation;
  });
  if (!matches.length) {
    throw publicError_('Revisa Parametros_delegacion: no existe un contacto para la delegación "' +
      String(delegation).trim() + '".');
  }
  if (matches.length > 1) {
    throw publicError_('Revisa Parametros_delegacion: la delegación "' +
      String(delegation).trim() + '" está duplicada.');
  }
  return matches[0];
}

function normalizeDelegationName_(value) {
  return String(value || '').trim().toLowerCase();
}

if (typeof module !== 'undefined') {
  module.exports = { getDelegationContact_, normalizeDelegationName_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

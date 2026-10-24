/**
 * Servicio de elementos configurables: cada fila de la pestaña Elementos
 * es una combinación equipo/proveedor/tipo_gestion/subtipo que aparece como
 * una opción final en el menú. Añadir, desactivar o reordenar opciones es
 * cuestión de editar esa pestaña — no hace falta tocar código ni desplegar.
 */

/**
 * Devuelve los elementos con estado ACTIVE, ordenados por la columna "orden".
 * Es lo que el cliente usa para construir dinámicamente el menú de
 * equipo -> proveedor -> tipo de gestión.
 * @returns {Array<Object>}
 */
function getActiveElements_(cacheConfig) {
  const elements = getElements_(cacheConfig);

  return elements
    .filter(function (el) {
      return String(el.estado).toUpperCase() === ESTADO_ELEMENTO.ACTIVE;
    })
    .sort(function (a, b) {
      return (Number(a.orden) || 0) - (Number(b.orden) || 0);
    });
}

/** Filtra por usuario después de leer el catálogo compartido en caché. */
function getActiveElementsForUser_(user, cacheConfig) {
  return getActiveElements_(cacheConfig).filter(function (element) { return canUseElement_(element, user); });
}

function canUseElement_(element, user) {
  if (!element || !isAuthorizedUser_(user) ||
      String(element.estado).trim().toUpperCase() !== ESTADO_ELEMENTO.ACTIVE) return false;
  const allowedRole = normalizeElementRole_(element.rol_visible);
  return allowedRole === ELEMENT_VISIBILITY_ALL || allowedRole === String(user.rol).trim().toUpperCase();
}

function getElementForUser_(idElemento, user, cacheConfig) {
  const element = getElementById_(idElemento, cacheConfig);
  if (!element || String(element.estado).toUpperCase() !== ESTADO_ELEMENTO.ACTIVE) {
    throw publicError_('La opción seleccionada ya no está disponible. Vuelve a la pantalla de inicio e inténtalo de nuevo.');
  }
  if (!canUseElement_(element, user)) {
    throw publicError_('Esta gestión no está disponible para tu rol. Actualiza la página para ver las opciones permitidas.',
      'GESTION_NO_PERMITIDA');
  }
  return element;
}

/** Consulta interna sin autorización; los RPC deben usar getElementForUser_. */
function getElementById_(idElemento, cacheConfig) {
  const elements = getElements_(cacheConfig);
  return elements.find(function (el) {
    return String(el.id_elemento) === String(idElemento);
  });
}

function getElements_(cacheConfig) {
  const config = cacheConfig || getCacheConfig_();
  const elements = readSheetAsObjectsCached_(
    SHEET_NAMES.ELEMENTOS,
    CACHE_KEYS.ELEMENTS,
    config.shortTtlSeconds,
    config.enabled
  );
  return hydrateElementSchemas_(elements, readFormConfiguration_(config));
}

if (typeof module !== 'undefined') {
  module.exports = { getActiveElements_, getActiveElementsForUser_, canUseElement_, getElementForUser_, getElementById_, getElements_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

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

/**
 * Busca un elemento por su id_elemento, sin filtrar por estado: es
 * responsabilidad de quien llama decidir qué hacer si está INACTIVE
 * (por ejemplo, si se desactivó entre que el usuario cargó la página
 * y el momento de enviar el formulario).
 * @param {string} idElemento
 * @returns {Object|undefined}
 */
function getElementById_(idElemento, cacheConfig) {
  const elements = getElements_(cacheConfig);
  return elements.find(function (el) {
    return String(el.id_elemento) === String(idElemento);
  });
}

function getElements_(cacheConfig) {
  const config = cacheConfig || getCacheConfig_();
  return readSheetAsObjectsCached_(
    SHEET_NAMES.ELEMENTOS,
    CACHE_KEYS.ELEMENTS,
    config.shortTtlSeconds,
    config.enabled
  );
}

if (typeof module !== 'undefined') {
  module.exports = { getActiveElements_, getElementById_, getElements_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

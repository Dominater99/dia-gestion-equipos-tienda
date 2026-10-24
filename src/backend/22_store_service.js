/**
 * Servicio de búsqueda y filtrado de tiendas según el usuario.
 */

/**
 * Punto de entrada del cliente. Busca un código exacto sin exponer el maestro
 * completo de tiendas y vuelve a autorizar al usuario en cada consulta.
 * @param {string} storeId Código numérico de uno a cinco caracteres.
 * @param {string} idElemento Elemento activo que determina si admite tiendas cerradas.
 * @returns {Object}
 */
function lookupStore(storeId, idElemento) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) throw publicError_('No se ha podido identificar al usuario.');
    const limitSystemParams = consumeReadAttempt_(email, 'store');
    const code = String(storeId || '').trim();
    if (!STORE_ID_PATTERN.test(code)) {
      throw publicError_(VALIDATION_MESSAGES.STORE_CODE);
    }

    const systemParams = limitSystemParams || getSystemParams_();
    const cacheConfig = getCacheConfig_(systemParams);
    const currentUser = findUserByEmail_(email, cacheConfig);
    if (!isAuthorizedUser_(currentUser)) {
      throw publicError_('El usuario no tiene acceso a la aplicación.');
    }

    const element = getElementById_(idElemento, cacheConfig);
    if (!element || String(element.estado).toUpperCase() !== ESTADO_ELEMENTO.ACTIVE) {
      throw publicError_('La opción seleccionada ya no está disponible.');
    }

    const store = getStoresForUser_(currentUser, cacheConfig).find(function (candidate) {
      return String(candidate.tienda_id).trim() === code;
    });
    if (!store) {
      throw publicError_('No se encuentra una tienda disponible con ese código.');
    }
    if (
      String(element.solo_tiendas_abiertas).toUpperCase() === 'SI' &&
      String(store.estado).toUpperCase() !== ESTADO_TIENDA.ABIERTA
    ) {
      throw publicError_('Esta gestión solo admite tiendas abiertas.');
    }

    return {
      success: true,
      store: store
    };
  } catch (error) {
    return {
      success: false,
      message: publicErrorMessage_(error, 'No se pudo consultar la tienda. Inténtalo de nuevo más tarde.')
    };
  }
}

/**
 * Devuelve las tiendas visibles para un usuario: todas si su rol es
 * GESTOR_GLOBAL o ADMINISTRADOR. GESTOR_DELEGACION solo recibe las de su
 * delegación cuando ambito=DELEGACION; cualquier otro ámbito se cierra sin resultados.
 * @param {Object} user Objeto con rol, ambito y delegacion.
 * @returns {Array<Object>} Proyección de columnas necesarias para tarjeta y validación.
 */
function getStoresForUser_(user, cacheConfig) {
  const seesAllDelegations = user.rol === ROLES.GESTOR_GLOBAL || user.rol === ROLES.ADMINISTRADOR;
  if (!seesAllDelegations && (
    user.rol !== ROLES.GESTOR_DELEGACION ||
    String(user.ambito).trim().toUpperCase() !== 'DELEGACION' ||
    !String(user.delegacion || '').trim()
  )) {
    return [];
  }

  const config = cacheConfig || getCacheConfig_();
  const stores = readSheetAsObjectsCached_(
    SHEET_NAMES.TIENDAS,
    CACHE_KEYS.STORES,
    config.longTtlSeconds,
    config.enabled,
    STORE_COLUMNS
  );

  if (seesAllDelegations) return stores;

  return stores.filter(function (store) {
    return String(store.delegacion_desc).trim().toLowerCase() ===
      String(user.delegacion).trim().toLowerCase();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { lookupStore, getStoresForUser_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

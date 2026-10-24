/**
 * Servicio de acceso: valida al usuario actual contra la pestaña Usuarios
 * y prepara todo lo que necesita la pantalla principal (datos de usuario,
 * parámetros de sistema y elementos activos). Las tiendas se consultan bajo
 * demanda mediante lookupStore para no transferir el maestro al navegador.
 */

/**
 * Punto de entrada llamado por el cliente al arrancar la SPA (overlay de carga).
 * Identifica al usuario con Session.getActiveUser() y comprueba si está dado
 * de alta y activo en Usuarios.
 * @returns {Object} Ver estructura en los comentarios de retorno más abajo.
 */
function checkAccess() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    return { authorized: false, email: '', adminEmail: '' };
  }
  let limitSystemParams;
  try {
    limitSystemParams = consumeReadAttempt_(email, 'access');
  } catch (error) {
    if (error && error.isPublic) {
      return { authorized: false, rateLimited: true, message: error.message };
    }
    throw error;
  }
  const systemParams = limitSystemParams || getSystemParams_();
  const cacheConfig = getCacheConfig_(systemParams);
  const currentUser = findUserByEmail_(email, cacheConfig);

  if (!isAuthorizedUser_(currentUser)) {
    // Sin acceso: el cliente mostrará la pantalla de solicitud de permiso
    // con un mailto: al EMAIL_ADMIN configurado en Sistema.
    return {
      authorized: false,
      email: email,
      adminEmail: systemParams[SYSTEM_PARAM_KEYS.ADMIN_EMAIL] || '',
      accessRequestSubject: MAIL_DEFAULTS.ACCESS_REQUEST_SUBJECT.replace(/[\r\n]+/g, ' '),
      accessRequestBody: MAIL_DEFAULTS.ACCESS_REQUEST_BODY.replace(/{{email}}/g, email)
    };
  }

  return {
    authorized: true,
    user: {
      email: currentUser.email,
      nombre: currentUser.nombre,
      rol: currentUser.rol,
      ambito: currentUser.ambito,
      delegacion: currentUser.delegacion
    },
    uiText: {
      commentsHint: UI_TEXT_DEFAULTS.COMMENTS_HINT,
      coverageAppUrl: textSystemParam_(
        systemParams, SYSTEM_PARAM_KEYS.COVERAGE_APP_URL, UI_TEXT_DEFAULTS.COVERAGE_APP_URL
      ),
      submissionTransportFailure: UI_TEXT_DEFAULTS.SUBMISSION_TRANSPORT_FAILURE
    },
    elements: getActiveElements_(cacheConfig)
  };
}

/**
 * Comprueba estado y rol mediante una lista cerrada mantenida en Constants.
 * @param {Object|undefined} user
 * @returns {boolean}
 */
function isAuthorizedUser_(user) {
  if (!user || String(user.estado).toUpperCase() !== ESTADO_USUARIO_ACTIVO) return false;
  return Object.keys(ROLES).some(function (key) {
    return ROLES[key] === String(user.rol).toUpperCase();
  });
}

/**
 * Busca un usuario en la pestaña Usuarios por email (comparación sin distinguir mayúsculas).
 * @param {string} email
 * @returns {Object|undefined}
 */
function findUserByEmail_(email, cacheConfig) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return undefined;
  const config = cacheConfig || getCacheConfig_();
  const users = readSheetAsObjectsCached_(
    SHEET_NAMES.USUARIOS,
    CACHE_KEYS.USERS,
    config.shortTtlSeconds,
    config.enabled
  );
  return users.find(function (u) {
    return String(u.email || '').trim().toLowerCase() === normalizedEmail;
  });
}

if (typeof module !== 'undefined') {
  module.exports = { checkAccess, findUserByEmail_, isAuthorizedUser_ };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

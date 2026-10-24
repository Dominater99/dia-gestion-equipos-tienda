/**
 * Limita los intentos de alta de cada cuenta identificada. El estado vive en
 * Script Properties para no depender de una caché que puede expulsar claves
 * antes del TTL. La clave contiene solo un digest del email normalizado.
 */
function consumeSubmissionAttempt_(email) {
  return consumeRateAttempt_(email, {
    keyPrefix: SUBMISSION_RATE_LIMIT.PROPERTY_PREFIX,
    cleanup: cleanupExpiredSubmissionRateStates_,
    parse: parseSubmissionRateState_,
    serialize: serializeSubmissionRateState_,
    maxParam: SYSTEM_PARAM_KEYS.SUBMISSION_ATTEMPTS_LIMIT,
    defaultMax: SUBMISSION_RATE_LIMIT.MAX_ATTEMPTS,
    windowParam: SYSTEM_PARAM_KEYS.SUBMISSION_WINDOW_SECONDS,
    defaultWindowMs: SUBMISSION_RATE_LIMIT.WINDOW_MS,
    recoverCorrupt: true,
    tracksLoggedLimit: true,
    clockError: 'El reloj retrocedió durante la ventana de envíos.',
    limitError: function (state, now) {
      const remainingMinutes = Math.ceil((state.windowMs - (now - state.windowStart)) / 60000);
      return publicError_('Has alcanzado el límite de intentos de registro. Vuelve a intentarlo en ' +
        remainingMinutes + (remainingMinutes === 1 ? ' minuto.' : ' minutos.'));
    }
  });
}

function consumeRateAttempt_(email, options) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('No se puede aplicar el límite sin identidad de usuario.');
  const userKey = options.keyPrefix + rateIdentityDigest_(normalizedEmail);
  const now = Date.now();
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    const properties = PropertiesService.getScriptProperties();
    options.cleanup(properties, now);
    const rawState = properties.getProperty(userKey);
    let previous;
    try {
      previous = options.parse(rawState);
    } catch (error) {
      if (options.recoverCorrupt) markCorruptRateState_(error, userKey, rawState);
      throw error;
    }
    const elapsed = previous ? now - previous.windowStart : 0;
    if (elapsed < 0) throw new Error(options.clockError);
    let systemParams = null;
    let state;
    if (previous && elapsed < previous.windowMs) {
      state = previous;
    } else {
      systemParams = getSystemParams_();
      state = {
        windowStart: now,
        attempts: 0,
        maxAttempts: positiveIntegerSystemParam_(
          systemParams, options.maxParam, options.defaultMax
        ),
        windowMs: rateWindowMs_(
          systemParams, options.windowParam, options.defaultWindowMs
        )
      };
      if (options.tracksLoggedLimit) state.limitLogged = false;
    }

    if (state.attempts >= state.maxAttempts) {
      const error = options.limitError(state, now);
      if (options.tracksLoggedLimit) {
        error.isRateLimit = true;
        error.logRateLimit = !state.limitLogged;
        if (!state.limitLogged) {
          state.limitLogged = true;
          properties.setProperty(userKey, options.serialize(state));
        }
      }
      throw error;
    }

    state.attempts++;
    properties.setProperty(userKey, options.serialize(state));
    return systemParams;
  } finally {
    lock.releaseLock();
  }
}

function rateIdentityDigest_(normalizedEmail) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalizedEmail)
    .map(function (byte) { return (byte & 255).toString(16).padStart(2, '0'); }).join('');
}

function markCorruptRateState_(error, key, raw) {
  error.isCorruptRateState = true;
  error.rateStateKey = key;
  error.rateStateRaw = raw;
}

/** Recupera solo el valor corrupto observado, después de registrar el incidente. */
function clearCorruptRateState_(error) {
  if (!error || !error.isCorruptRateState) return false;
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    const properties = PropertiesService.getScriptProperties();
    if (properties.getProperty(error.rateStateKey) !== error.rateStateRaw) return false;
    properties.deleteProperty(error.rateStateKey);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/** Acota las consultas públicas de acceso y tienda antes de leer Sheets. */
function consumeReadAttempt_(email, kind) {
  if (kind !== 'access' && kind !== 'store') {
    throw new Error('Tipo de consulta no reconocido por el limitador.');
  }
  return consumeRateAttempt_(email, {
    keyPrefix: READ_RATE_LIMIT.PROPERTY_PREFIX + kind + ':',
    cleanup: cleanupExpiredReadRateStates_,
    parse: function (raw) { return parseReadRateState_(raw, kind); },
    serialize: serializeReadRateState_,
    maxParam: kind === 'access'
      ? SYSTEM_PARAM_KEYS.ACCESS_LOOKUPS_LIMIT : SYSTEM_PARAM_KEYS.STORE_LOOKUPS_LIMIT,
    defaultMax: kind === 'access'
      ? READ_RATE_LIMIT.ACCESS_MAX_ATTEMPTS : READ_RATE_LIMIT.STORE_MAX_ATTEMPTS,
    windowParam: SYSTEM_PARAM_KEYS.READ_WINDOW_SECONDS,
    defaultWindowMs: READ_RATE_LIMIT.WINDOW_MS,
    recoverCorrupt: false,
    tracksLoggedLimit: false,
    clockError: 'El reloj retrocedió durante la ventana de consultas.',
    limitError: function () {
      return publicError_('Demasiadas consultas en poco tiempo. Vuelve a intentarlo más tarde.');
    }
  });
}

function cleanupExpiredReadRateStates_(properties, now) {
  cleanupExpiredRateStates_(properties, now, {
    cleanupProperty: READ_RATE_LIMIT.CLEANUP_PROPERTY,
    cleanupIntervalMs: READ_RATE_LIMIT.CLEANUP_INTERVAL_MS,
    maxDelete: READ_RATE_LIMIT.CLEANUP_MAX_DELETE,
    keyPrefix: READ_RATE_LIMIT.PROPERTY_PREFIX,
    invalidCleanupMessage: 'Estado de limpieza del límite de lecturas no válido.',
    markCorruptCleanup: false,
    parse: function (raw, key) {
      const kind = key.slice(READ_RATE_LIMIT.PROPERTY_PREFIX.length).split(':')[0];
      return parseReadRateState_(raw, kind);
    }
  });
}

function parseReadRateState_(raw, kind) {
  if (raw === null) return null;
  const match = /^(\d+):(\d+)(?::(\d+):(\d+))?$/.exec(String(raw));
  if (!match || (kind !== 'access' && kind !== 'store')) {
    throw new Error('Estado de límite de lecturas no válido.');
  }
  const maxAttempts = match[3] === undefined
    ? (kind === 'access' ? READ_RATE_LIMIT.ACCESS_MAX_ATTEMPTS : READ_RATE_LIMIT.STORE_MAX_ATTEMPTS)
    : Number(match[3]);
  const windowMs = match[4] === undefined ? READ_RATE_LIMIT.WINDOW_MS : Number(match[4]);
  const state = {
    windowStart: Number(match[1]),
    attempts: Number(match[2]),
    maxAttempts: maxAttempts,
    windowMs: windowMs
  };
  if (!Object.keys(state).every(function (key) { return Number.isSafeInteger(state[key]); }) ||
      state.attempts < 1 || state.maxAttempts < 1 || state.attempts > state.maxAttempts ||
      state.windowMs < 1000) {
    throw new Error('Estado de límite de lecturas no válido.');
  }
  return state;
}

function serializeReadRateState_(state) {
  return [state.windowStart, state.attempts, state.maxAttempts, state.windowMs].join(':');
}

/** Limpia una tanda acotada de propiedades propias, como máximo una vez al día. */
function cleanupExpiredSubmissionRateStates_(properties, now) {
  cleanupExpiredRateStates_(properties, now, {
    cleanupProperty: SUBMISSION_RATE_LIMIT.CLEANUP_PROPERTY,
    cleanupIntervalMs: SUBMISSION_RATE_LIMIT.CLEANUP_INTERVAL_MS,
    maxDelete: SUBMISSION_RATE_LIMIT.CLEANUP_MAX_DELETE,
    keyPrefix: SUBMISSION_RATE_LIMIT.PROPERTY_PREFIX,
    invalidCleanupMessage: 'El estado de limpieza del límite de envíos no es válido.',
    markCorruptCleanup: true,
    parse: function (raw) { return parseSubmissionRateState_(raw); }
  });
}

function cleanupExpiredRateStates_(properties, now, options) {
  const raw = properties.getProperty(options.cleanupProperty);
  const last = raw === null ? null : Number(raw);
  if (last !== null && (!Number.isSafeInteger(last) || last > now)) {
    const error = new Error(options.invalidCleanupMessage);
    if (options.markCorruptCleanup) markCorruptRateState_(error, options.cleanupProperty, raw);
    throw error;
  }
  if (last !== null && now - last < options.cleanupIntervalMs) return;

  const allProperties = properties.getProperties();
  let deleted = 0;
  let expiredPending = false;
  Object.keys(allProperties).forEach(function (key) {
    if (!key.startsWith(options.keyPrefix)) return;
    let state;
    try {
      state = options.parse(allProperties[key], key);
    } catch {
      return;
    }
    if (state && now - state.windowStart >= state.windowMs) {
      if (deleted < options.maxDelete) {
        properties.deleteProperty(key);
        deleted++;
      } else {
        expiredPending = true;
      }
    }
  });
  if (expiredPending) {
    properties.deleteProperty(options.cleanupProperty);
  } else {
    properties.setProperty(options.cleanupProperty, String(now));
  }
}

function parseSubmissionRateState_(raw) {
  if (raw === null) return null;
  const match = /^(\d+):(\d+):([01])(?::(\d+):(\d+))?$/.exec(String(raw));
  if (!match) throw new Error('El estado del límite de envíos no es válido.');
  const windowStart = Number(match[1]);
  const attempts = Number(match[2]);
  const maxAttempts = match[4] === undefined ? SUBMISSION_RATE_LIMIT.MAX_ATTEMPTS : Number(match[4]);
  const windowMs = match[5] === undefined ? SUBMISSION_RATE_LIMIT.WINDOW_MS : Number(match[5]);
  if (!Number.isSafeInteger(windowStart) || !Number.isSafeInteger(attempts) ||
      !Number.isSafeInteger(maxAttempts) || !Number.isSafeInteger(windowMs) ||
      attempts < 1 || maxAttempts < 1 || attempts > maxAttempts || windowMs < 1000) {
    throw new Error('El estado del límite de envíos no es válido.');
  }
  return {
    windowStart: windowStart, attempts: attempts, limitLogged: match[3] === '1',
    maxAttempts: maxAttempts, windowMs: windowMs
  };
}

function serializeSubmissionRateState_(state) {
  return [
    state.windowStart, state.attempts, state.limitLogged ? '1' : '0',
    state.maxAttempts, state.windowMs
  ].join(':');
}

if (typeof module !== 'undefined') {
  module.exports = {
    consumeSubmissionAttempt_, cleanupExpiredSubmissionRateStates_, clearCorruptRateState_,
    parseSubmissionRateState_, serializeSubmissionRateState_,
    consumeReadAttempt_, cleanupExpiredReadRateStates_,
    parseReadRateState_, serializeReadRateState_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

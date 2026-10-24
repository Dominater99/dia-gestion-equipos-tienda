/**
 * Caso de uso de registro: valida el formulario, genera el ID de
 * petición y grabación en la pestaña Registros (sheet único para todos los
 * equipos, con columna "equipo" para distinguirlos).
 *
 * El cliente solo envía id_elemento + los valores del formulario: qué campos
 * hacen falta, si se filtran tiendas abiertas y si se exige código de
 * ServiceNow se resuelve aquí consultando la fila de Elementos, no a partir
 * de lo que diga el cliente.
 */

/**
 * Punto de entrada llamado por el cliente al pulsar "Registrar".
 * Vuelve a comprobar el acceso del usuario en el servidor (no basta con que
 * el cliente lo haya comprobado al cargar), resuelve el elemento elegido,
 * valida el payload contra sus reglas, genera el ID, graba la fila y envía
 * el correo de confirmación.
 * @param {Object} payload {idElemento, ...campos de formulario, comentarios}
 * @returns {Object} {success: boolean, idPeticion: string|null, message: string}
 */
function submitRequest(payload) {
  let stage = 'IDENTIDAD';
  let idPeticion = null;
  let email = '';
  let element = null;
  try {
    email = Session.getActiveUser().getEmail();
    if (!email) throw publicError_('No se ha podido identificar al usuario.');
    stage = 'LIMITE_ENVIOS';
    const limitSystemParams = consumeSubmissionAttempt_(email);

    stage = 'CONFIGURACION';
    const systemParams = limitSystemParams || getSystemParams_();
    const cacheConfig = getCacheConfig_(systemParams);
    stage = 'ACCESO';
    const currentUser = findUserByEmail_(email, cacheConfig);

    if (!isAuthorizedUser_(currentUser)) {
      throw publicError_('El usuario no tiene acceso a la aplicación.');
    }

    if (!payload || !payload.idElemento) {
      throw publicError_('Falta indicar qué se quiere gestionar.');
    }

    stage = 'ELEMENTO';
    element = getElementForUser_(payload.idElemento, currentUser, cacheConfig);

    stage = 'VALIDACION';
    if (element._configuredSchema && payload.formRevision !== element.formRevision) {
      const changed = publicError_('Los requisitos de esta petición han cambiado. Revisa el formulario actualizado; se han conservado los datos aplicables.', 'FORMULARIO_ACTUALIZADO');
      changed.updatedElement = publicElement_(element);
      throw changed;
    }
    payload = sanitizeRequestPayload_(element, payload);
    validateRequestPayload_(element, payload);
    getElementEmailMessage_(element);
    const normalizedPayload = normalizeRequestStores_(element, payload, getStoresForUser_(currentUser, cacheConfig));
    getElementEmailMessage_(element, normalizedPayload, currentUser);

    stage = 'REGISTROS';
    idPeticion = registerRequest_(element, normalizedPayload, currentUser, systemParams);

    stage = 'NOTIFICACION';
    let notificationSent = true;
    let notificationIssue = '';
    try {
      sendConfirmationEmail_(currentUser, idPeticion, element, normalizedPayload, systemParams);
    } catch (notificationError) {
      notificationSent = false;
      notificationIssue = publicErrorMessage_(notificationError, '');
      logRequestFailure_('NOTIFICACION', notificationError);
    }

    logAppEventSafely_(
      notificationSent ? LOG_EVENTS.REQUEST_REGISTERED : LOG_EVENTS.MAIL_FAILED,
      idPeticion,
      buildRequestLogContext_(stage, element, notificationSent, notificationSent ? '' : 'ENVIO_CORREO_FALLIDO'),
      email
    );

    return {
      success: true,
      idPeticion: idPeticion,
      notificationSent: notificationSent,
      message: notificationSent
        ? 'Petición registrada correctamente.'
        : 'Petición registrada con el identificador ' + idPeticion +
          ', pero no se pudo enviar el correo de confirmación.' +
          (notificationIssue ? ' ' + notificationIssue : '')
    };
  } catch (error) {
    logRequestFailure_(stage, error);
    // Los reintentos bloqueados no deben amplificar escrituras en Logs.
    if (error && error.isCorruptRateState) {
      if (logAppEventSafely_(
        LOG_EVENTS.RATE_LIMIT_STATE_INVALID, null, buildRequestLogContext_(stage, element), email
      )) {
        try {
          clearCorruptRateState_(error);
        } catch (cleanupError) {
          logRequestFailure_('RECUPERACION_LIMITE', cleanupError);
        }
      }
    } else if (error && error.isRateLimit) {
      if (error.logRateLimit) {
        logAppEventSafely_(
          LOG_EVENTS.RATE_LIMIT_EXCEEDED, null, buildRequestLogContext_(stage, element), email
        );
      }
    } else if (stage !== 'IDENTIDAD' && stage !== 'LIMITE_ENVIOS') {
      // Un fallo de la barrera no debe añadir una escritura de Sheets por reintento.
      logAppEventSafely_(
        LOG_EVENTS.REQUEST_REJECTED, idPeticion, buildRequestLogContext_(stage, element, undefined, error.reason || 'ERROR_INTERNO'), email
      );
    }
    return {
      success: false,
      idPeticion: null,
      notificationSent: false,
      message: publicErrorMessage_(error, 'No se pudo completar la solicitud. Contacta con soporte si persiste.'),
      updatedElement: error.updatedElement || null
    };
  }
}

function buildRequestLogContext_(stage, element, notificationSent, reason) {
  const context = { etapa: String(stage || '') };
  if (element) {
    [
      ['idElemento', 'id_elemento'],
      ['equipo', 'equipo'],
      ['proveedor', 'proveedor'],
      ['tipoGestion', 'tipo_gestion'],
      ['subtipo', 'subtipo']
    ].forEach(function (mapping) {
      const value = String(element[mapping[1]] || '').trim();
      if (value) context[mapping[0]] = value;
    });
  }
  if (typeof notificationSent === 'boolean') {
    context.notificacionEnviada = notificationSent;
  }
  if (reason && /^[A-Z_]{1,60}$/.test(reason)) context.motivo = reason;
  return context;
}

/** Registra excepciones internas en Apps Script sin exponer datos del formulario. */
function logRequestFailure_(stage, error) {
  if (error && error.isPublic === true) return;
  const name = error && /^[A-Za-z][A-Za-z0-9]*$/.test(String(error.name || ''))
    ? String(error.name) : 'Error';
  const message = sanitizeRequestDiagnostic_(error && error.message ? error.message : 'Sin detalle');
  const diagnostic = new Error('submitRequest [' + stage + ']: ' + message);
  diagnostic.name = name;
  if (error && typeof error.stack === 'string') {
    const frames = error.stack.split('\n').slice(1)
      .filter(function (line) { return /^\s*at\s/.test(line); })
      .slice(0, 8)
      .map(sanitizeRequestDiagnostic_);
    if (frames.length) diagnostic.stack = name + ': ' + diagnostic.message + '\n' + frames.join('\n');
  }
  console.error(diagnostic);
}

function sanitizeRequestDiagnostic_(value) {
  return String(value)
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[dato]')
    .slice(0, 300);
}

/**
 * Verifica que cada tienda recibida pertenece al ámbito visible del usuario y
 * devuelve una copia del payload con el texto canónico "código - dirección".
 * @param {Object} element
 * @param {Object} payload
 * @param {Array<Object>} visibleStores
 * @returns {Object}
 */
function normalizeRequestStores_(element, payload, visibleStores) {
  const result = sanitizeRequestPayload_(element, payload);
  result.comentarios = normalizeCommentText_(result.comentarios);
  result.codigoServiceNow = String(result.codigoServiceNow || '').trim();
  getElementFields_(element).filter(function (field) { return field.type === 'yes-no'; }).forEach(function (field) {
    if (result[field.name]) result[field.name] = result[field.name].toUpperCase();
  });
  normalizeRequestPhoto_(element, result);
  result._storeDetails = {};
  const storeFields = element.tipo_gestion === TIPOS_GESTION.MOVIMIENTO
    ? ['tiendaOrigen', 'tiendaDestino']
    : ['tienda'];

  ['tienda', 'tiendaOrigen', 'tiendaDestino'].forEach(function (fieldName) {
    if (storeFields.indexOf(fieldName) === -1) delete result[fieldName];
  });

  storeFields.forEach(function (fieldName) {
    if (!result[fieldName]) return;
    const selectedCode = String(result[fieldName]).trim();
    if (!STORE_ID_PATTERN.test(selectedCode)) {
      throw publicError_(VALIDATION_MESSAGES.STORE_CODE);
    }
    const store = visibleStores.find(function (candidate) {
      return String(candidate.tienda_id).trim() === selectedCode;
    });

    if (!store) {
      throw publicError_('La tienda seleccionada no está disponible para este usuario.');
    }
    if (
      String(element.solo_tiendas_abiertas).toUpperCase() === 'SI' &&
      String(store.estado).toUpperCase() !== ESTADO_TIENDA.ABIERTA
    ) {
      throw publicError_('La opción seleccionada solo admite tiendas abiertas.');
    }

    const address = [store.direccion, store.municipio].filter(Boolean).join(', ');
    result[fieldName] = String(store.tienda_id) + (address ? ' - ' + address : '');
    result._storeDetails[fieldName] = {
      tienda_id: String(store.tienda_id),
      delegacion_desc: String(store.delegacion_desc || ''),
      provincia: String(store.provincia || ''),
      municipio: String(store.municipio || ''),
      direccion: String(store.direccion || '')
    };
  });

  return result;
}

/**
 * Valida los campos mínimos del payload según el tipo de gestión y el
 * equipo del elemento elegido, y exige el código de ServiceNow con el
 * formato correcto cuando ese elemento lo requiere.
 * Lanza un Error con un mensaje legible si algo falta o es inválido.
 * @param {Object} element Fila de Elementos ya resuelta (ver getElementById_).
 * @param {Object} payload
 */
function validateRequestPayload_(element, payload) {
  if (!Object.values(TIPOS_GESTION).includes(element.tipo_gestion)) {
    throw configurationError_('El tipo de gestión no está admitido.');
  }
  payload = sanitizeRequestPayload_(element, payload);
  getElementFields_(element).forEach(function (field) {
    const value = payload[field.name];
    if (field.type === 'photo') {
      if (value || field.required) validateSinglePhotoPayloadMetadata_(value);
      return;
    }
    if (field.name === 'codigoServiceNow') {
      if ((value || field.required) && !SERVICENOW_PATTERN.test(value || '')) {
        throw publicError_(VALIDATION_MESSAGES.SERVICE_NOW, 'SERVICENOW_INVALIDO');
      }
      return;
    }
    if (field.type === 'yes-no' && (value || field.required) && !/^(SI|NO)$/.test(String(value || '').toUpperCase())) {
      throw publicError_('Indica SI o NO en ' + field.label + '.', 'DISPONIBILIDAD_REQUERIDA');
    }
    if (field.required && !String(value || '').trim()) {
      throw publicError_('El campo ' + field.label + ' es obligatorio.',
        field.name === 'comentarios' ? 'COMENTARIO_REQUERIDO' : 'CAMPO_REQUERIDO');
    }
  });
  if (element.tipo_gestion === TIPOS_GESTION.MOVIMIENTO && payload.tiendaOrigen === payload.tiendaDestino) {
    throw publicError_('La tienda de origen y la tienda de destino deben ser distintas.', 'TIENDAS_IGUALES');
  }
  validateFutureDates_(payload);
  if (payload.fechaInicio && payload.fechaFin && payload.fechaFin < payload.fechaInicio) {
    throw publicError_('La fecha de fin no puede ser anterior a la fecha de inicio.', 'INTERVALO_INVALIDO');
  }

  const rawComments = String(payload.comentarios || '');
  if (rawComments.length > MAX_COMMENT_LENGTH) {
    throw publicError_(VALIDATION_MESSAGES.COMMENT_LIMIT);
  }
  const comments = normalizeCommentText_(rawComments);
  if (!comments && getElementFields_(element).some(function (field) { return field.name === 'comentarios' && field.required; })) {
    throw publicError_('El campo Comentarios es obligatorio.', 'COMENTARIO_REQUERIDO');
  }
  if (comments.length > MAX_COMMENT_LENGTH) {
    throw publicError_(VALIDATION_MESSAGES.COMMENT_LIMIT);
  }
}

function isCafeteraNewRequest_(element) {
  return element && element.equipo === EQUIPOS.CAFETERA &&
    element.tipo_gestion === TIPOS_GESTION.NUEVA_SOLICITUD;
}

function isLockerNewRequest_(element) {
  return element && element.equipo === EQUIPOS.LOCKER &&
    element.tipo_gestion === TIPOS_GESTION.NUEVA_SOLICITUD;
}

function photoFieldNames_(element) {
  return element ? getElementFields_(element).filter(function (field) { return field.type === 'photo'; })
    .map(function (field) { return field.name; }) : [];
}

function requiresPhoto_(element) {
  return photoFieldNames_(element).length > 0;
}

function validatePhotoPayloadMetadata_(element, payload) {
  getElementFields_(element).filter(function (field) { return field.type === 'photo'; }).forEach(function (field) {
    if (payload[field.name] || field.required) validateSinglePhotoPayloadMetadata_(payload[field.name]);
  });
}

function validateSinglePhotoPayloadMetadata_(photo) {
  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) {
    throw publicError_(VALIDATION_MESSAGES.PHOTO_REQUIRED);
  }
  const mimeType = String(photo.mimeType || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(PHOTO_UPLOAD.SIGNATURES, mimeType)) {
    throw publicError_(VALIDATION_MESSAGES.PHOTO_TYPE);
  }
  const base64 = String(photo.base64 || '');
  if (!base64) throw publicError_(VALIDATION_MESSAGES.PHOTO_REQUIRED);
  if (base64.length > PHOTO_UPLOAD.MAX_BASE64_LENGTH) {
    throw publicError_(VALIDATION_MESSAGES.PHOTO_SIZE);
  }
  if (!isValidBase64_(base64)) {
    throw publicError_(VALIDATION_MESSAGES.PHOTO_CONTENT);
  }
}

/** Valida Base64 de forma iterativa para admitir fotos grandes sin agotar la pila. */
function isValidBase64_(value) {
  const length = value.length;
  if (!length || length % 4 !== 0) return false;

  let contentEnd = length;
  if (value.charCodeAt(contentEnd - 1) === 61) contentEnd--;
  if (value.charCodeAt(contentEnd - 1) === 61) contentEnd--;
  if (length - contentEnd > 2) return false;

  for (let index = 0; index < contentEnd; index++) {
    const code = value.charCodeAt(index);
    const isLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
    const isDigit = code >= 48 && code <= 57;
    if (!isLetter && !isDigit && code !== 43 && code !== 47) return false;
  }
  for (let index = contentEnd; index < length; index++) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return true;
}

function normalizeRequestPhoto_(element, payload) {
  delete payload._photoAttachments;
  delete payload._photoAttachment;
  const photoFields = photoFieldNames_(element);
  const sourcePhotos = {};
  ['foto', 'fotoHorario', 'fotoCobertura', 'fotoUbicacion', 'fotoLayout'].forEach(function (fieldName) {
    sourcePhotos[fieldName] = payload[fieldName];
    delete payload[fieldName];
  });
  if (!photoFields.length) return;

  const attachments = photoFields.filter(function (fieldName) { return !!sourcePhotos[fieldName]; }).map(function (fieldName) {
    const photo = sourcePhotos[fieldName];
    const mimeType = String(photo.mimeType || '').trim().toLowerCase();
    let bytes;
    try {
      bytes = Utilities.base64Decode(String(photo.base64 || ''));
    } catch {
      throw publicError_(VALIDATION_MESSAGES.PHOTO_CONTENT);
    }
    if (!bytes || !bytes.length) throw publicError_(VALIDATION_MESSAGES.PHOTO_REQUIRED);
    if (bytes.length > PHOTO_UPLOAD.MAX_BYTES) throw publicError_(VALIDATION_MESSAGES.PHOTO_SIZE);
    if (!hasPhotoSignature_(bytes, PHOTO_UPLOAD.SIGNATURES[mimeType])) {
      throw publicError_(VALIDATION_MESSAGES.PHOTO_CONTENT);
    }
    return { fieldName: fieldName, bytes: bytes, mimeType: mimeType };
  });
  validatePhotoAttachmentsTotalSize_(attachments);
  payload._photoAttachments = attachments;
  if (attachments.length === 1 && attachments[0].fieldName === 'foto') {
    payload._photoAttachment = attachments[0];
  }
}

/** Evita superar el límite de tamaño total de adjuntos de MailApp. */
function validatePhotoAttachmentsTotalSize_(attachments, maximumBytes) {
  const limit = maximumBytes === undefined ? PHOTO_UPLOAD.MAX_TOTAL_BYTES : maximumBytes;
  const totalBytes = attachments.reduce(function (total, attachment) {
    return total + Number(attachment.bytes.length || 0);
  }, 0);
  if (totalBytes > limit) throw publicError_(VALIDATION_MESSAGES.PHOTO_TOTAL_SIZE);
}

function hasPhotoSignature_(bytes, signature) {
  if (!signature || bytes.length < signature.length) return false;
  return signature.every(function (value, index) {
    return (Number(bytes[index]) & 255) === value;
  });
}
/**
 * Exige fechas de calendario ISO posteriores al día actual del script.
 * Las fechas opcionales solo se comprueban si llegan con valor.
 * @param {Object} payload
 */
function validateFutureDates_(payload) {
  const dateFields = [
    ['fechaLimiteRecogida', 'fecha límite para la recogida'],
    ['fechaInicio', 'fecha de inicio'],
    ['fechaFin', 'fecha de fin'],
    ['fechaMaximaRetirada', 'fecha máxima de retirada']
  ];
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  dateFields.forEach(function (field) {
    const rawValue = payload[field[0]];
    if (rawValue === undefined || rawValue === null || rawValue === '') return;
    const value = String(rawValue).trim();
    if (!isValidIsoDate_(value)) {
      throw publicError_('La ' + field[1] + ' no es válida. Usa el formato AAAA-MM-DD.', 'FECHA_INVALIDA');
    }
    if (value <= today) {
      throw publicError_('La ' + field[1] + ' debe ser posterior a hoy.', 'FECHA_NO_FUTURA');
    }
  });
}

function isValidIsoDate_(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Limpia espacios repetidos y líneas vacías sin unir líneas con contenido.
 * Se aplica en servidor antes de persistir y enviar el texto al proveedor.
 * @param {*} value
 * @returns {string}
 */
function normalizeCommentText_(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // eslint-disable-next-line no-control-regex -- limpia controles no imprimibles de comentarios.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .split('\n')
    .map(function (line) {
      return line.replace(/[^\S\n]+/g, ' ').trim();
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * La hoja Registros es la fuente de verdad del cupo diario.
 * Toda la decisión y la escritura quedan bajo un único bloqueo de script.
 */
function registerRequest_(element, payload, currentUser, systemParams) {
  const dailyLimit = positiveIntegerSystemParam_(
    systemParams, SYSTEM_PARAM_KEYS.DAILY_USER_REQUEST_LIMIT, DAILY_REQUEST_LIMIT_DEFAULT
  );

  const email = String(currentUser.email || '').trim().toLowerCase();
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    const sheet = getSheet_(SHEET_NAMES.REGISTROS);
    const lastColumn = sheet.getLastColumn();
    const headers = lastColumn
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(normalizeHeader_)
      : [];
    const indexes = {
      id: headers.indexOf('id_peticion'),
      timestamp: headers.indexOf('timestamp_registro'),
      email: headers.indexOf('email_usuario')
    };
    if (REGISTRO_COLUMNS.some(function (name) { return !headers.includes(name); })) {
      throw new Error('Faltan columnas obligatorias en Registros. Revisa la cabecera de la hoja.');
    }

    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const firstColumn = Math.min(indexes.id, indexes.timestamp, indexes.email);
    const columnCount = Math.max(indexes.id, indexes.timestamp, indexes.email) - firstColumn + 1;
    let registeredToday = 0;
    let reachedPreviousDay = false;
    for (let endRow = sheet.getLastRow(); endRow >= 2 && !reachedPreviousDay;) {
      const startRow = Math.max(2, endRow - REGISTROS_SCAN_BATCH_ROWS + 1);
      const rows = sheet.getRange(startRow, firstColumn + 1, endRow - startRow + 1, columnCount).getValues();
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (!row[indexes.id - firstColumn]) continue;
        const rawTimestamp = row[indexes.timestamp - firstColumn];
        const timestamp = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp);
        if (Number.isNaN(timestamp.getTime())) {
          throw new Error('Hay un registro con fecha no válida; no se puede verificar el cupo.');
        }
        const day = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (day < today) {
          reachedPreviousDay = true;
          break;
        }
        if (day === today && String(row[indexes.email - firstColumn] || '').trim().toLowerCase() === email) {
          registeredToday++;
          if (registeredToday >= dailyLimit) break;
        }
      }
      if (registeredToday >= dailyLimit) break;
      endRow = startRow - 1;
    }
    if (registeredToday >= dailyLimit) {
      throw publicError_('Has alcanzado el límite de ' + dailyLimit +
        ' solicitudes registradas hoy. Podrás registrar más mañana.');
    }

    const idPeticion = generateRequestIdWithinLock_();
    const rowObject = buildRegistroRow_(element, payload, currentUser, idPeticion);
    appendRowFromObject_(sheet, rowObject, headers);
    SpreadsheetApp.flush();
    payload._registeredRecord = rowObject;
    return idPeticion;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera un ID de petición único con formato SOL-AAAAMMDD-NNNN, usando un
 * contador guardado en Script Properties y protegido con LockService para evitar
 * colisiones entre envíos simultáneos.
 * @returns {string}
 */
function generateRequestId_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(SCRIPT_LOCK_WAIT_MS);
  try {
    return generateRequestIdWithinLock_();
  } finally {
    lock.releaseLock();
  }
}

function generateRequestIdWithinLock_() {
  const properties = PropertiesService.getScriptProperties();
  const storedCounter = parseRequestCounter_(
    properties.getProperty(SCRIPT_PROPERTY_KEYS.REQUEST_COUNTER), 'Script Properties'
  );
  const newCounter = Math.max(REQUEST_COUNTER_INITIAL_VALUE, storedCounter) + 1;
  if (!Number.isSafeInteger(newCounter)) {
    throw new Error('El contador de peticiones ha alcanzado su límite seguro.');
  }
  properties.setProperty(SCRIPT_PROPERTY_KEYS.REQUEST_COUNTER, String(newCounter));
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  return REQUEST_ID_PREFIX + '-' + today + '-' + String(newCounter).padStart(REQUEST_ID_MIN_DIGITS, '0');
}

function parseRequestCounter_(value, source) {
  if (value === null || value === undefined || value === '') return 0;
  const text = String(value).trim();
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number)) {
    throw new Error('El contador de peticiones de ' + source + ' no es válido.');
  }
  return number;
}

/**
 * Construye el objeto de fila a insertar en Registros a partir del elemento
 * elegido, el payload del formulario, el usuario que registra y el ID ya
 * generado. equipo, proveedor, tipo_gestion y subtipo salen del elemento
 * (fuente de verdad), no del payload.
 * @param {Object} element
 * @param {Object} payload
 * @param {Object} currentUser
 * @param {string} idPeticion
 * @returns {Object}
 */
function buildRegistroRow_(element, payload, currentUser, idPeticion) {
  const record = {
    id_peticion: idPeticion,
    timestamp_registro: new Date(),
    email_usuario: currentUser.email,
    nombre_usuario: currentUser.nombre,
    delegacion_usuario: currentUser.delegacion,
    id_elemento: element.id_elemento,
    etiqueta_elemento: element.etiqueta,
    equipo: element.equipo,
    proveedor: element.proveedor || '',
    tipo_gestion: element.tipo_gestion,
    subtipo: element.subtipo || '',
    fecha_limite_recogida: payload.fechaLimiteRecogida || '',
    necesita_codigo_servicenow: getElementFields_(element).some(function (field) {
      return field.name === 'codigoServiceNow' && field.required;
    }) ? 'SI' : 'NO'
  };
  Object.keys(FORM_FIELD_CATALOG).forEach(function (key) {
    const field = FORM_FIELD_CATALOG[key];
    if (field.type !== 'photo') record[key] = payload[field.name] || '';
  });
  return record;
}

if (typeof module !== 'undefined') {
  module.exports = {
    submitRequest,
    buildRequestLogContext_,
    logRequestFailure_,
    sanitizeRequestDiagnostic_,
    validateRequestPayload_,
    validateFutureDates_,
    isValidIsoDate_,
    normalizeCommentText_,
    normalizeRequestStores_,
    isCafeteraNewRequest_,
    isLockerNewRequest_,
    photoFieldNames_,
    requiresPhoto_,
    validatePhotoPayloadMetadata_,
    validateSinglePhotoPayloadMetadata_,
    isValidBase64_,
    normalizeRequestPhoto_,
    validatePhotoAttachmentsTotalSize_,
    hasPhotoSignature_,
    registerRequest_,
    generateRequestId_,
    generateRequestIdWithinLock_,
    parseRequestCounter_,
    buildRegistroRow_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

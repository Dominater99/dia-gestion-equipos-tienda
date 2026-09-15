/**
 * Servicio de construcción y envío del correo de confirmación.
 * Destinatario principal: quien registra. CC: direcciones de soporte
 * (Sistema.EMAIL_CC_SOPORTE) más, si el elemento elegido tiene uno propio,
 * el email_destino configurado en esa fila de Elementos.
 */
const MAIL_HTML_THEME = Object.freeze({
  background: '#f8fafc',
  surface: '#ffffff',
  border: '#e2e8f0',
  primary: '#dc2626',
  heading: '#1e293b',
  text: '#0f172a',
  muted: '#64748b',
  successBackground: '#ecfdf5',
  successText: '#047857',
  fontFamily: 'system-ui,-apple-system,"Segoe UI",Arial,Helvetica,sans-serif'
});

const MAIL_HTML_TEXT = Object.freeze({
  STATUS: 'SOLICITUD REGISTRADA',
  DETAILS: 'DATOS DE LA SOLICITUD',
  REQUEST_ID: 'ID solicitud'
});

/**
 * Envía el correo de confirmación al usuario que ha registrado la petición.
 * @param {Object} currentUser
 * @param {string} idPeticion
 * @param {Object} element Fila de Elementos usada en la petición.
 * @param {Object} payload
 */
function sendConfirmationEmail_(currentUser, idPeticion, element, payload, systemParams) {
  const params = systemParams || getSystemParams_();
  // La lista predeterminada vive en una sola constante.
  const ccList = normalizeSupportCcEmails_(
    params[SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL] || MAIL_DEFAULTS.SUPPORT_CC_EMAIL
  );
  const senderName = textSystemParam_(
    params, SYSTEM_PARAM_KEYS.MAIL_SENDER_NAME, MAIL_DEFAULTS.SENDER_NAME
  ).replace(/[\r\n]+/g, ' ');

  if (String(element.email_destino || '').trim()) {
    const destination = normalizeSingleEmail_(element.email_destino, 'email_destino de Elementos');
    if (!hasEmail_(ccList, destination)) ccList.push(destination);
  }

  const subject = buildConfirmationSubject_(
    textSystemParam_(params, SYSTEM_PARAM_KEYS.MAIL_SUBJECT,
      textSystemParam_(params, SYSTEM_PARAM_KEYS.LEGACY_MAIL_SUBJECT, MAIL_DEFAULTS.SUBJECT_TEMPLATE)),
    element,
    payload
  );
  const body = buildConfirmationEmailBody_(element);
  const htmlBody = buildConfirmationEmailHtml_(element);

  const options = {
    to: normalizeSingleEmail_(currentUser.email, 'email del usuario'),
    cc: ccList.join(','),
    name: senderName,
    subject: subject,
    body: body,
    htmlBody: htmlBody
  };
  const attachments = buildPhotoAttachments_(idPeticion, payload);
  if (attachments.length) options.attachments = attachments;
  MailApp.sendEmail(options);
}

function buildPhotoAttachments_(idPeticion, payload) {
  const photos = payload && (payload._photoAttachments ||
    (payload._photoAttachment ? [payload._photoAttachment] : []));
  if (!photos || !photos.length) return [];
  return photos.map(function (photo) {
    const extension = photo.mimeType === 'image/png' ? 'png' : 'jpg';
    const suffix = photo.fieldName === 'fotoHorario' ? '-horario' :
      photo.fieldName === 'fotoCobertura' ? '-cobertura' :
        photo.fieldName === 'fotoUbicacion' ? '-ubicacion' :
          photo.fieldName === 'fotoLayout' ? '-layout' : '';
    return Utilities.newBlob(photo.bytes, photo.mimeType, 'foto' + suffix + '-' + idPeticion + '.' + extension);
  });
}

/**
 * Acepta una lista de soporte separada solo por comas, valida cada dirección y
 * elimina duplicados sin distinguir mayúsculas de minúsculas.
 */
function normalizeSupportCcEmails_(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue || /[;\r\n]/.test(rawValue)) {
    throw publicError_('Revisa ' + SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL + ': usa direcciones válidas separadas por comas.');
  }
  const emails = rawValue.split(',').map(function (email) { return email.trim(); });
  if (emails.some(function (email) { return !email; })) {
    throw publicError_('Revisa ' + SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL + ': usa direcciones válidas separadas por comas.');
  }
  const uniqueEmails = [];
  emails.forEach(function (email) {
    const normalized = normalizeSingleEmail_(email, SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL);
    if (!hasEmail_(uniqueEmails, normalized)) uniqueEmails.push(normalized);
  });
  return uniqueEmails;
}

function hasEmail_(emails, candidate) {
  const normalizedCandidate = String(candidate).toLowerCase();
  return emails.some(function (email) { return String(email).toLowerCase() === normalizedCandidate; });
}

/** Acepta una sola dirección por celda y evita destinatarios adicionales inyectados. */
function normalizeSingleEmail_(value, source) {
  const email = String(value || '').trim();
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)) {
    throw publicError_('Revisa ' + (source || 'el correo configurado') + ': debe contener una sola dirección válida.');
  }
  return email;
}

/**
 * Sustituye únicamente los marcadores permitidos por datos validados en
 * servidor, sin aceptar saltos de línea en el asunto del correo.
 * @param {string} template
 * @param {Object} element
 * @param {Object} payload
 * @returns {string}
 */
function buildConfirmationSubject_(template, element, payload) {
  const details = payload._storeDetails || {};
  const store = details.tienda || details.tiendaOrigen || {};
  const destination = details.tiendaDestino;
  const storeCode = destination
    ? [store.tienda_id, destination.tienda_id].filter(Boolean).join(' → ')
    : store.tienda_id || '';
  const values = {
    id_elemento: element.id_elemento,
    equipo: element.equipo,
    tipo_gestion: element.tipo_gestion,
    tienda: storeCode,
    provincia: store.provincia || '',
    municipio: store.municipio || '',
    direccion: store.direccion || ''
  };
  const subject = String(template).replace(/{{([^{}]+)}}/g, function (marker, key) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw publicError_('Revisa ASUNTO_EMAIL en Sistema: marcador no admitido.');
    }
    return String(values[key] || '');
  });
  if (/{{|}}/.test(subject)) throw publicError_('Revisa ASUNTO_EMAIL en Sistema: marcadores inválidos.');
  // eslint-disable-next-line no-control-regex -- elimina controles del asunto de correo.
  return subject.replace(/[\r\n\u0000-\u001F\u007F]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

/** Devuelve el cuerpo configurado para el elemento seleccionado. */
function getElementEmailMessage_(element) {
  const message = String(element && element.mensaje_email || '').trim();
  if (!message) {
    throw publicError_('Revisa mensaje_email de Elementos: debe contener el cuerpo del correo.');
  }
  return message;
}

function buildConfirmationEmailBody_(element) {
  return getElementEmailMessage_(element);
}

function escapeMailHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mailHtmlText_(value) {
  return escapeMailHtml_(value).replace(/\r\n?|\n/g, '<br>');
}

/** Tarjeta HTML que muestra, con saltos de línea seguros, el mensaje del elemento. */
function buildConfirmationEmailHtml_(element) {
  const message = getElementEmailMessage_(element);
  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background:' + MAIL_HTML_THEME.background +
    ';color:' + MAIL_HTML_THEME.text + ';font-family:' + MAIL_HTML_THEME.fontFamily + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:' + MAIL_HTML_THEME.background + ';"><tr><td align="center" ' +
    'style="padding:20px 10px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="max-width:560px;background:' + MAIL_HTML_THEME.surface + ';border:1px solid ' +
    MAIL_HTML_THEME.border + ';border-radius:14px;">' +
    '<tr><td style="padding:13px 16px;border-bottom:1px solid ' + MAIL_HTML_THEME.border +
    ';text-align:left;"><img src="' + escapeMailHtml_(BRAND_ASSETS.LOGO_URL) +
    '" width="56" height="31" alt="DIA" style="display:inline-block;width:56px;height:31px;' +
    'border:0;vertical-align:middle;"><span style="padding-left:9px;color:' +
    MAIL_HTML_THEME.heading + ';font-size:12px;font-weight:700;vertical-align:middle;">' +
    escapeMailHtml_(APP_METADATA.NAME) + '</span></td></tr>' +
    '<tr><td style="padding:28px 24px 30px;text-align:center;">' +
    '<span style="display:inline-block;padding:12px 17px;border-radius:50%;background:' +
    MAIL_HTML_THEME.successBackground + ';color:' + MAIL_HTML_THEME.successText +
    ';font-size:22px;">✓</span>' +
    '<h1 style="margin:14px 0 18px;color:' + MAIL_HTML_THEME.primary +
    ';font-size:17px;line-height:1.3;">' + escapeMailHtml_(MAIL_HTML_TEXT.STATUS) + '</h1>' +
    '<div style="text-align:left;color:' + MAIL_HTML_THEME.text + ';font-size:14px;line-height:1.55;">' +
    mailHtmlText_(message) + '</div>' +
    '</td></tr></table></td></tr></table></body></html>';
}

if (typeof module !== 'undefined') {
  module.exports = {
    sendConfirmationEmail_, getElementEmailMessage_, buildConfirmationEmailBody_,
    buildConfirmationEmailHtml_, buildConfirmationSubject_, normalizeSupportCcEmails_,
    normalizeSingleEmail_, hasEmail_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

/**
 * Servicio de construcción y envío del correo de confirmación.
 * Destinatario principal: quien registra. CC: buzón fijo de soporte
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
  LOGO: 'Dia',
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
  // La dirección predeterminada vive en una sola constante.
  const supportCc = normalizeSingleEmail_(
    params[SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL] || MAIL_DEFAULTS.SUPPORT_CC_EMAIL,
    SYSTEM_PARAM_KEYS.SUPPORT_CC_EMAIL
  );
  const senderName = textSystemParam_(
    params, SYSTEM_PARAM_KEYS.MAIL_SENDER_NAME, MAIL_DEFAULTS.SENDER_NAME
  ).replace(/[\r\n]+/g, ' ');

  const ccList = [supportCc];
  if (String(element.email_destino || '').trim()) {
    const destination = normalizeSingleEmail_(element.email_destino, 'email_destino de Elementos');
    if (destination.toLowerCase() !== supportCc.toLowerCase()) ccList.push(destination);
  }

  const subject = buildConfirmationSubject_(
    textSystemParam_(params, SYSTEM_PARAM_KEYS.MAIL_SUBJECT,
      textSystemParam_(params, SYSTEM_PARAM_KEYS.LEGACY_MAIL_SUBJECT, MAIL_DEFAULTS.SUBJECT_TEMPLATE)),
    element,
    payload
  );
  const body = buildConfirmationEmailBody_(currentUser, idPeticion, element, payload);
  const htmlBody = buildConfirmationEmailHtml_(currentUser, idPeticion, element, payload);

  MailApp.sendEmail({
    to: normalizeSingleEmail_(currentUser.email, 'email del usuario'),
    cc: ccList.join(','),
    name: senderName,
    subject: subject,
    body: body,
    htmlBody: htmlBody
  });
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

/** Resuelve una vez los textos fijos compartidos por ambos formatos. */
function confirmationCopy_(currentUser, idPeticion) {
  const greeting = MAIL_DEFAULTS.CONFIRMATION_GREETING
    .replace(/{{nombre}}/g, String(currentUser.nombre || ''));
  const intro = MAIL_DEFAULTS.CONFIRMATION_INTRO.replace(/{{id_peticion}}/g, idPeticion);
  return { greeting: greeting, intro: intro, footer: MAIL_DEFAULTS.CONFIRMATION_FOOTER };
}

function confirmationFields_(element, payload) {
  return [
    [MAIL_FIELD_LABELS.EQUIPMENT, element.equipo],
    [MAIL_FIELD_LABELS.PROVIDER, element.proveedor],
    [MAIL_FIELD_LABELS.MANAGEMENT, element.etiqueta],
    [MAIL_FIELD_LABELS.DETAIL, element.subtipo],
    [MAIL_FIELD_LABELS.STORE, payload.tienda],
    [MAIL_FIELD_LABELS.ORIGIN_STORE, payload.tiendaOrigen],
    [MAIL_FIELD_LABELS.DESTINATION_STORE, payload.tiendaDestino],
    [MAIL_FIELD_LABELS.COLLECTION_DEADLINE, payload.fechaLimiteRecogida],
    [MAIL_FIELD_LABELS.START_DATE, payload.fechaInicio],
    [MAIL_FIELD_LABELS.END_DATE, payload.fechaFin],
    [MAIL_FIELD_LABELS.WITHDRAWAL_DEADLINE, payload.fechaMaximaRetirada],
    [MAIL_FIELD_LABELS.SERVICE_NOW, payload.codigoServiceNow],
    [MAIL_FIELD_LABELS.COMMENTS, payload.comentarios]
  ].filter(function (entry) { return entry[1] !== null && entry[1] !== undefined && entry[1] !== ''; });
}

function buildConfirmationEmailBody_(currentUser, idPeticion, element, payload) {
  const copy = confirmationCopy_(currentUser, idPeticion);
  const fields = confirmationFields_(element, payload).map(function (entry) {
    return entry[0] + entry[1];
  });
  return [copy.greeting, '', copy.intro, ''].concat(fields, ['', copy.footer]).join('\n');
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

/** Tarjeta HTML autocontenida, compatible con el cuerpo de texto plano. */
function buildConfirmationEmailHtml_(currentUser, idPeticion, element, payload) {
  const copy = confirmationCopy_(currentUser, idPeticion);
  const fields = [[MAIL_HTML_TEXT.REQUEST_ID, idPeticion]].concat(
    confirmationFields_(element, payload).map(function (entry) {
      return [entry[0].replace(/:\s*$/, ''), entry[1]];
    })
  );
  const rows = fields.map(function (entry) {
    return '<tr><td style="width:34%;padding:8px 10px;vertical-align:top;color:' +
      MAIL_HTML_THEME.muted + ';font-size:12px;">' + escapeMailHtml_(entry[0]) +
      '</td><td style="padding:8px 10px;vertical-align:top;color:' + MAIL_HTML_THEME.text +
      ';font-size:12px;font-weight:600;overflow-wrap:anywhere;">' + mailHtmlText_(entry[1]) +
      '</td></tr>';
  }).join('');

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
    ';text-align:left;"><span style="display:inline-block;padding:7px 8px;border-radius:5px;' +
    'background:' + MAIL_HTML_THEME.primary + ';color:#ffffff;font-size:16px;font-weight:700;">' +
    escapeMailHtml_(MAIL_HTML_TEXT.LOGO) + '</span><span style="padding-left:9px;color:' +
    MAIL_HTML_THEME.heading + ';font-size:12px;font-weight:700;">' +
    escapeMailHtml_(APP_METADATA.NAME) + '</span></td></tr>' +
    '<tr><td style="padding:28px 18px 30px;text-align:center;">' +
    '<span style="display:inline-block;padding:12px 17px;border-radius:50%;background:' +
    MAIL_HTML_THEME.successBackground + ';color:' + MAIL_HTML_THEME.successText +
    ';font-size:22px;">✓</span>' +
    '<h1 style="margin:14px 0 10px;color:' + MAIL_HTML_THEME.primary +
    ';font-size:17px;line-height:1.3;">' + escapeMailHtml_(MAIL_HTML_TEXT.STATUS) + '</h1>' +
    '<p style="margin:0 0 6px;color:' + MAIL_HTML_THEME.text + ';font-size:13px;">' +
    mailHtmlText_(copy.greeting) + '</p>' +
    '<p style="margin:0 0 22px;color:' + MAIL_HTML_THEME.text + ';font-size:13px;">' +
    mailHtmlText_(copy.intro) + '</p>' +
    '<p style="margin:0 0 8px;text-align:left;color:' + MAIL_HTML_THEME.heading +
    ';font-size:11px;font-weight:700;">' + escapeMailHtml_(MAIL_HTML_TEXT.DETAILS) + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:' + MAIL_HTML_THEME.background + ';border-left:3px solid ' +
    MAIL_HTML_THEME.primary + ';border-radius:8px;text-align:left;">' + rows + '</table>' +
    '</td></tr><tr><td style="padding:13px 18px;border-top:1px solid ' +
    MAIL_HTML_THEME.border + ';text-align:center;color:' + MAIL_HTML_THEME.muted +
    ';font-size:11px;font-style:italic;">' + mailHtmlText_(copy.footer) +
    '</td></tr></table></td></tr></table></body></html>';
}

if (typeof module !== 'undefined') {
  module.exports = {
    sendConfirmationEmail_, buildConfirmationEmailBody_, buildConfirmationEmailHtml_,
    buildConfirmationSubject_, normalizeSingleEmail_
  };
  Object.keys(module.exports).forEach(function (key) {
    global[key] = module.exports[key];
  });
}

const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '..', 'src', 'frontend');
const templateHtml = fs.readFileSync(path.join(frontendDir, '99_index.html'), 'utf8');
const fragmentNames = ['00_styles', '10_navigation', '20_form', '30_validation_submit'];
const html = fragmentNames.reduce(function (assembled, name) {
  const directive = "<?!= HtmlService.createHtmlOutputFromFile('frontend/" + name + "').getContent() ?>";
  if (!assembled.includes(directive)) throw new Error('Falta el fragmento ' + name);
  return assembled.replace(directive, function () {
    return fs.readFileSync(path.join(frontendDir, name + '.html'), 'utf8');
  });
}, templateHtml);

describe('99_index - contrato visual y accesible', function () {
  test('compone estilos y scripts locales en orden, sin build ni dist', function () {
    expect(templateHtml).toContain('<?= applicationTimeZone ?>');
    expect(templateHtml.match(/createHtmlOutputFromFile/g)).toHaveLength(fragmentNames.length);
    expect(templateHtml).not.toContain('src="https://');
    expect(html).not.toContain('createHtmlOutputFromFile');
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html.match(/<script>/g)).toHaveLength(4);
    const positions = fragmentNames.map(function (name) {
      return templateHtml.indexOf("'frontend/" + name + "'");
    });
    expect(positions).toEqual(positions.slice().sort(function (a, b) { return a - b; }));
    fragmentNames.slice(1).forEach(function (name) {
      const fragment = fs.readFileSync(path.join(frontendDir, name + '.html'), 'utf8');
      expect(fragment).not.toMatch(/<\?=/);
      const script = fragment.match(/^ {2}<script>\r?\n([\s\S]*?)\r?\n {2}<\/script>\s*$/);
      expect(script).not.toBeNull();
      expect(function () { new Function(script[1]); }).not.toThrow();
    });
  });

  test('doGet carga la plantilla desde la nueva carpeta frontend', function () {
    const createTemplate = HtmlService.createTemplateFromFile;
    let requestedName = null;
    let template = null;
    HtmlService.createTemplateFromFile = function (name) {
      requestedName = name;
      template = createTemplate();
      return template;
    };
    try {
      doGet();
      expect(requestedName).toBe('frontend/99_index');
      expect(template.applicationTimeZone).toBe('Europe/Madrid');
      expect(template.logoUrl).toBe(BRAND_ASSETS.LOGO_URL);
      expect(template.commentMaxLength).toBe(MAX_COMMENT_LENGTH);
      expect(template.photoMaxBytes).toBe(PHOTO_UPLOAD.MAX_BYTES);
      expect(template.photoMaxSizeDisplay).toBe('10');
      expect(template.storeIdMaxLength).toBe(STORE_ID_MAX_LENGTH);
      expect(template.serviceNowDigits).toBe(SERVICE_NOW_DIGITS);
      expect(template.brandWebsiteUrl).toBeUndefined();
    } finally {
      HtmlService.createTemplateFromFile = createTemplate;
    }
  });

  test('usa los tokens canónicos compartidos de tipografía, color y radios', function () {
    expect(html).toContain('--font-body: ui-sans-serif, system-ui, sans-serif');
    expect(html).toContain('--color-primary: #dc2626');
    expect(html).toContain('--color-primary-hover: #b91c1c');
    expect(html).toContain('--color-app-background: #f8fafc');
    expect(html).toContain('--color-text-primary: #0f172a');
    expect(html).toContain('--radius-control: .5rem');
    expect(html).toContain('--radius-card: .75rem');
    expect(html).not.toMatch(/@import|fonts\.googleapis\.com/);
  });

  test('conserva componentes y estados accesibles', function () {
    expect(html).toMatch(/<button class="option-card"/);
    expect(html).toMatch(/<dialog class="result-dialog"/);
    expect(html).toContain(':focus-visible');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).toContain('forced-colors: active');
  });

  test('cubre smartphone, equipos de 14 pulgadas y monitores grandes', function () {
    expect(html).toContain('@media (max-width: 39.999rem)');
    expect(html).toContain('@media (min-width: 64rem) and (max-height: 50rem)');
    expect(html).toContain('@media (min-width: 90rem)');
    expect(html).toContain('--content-width: 100rem');
  });

  test('sitúa la marca DIA a la izquierda, las iniciales a la derecha y la versión en el footer', function () {
    expect(html).toContain('<span class="app-header__brand">');
    expect(html).not.toContain('brandWebsiteUrl');
    expect(html).toContain('src="<?= logoUrl ?>"');
    expect(html).not.toContain('data:image/');
    expect(BRAND_ASSETS.LOGO_URL).toBe(
      'https://www.dia.es/content-manager/image/Logos_footer_header/web_logo.svg'
    );
    expect(html).toContain('id="headerUserInitials"');
    expect(html).toContain('renderHeaderUser(appState.user)');
    expect(html).toContain('<?= applicationName ?> - <?= applicationVersion ?>');
    expect(APP_METADATA.VERSION).toBe(require('../package.json').version);
  });

  test('solicita código numérico de tienda, consulta al servidor con overlay y exige comentarios', function () {
    expect(html).toContain("control.pattern = '[0-9]{1,' + FORM_RULES.storeIdMaxLength");
    expect(html).toContain('control.maxLength = FORM_RULES.storeIdMaxLength');
    expect(html).toContain("showLoading('Buscando tienda…')");
    expect(html).toContain('.lookupStore(code, appState.currentElement.id_elemento)');
    expect(html).toContain('control.maxLength = FORM_RULES.commentMaxLength');
    expect(html).toContain('appState.uiText.commentsHint');
    expect(UI_TEXT_DEFAULTS.COMMENTS_HINT).toContain('se enviará directamente al proveedor');
    expect(html).toContain('className = \'modification-store-card\'');
    expect(html).toContain('--color-store-card: #b8191c');
    expect(html).toContain('renderStoreCard(card, result.store)');
    expect(html).toContain('inputRow.hidden = true');
    expect(html).toContain("management === 'NUEVA_SOLICITUD'");
    expect(html).toContain("field('enchufeDisponible', '¿Enchufe disponible?', 'yes-no', true)");
    expect(html).toContain("field('tomaAguaDisponible', '¿Toma de agua disponible?', 'yes-no', true)");
    expect(html).toContain("field('fotoUbicacion', 'Foto ubicación', 'photo', true");
    expect(html).toContain("field('fotoLayout', 'Foto layout', 'photo', true");
    expect(html).toContain("['SI', 'NO'].forEach(function (choice)");
    expect(html).toContain('choice-group__option--selected');
    expect(html).toContain("management === 'ERROR_PANTALLA' && element.equipo === 'CAFETERA'");
    expect(html).toContain("field('foto', 'Foto', 'photo', true");
    expect(html).toContain("control.accept = 'image/jpeg,image/png,.jpeg,.jpg,.png'");
    expect(html).toContain("event.clipboardData && event.clipboardData.files");
    expect(html).toContain("event.dataTransfer && event.dataTransfer.files");
    expect(html).toContain("control._photoDropZone.hidden = true");
    expect(html).toContain("control._photoRemove.addEventListener('click', clearPhoto)");
    expect(html).toContain("area.toLocaleString('es-ES'");
  });

  test('mantiene Registrar desactivado hasta validar tiendas, ServiceNow y comentarios', function () {
    expect(html).toMatch(/id="submitButton"[^>]*disabled/);
    expect(html).toContain("action.textContent = definition.type === 'store' ? 'Buscar' : 'Introducir'");
    expect(html).toContain("control.dataset.resolvedCode !== value");
    expect(html).toContain("control.dataset.confirmedCode !== value");
    expect(html).toContain('id="serviceNowInfoDialog"');
    expect(html).toContain('Te recordamos que el procedimiento habitual es reclamarlo a través de ServiceNow.');
    expect(html).toContain('showServiceNowInfo();');
    expect(html).toContain("counter.textContent = '0 / ' + FORM_RULES.commentMaxLength");
    expect(html).toContain('button.disabled = !getFormFieldDefinitions');
    expect(html).toContain('control.value = normalizeCommentText(control.value)');
    expect(html).toContain("console.error('Falló la llamada a submitRequest.', error)");
    expect(html).toContain('appState.uiText.submissionTransportFailure');
    expect(UI_TEXT_DEFAULTS.SUBMISSION_TRANSPORT_FAILURE)
      .toContain('Comprueba si recibes el correo de confirmación antes de volver a intentarlo.');
    expect(html).not.toContain('No se pudo completar la solicitud. Inténtalo de nuevo más tarde.');
  });

  test('mantiene equivalentes las normalizaciones y fechas del cliente y del servidor', function () {
    const commentSource = html.slice(
      html.indexOf('function normalizeCommentText(value)'),
      html.indexOf('function updateCommentCounter(control)')
    ).trim();
    const dateSource = html.slice(
      html.indexOf('function isValidIsoDate(value)'),
      html.indexOf('function getFieldErrorMessage(definition, control)')
    ).trim();
    const clientNormalize = new Function(commentSource + '; return normalizeCommentText;')();
    const clientIsValidDate = new Function(dateSource + '; return isValidIsoDate;')();
    [
      '  Primera   línea \r\n\r\n\tSegunda\u00a0  línea\u200b  ',
      '=texto\n  otra línea  ',
      '', null
    ].forEach(function (value) {
      expect(clientNormalize(value)).toBe(normalizeCommentText_(value));
    });
    ['2026-09-13', '2026-02-29', '2024-02-29', '13/09/2026', ''].forEach(function (value) {
      expect(clientIsValidDate(value)).toBe(isValidIsoDate_(value));
    });
  });

  test('deriva DR del email con apellido separado por coma', function () {
    const source = html.match(/function getUserInitials\(user\) \{([\s\S]*?)\n {4}\}/);
    expect(source).not.toBeNull();
    const getInitials = new Function('user', source[1]);
    expect(getInitials({ email: 'david,rincon@diagroup.com', nombre: 'David' })).toBe('DR');
  });

  test('desactiva el alta para tiendas iguales, fechas no futuras y ServiceNow sin confirmar', function () {
    const source = html.match(/function getFieldErrorMessage\(definition, control\) \{([\s\S]*?)\n {4}\}/);
    expect(source).not.toBeNull();
    const origin = { dataset: { resolvedCode: '0001' } };
    const document = { getElementById: function () { return origin; } };
    const appState = { currentElement: { tipo_gestion: 'MOVIMIENTO' } };
    const getFieldErrorMessage = new Function(
      'document', 'appState', 'getTomorrowDateInAppTimeZone', 'isValidIsoDate', 'normalizeCommentText',
      'FORM_RULES', 'STORE_ID_PATTERN', 'SERVICE_NOW_PATTERN',
      'return function getFieldErrorMessage(definition, control) {' + source[1] + '\n}'
    )(document, appState, function () { return '2026-09-13'; }, function (value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    }, function (value) { return value; },
    { storeIdMaxLength: 5, serviceNowPrefix: 'TASK', serviceNowDigits: 7,
      commentMaxLength: 2000, commentMaxLengthDisplay: '2.000' },
    /^\d{1,5}$/, /^TASK\d{7}$/);

    const destination = {
      value: '0001', dataset: { resolvedCode: '0001' }, validity: { valid: true }
    };
    expect(getFieldErrorMessage({ name: 'tiendaDestino', type: 'store', required: true }, destination))
      .toMatch(/deben ser distintas/);
    destination.value = '0002';
    destination.dataset.resolvedCode = '0002';
    expect(getFieldErrorMessage({ name: 'tiendaDestino', type: 'store', required: true }, destination))
      .toBe('');

    const date = { value: '2026-09-12', min: '', validity: { valid: true } };
    const definition = { name: 'fechaInicio', type: 'date', required: true };
    expect(getFieldErrorMessage(definition, date)).toMatch(/posterior a hoy/);
    date.value = '2026-09-13';
    expect(getFieldErrorMessage(definition, date)).toBe('');
    const serviceNow = { value: 'TASK123456', dataset: {}, validity: { valid: true } };
    const serviceNowDefinition = { name: 'codigoServiceNow', type: 'text', required: true };
    expect(getFieldErrorMessage(serviceNowDefinition, serviceNow)).toMatch(/TASK seguido de 7 dígitos/);
    serviceNow.value = 'TASK1234567';
    expect(getFieldErrorMessage(serviceNowDefinition, serviceNow)).toMatch(/Pulsa Introducir/);
    serviceNow.dataset.confirmedCode = 'TASK1234567';
    expect(getFieldErrorMessage(serviceNowDefinition, serviceNow)).toBe('');
    expect(html).toContain('refreshMovementStoreError();');
  });
});

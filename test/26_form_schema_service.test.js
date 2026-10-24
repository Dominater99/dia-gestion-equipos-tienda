const fs = require('fs');
const path = require('path');

function elementFixture() {
  return { id_elemento: 'NEV-TEST', equipo: 'NEVERA', proveedor: '', tipo_gestion: 'RETIRADA',
    etiqueta: 'Petición de prueba', estado: 'ACTIVE', requiere_service_now: 'NO',
    solo_tiendas_abiertas: 'NO', mensaje_email: '{{comentarios}}', orden: 10 };
}

function configureFields(changes) {
  const element = elementFixture();
  const rows = defaultFormFieldRows_(element);
  (changes || []).forEach(function (change) {
    Object.assign(rows.find(function (row) { return row.campo === change.campo; }), change);
  });
  const sheets = resetMockSheets({
    Sistema: [['clave', 'valor']],
    Usuarios: [['email', 'nombre', 'estado', 'rol'], ['ana@example.com', 'Ana', 'ACTIVO', 'GESTOR_GLOBAL']],
    Tiendas: [['tienda_id', 'direccion', 'municipio', 'estado'], ['0001', 'Dirección sintética', 'Municipio', 'Abierta']],
    Elementos: [Object.keys(element), Object.values(element)],
    Campos_peticion: [FORM_FIELD_HEADERS].concat(rows.map(function (row) {
      return FORM_FIELD_HEADERS.map(function (key) { return row[key]; });
    })),
    Registros: [REGISTRO_COLUMNS]
  });
  Session.getActiveUser = function () { return { getEmail: function () { return 'ana@example.com'; } }; };
  return sheets;
}

function submission(payload) {
  return submitRequest(Object.assign({ idElemento: 'NEV-TEST', tienda: '0001',
    comentarios: 'Texto de prueba.', formRevision: getElementById_('NEV-TEST').formRevision }, payload));
}

describe('Campos configurados por petición', function () {
  test('el arranque señala errores de configuración y limita sus detalles a administradores', function () {
    ['ADMINISTRADOR', 'GESTOR_GLOBAL'].forEach(function (role) {
      const sheets = configureFields([]);
      sheets.Usuarios._getRawValues()[1][3] = role;
      sheets.Campos_peticion._getRawValues()[1][1] = 'desconocido';
      const result = checkAccess();
      expect(result).toMatchObject({ authorized: false, configurationError: true });
      expect(result.message.includes('Campos_peticion')).toBe(role === 'ADMINISTRADOR');
    });
  });

  test('el navegador recibe los campos y su revisión sin configuración de destinatarios ni mensajes', function () {
    configureFields([]);
    const element = checkAccess().elements[0];
    expect(element.formFields.length).toBeGreaterThan(0);
    expect(element.formRevision).toMatch(/^[a-f0-9]{64}$/);
    ['email_destino', 'email_copia', 'mensaje_email', '_configuredSchema'].forEach(function (key) {
      expect(element).not.toHaveProperty(key);
    });
  });
  test('permite una foto opcional y oculta Comentarios sin exigirlos ni persistir los ocultos', function () {
    const sheets = configureFields([
      { campo: 'foto', estado: 'OPCIONAL', orden: 20 }, { campo: 'comentarios', estado: 'OCULTO' }
    ]);
    const result = submission({ comentarios: 'Dato oculto que no debe guardarse.' });
    expect(result.success).toBe(true);
    expect(sheets.Registros._getRawValues()[1][REGISTRO_COLUMNS.indexOf('comentarios')]).toBe('');
    expect(MailApp.sentEmails[0]).not.toHaveProperty('attachments');
  });

  test('una foto opcional se valida y se adjunta si está presente', function () {
    configureFields([{ campo: 'foto', estado: 'OPCIONAL', orden: 20 }]);
    const photo = { mimeType: 'image/png', base64: Buffer.from(PHOTO_UPLOAD.SIGNATURES['image/png']).toString('base64') };
    expect(submission({ foto: photo }).success).toBe(true);
    expect(MailApp.sentEmails[0].attachments).toHaveLength(1);
    expect(MailApp.sentEmails[0].attachments[0].getContentType()).toBe('image/png');
  });

  test('un campo SI/NO opcional se guarda fuera de las combinaciones antiguas', function () {
    const sheets = configureFields([{ campo: 'toma_agua_disponible', estado: 'OPCIONAL', orden: 20 }]);
    expect(submission({ tomaAguaDisponible: 'si' }).success).toBe(true);
    expect(sheets.Registros._getRawValues()[1][REGISTRO_COLUMNS.indexOf('toma_agua_disponible')]).toBe('SI');
  });

  test('ServiceNow opcional se captura y valida; la columna heredada no impone su obligatoriedad', function () {
    const sheets = configureFields([{ campo: 'codigo_servicenow', estado: 'OPCIONAL', orden: 20 }]);
    sheets.Elementos._getRawValues()[1][Object.keys(elementFixture()).indexOf('requiere_service_now')] = 'SI';
    expect(submission({ codigoServiceNow: '' }).success).toBe(true);
    expect(submission({ codigoServiceNow: 'TASK1234567' }).success).toBe(true);
    expect(submission({ codigoServiceNow: 'TASK12' }).success).toBe(false);
    expect(sheets.Registros._getRawValues()[2][REGISTRO_COLUMNS.indexOf('codigo_servicenow')]).toBe('TASK1234567');
  });

  test('un cambio en los requisitos devuelve el formulario actualizado antes de asignar ID', function () {
    const sheets = configureFields([]);
    const revision = getElementById_('NEV-TEST').formRevision;
    const photo = sheets.Campos_peticion._getRawValues().find(function (row) { return row[1] === 'foto'; });
    photo[2] = 'OBLIGATORIO';
    removeCachedJson_(CACHE_KEYS.FORM_FIELDS);
    const result = submitRequest({ idElemento: 'NEV-TEST', formRevision: revision, tienda: '0001', comentarios: 'Borrador.' });
    expect(result.success).toBe(false);
    expect(result.updatedElement.formFields.some(function (field) { return field.key === 'foto' && field.required; })).toBe(true);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_KEYS.REQUEST_COUNTER)).toBeNull();
    expect(MailApp.sentEmails).toHaveLength(0);
  });

  test('rechaza campos repetidos, desconocidos y referencias a peticiones inexistentes', function () {
    [
      function (rows) { rows.push(rows[1].slice()); },
      function (rows) { rows[1][1] = 'campo_desconocido'; },
      function (rows) { rows[1][0] = 'OTRA'; }
    ].forEach(function (mutate) {
      const sheets = configureFields([]);
      mutate(sheets.Campos_peticion._getRawValues());
      expect(function () { getActiveElements_(); }).toThrow(/Campos_peticion/);
    });
  });

  test('no permite ocultar tiendas ni las fechas de una desconexión', function () {
    const element = elementFixture();
    const rows = defaultFormFieldRows_(element);
    rows.find(function (row) { return row.campo === 'tienda'; }).estado = 'OCULTO';
    expect(function () { hydrateElementSchemas_([element], rows); }).toThrow(/tiendas obligatorias/);
    element.tipo_gestion = 'DESCONEXION_TEMPORAL';
    const disconnection = defaultFormFieldRows_(element);
    disconnection.find(function (row) { return row.campo === 'fecha_fin'; }).estado = 'OPCIONAL';
    expect(function () { hydrateElementSchemas_([element], disconnection); }).toThrow(/inicio y fin obligatorios/);
  });

  test('el catálogo rechaza IDs duplicados y gestiones desconocidas', function () {
    const element = elementFixture();
    expect(function () { hydrateElementSchemas_([element, element], null); }).toThrow(/duplicado/);
    expect(function () { hydrateElementSchemas_([{ ...element, tipo_gestion: 'ERRATA' }], null); }).toThrow(/gestión/);
  });

  test('impide inyectar cualquiera de las dos propiedades internas de adjuntos', function () {
    configureFields([]);
    const photo = { fieldName: 'foto', mimeType: 'application/pdf', bytes: [1, 2, 3] };
    expect(submission({ _photoAttachments: [photo], _photoAttachment: photo }).success).toBe(true);
    expect(MailApp.sentEmails[0]).not.toHaveProperty('attachments');
  });

  test('una cabecera incompleta se rechaza sin ID ni notificación', function () {
    const sheets = configureFields([]);
    sheets.Registros._getRawValues()[0] = ['id_peticion', 'timestamp_registro', 'email_usuario'];
    const diagnostic = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      expect(submission().success).toBe(false);
      expect(PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_KEYS.REQUEST_COUNTER)).toBeNull();
      expect(sheets.Registros._getRawValues()).toHaveLength(1);
      expect(MailApp.sentEmails).toHaveLength(0);
    } finally { diagnostic.mockRestore(); }
  });

  test('las llaves del comentario se envían como texto sin reinterpretar marcadores', function () {
    configureFields([]);
    expect(submission({ comentarios: 'Pantalla muestra {ERROR} y {{literal}}.' }).success).toBe(true);
    expect(MailApp.sentEmails[0].body).toContain('{ERROR} y {{literal}}');
    expect(MailApp.sentEmails[0].htmlBody).toContain('{ERROR} y {{literal}}');
  });

  test('valida el orden de un periodo y admite inicio y fin en el mismo día', function () {
    const element = elementFixture(); element.tipo_gestion = 'DESCONEXION_TEMPORAL';
    expect(function () { validateRequestPayload_(element, {
      tienda: '0001', fechaInicio: '2099-02-10', fechaFin: '2099-02-01', comentarios: 'Prueba'
    }); }).toThrow(/fin no puede ser anterior/);
    expect(function () { validateRequestPayload_(element, {
      tienda: '0001', fechaInicio: '2099-02-10', fechaFin: '2099-02-10', comentarios: 'Prueba'
    }); }).not.toThrow();
  });

  test('el formulario del cliente utiliza el esquema del servidor y respeta etiqueta, ayuda y obligatoriedad', function () {
    const html = fs.readFileSync(path.join(__dirname, '../src/frontend/20_form.html'), 'utf8');
    const source = html.slice(html.indexOf('function getFormFieldDefinitions'), html.indexOf('function renderForm'));
    const fields = new Function('appState', source + ';return getFormFieldDefinitions;')({ uiText: {} });
    const supplied = [{ name: 'comentarios', type: 'textarea', required: false, label: 'Motivo', hint: 'Ayuda personalizada' }];
    expect(fields({ formFields: supplied })).toEqual(supplied);
    expect(fields({ formFields: [] })).toEqual([]);
  });
});

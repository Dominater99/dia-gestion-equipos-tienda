const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { renderTestEnvironment, validateTestConfig } = require('../scripts/build-test');
const { assertDeploymentTargets, assertUnchangedDeployments } = require('../scripts/deploy-test');

function loadTestRuntime(email) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const reads = jest.spyOn(book, 'getSheetByName');
  const context = vm.createContext({
    Date, console, Session, Utilities, MailApp, LockService, CacheService, PropertiesService, HtmlService,
    SpreadsheetApp: { getActiveSpreadsheet: function () { return book; }, flush: function () {} }
  });
  const dir = path.join(__dirname, '..', 'src', 'backend');
  fs.readdirSync(dir).filter(function (name) { return name.endsWith('.js'); }).sort()
    .forEach(function (name) {
      let source = fs.readFileSync(path.join(dir, name), 'utf8');
      if (name === '01_environment.js') source = renderTestEnvironment(source, email);
      vm.runInContext(source, context, { filename: name });
    });
  return { context, reads };
}

function fixtures() {
  return resetMockSheets({
    Usuarios: [['NO MODIFICAR']], Sistema: [['NO MODIFICAR']],
    Registros: [['NO MODIFICAR']], Logs: [['NO MODIFICAR']],
    TEST_Sistema: [['clave', 'valor'], ['EMAIL_CC_SOPORTE', 'soporte@example.com']],
    TEST_Usuarios: [
      ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
      ['test@diagroup.com', 'Prueba', 'ACTIVO', 'GESTOR_GLOBAL', '', '']
    ],
    TEST_Elementos: [
      ['id_elemento', 'equipo', 'tipo_gestion', 'estado', 'email_destino', 'email_copia', 'mensaje_email'],
      ['PRUEBA', 'NEVERA', 'RETIRADA', 'ACTIVE', 'proveedor@example.com', 'copia@example.com', '{{comentarios}}']
    ],
    TEST_Tiendas: [
      ['tienda_id', 'delegacion_desc', 'direccion', 'municipio', 'estado'],
      ['0001', 'Pruebas', 'Dirección sintética', 'Municipio', 'Abierta']
    ],
    TEST_Registros: [REGISTRO_COLUMNS],
    TEST_Campos_peticion: [FORM_FIELD_HEADERS].concat(defaultFormFieldRows_({
      id_elemento: 'PRUEBA', equipo: 'NEVERA', tipo_gestion: 'RETIRADA'
    }).map(function (row) { return FORM_FIELD_HEADERS.map(function (key) { return row[key]; }); }))
  });
}

describe('Entorno TEST: aislamiento de pestañas y entrega de correo', function () {
  test('el alta y la creación de Logs usan solo TEST_ y notifican exclusivamente al buzón de pruebas', function () {
    const sheets = fixtures();
    const runtime = loadTestRuntime('sandbox@example.com');
    const result = runtime.context.submitRequest({
      idElemento: 'PRUEBA', tienda: '0001', comentarios: 'Solicitud de prueba.',
      formRevision: runtime.context.getElementById_('PRUEBA').formRevision
    });
    expect(result).toMatchObject({ success: true, notificationSent: true });
    expect(sheets.TEST_Registros._getRawValues()).toHaveLength(2);
    expect(sheets.TEST_Logs._getRawValues()).toHaveLength(2);
    ['Usuarios', 'Sistema', 'Registros', 'Logs'].forEach(function (name) {
      expect(sheets[name]._getRawValues()).toEqual([['NO MODIFICAR']]);
    });
    expect(runtime.reads.mock.calls.every(function (call) { return call[0].startsWith('TEST_'); })).toBe(true);
    expect(MailApp.sentEmails).toHaveLength(1);
    expect(MailApp.sentEmails[0]).toMatchObject({ to: 'sandbox@example.com', cc: '' });
    expect(MailApp.sentEmails[0]).not.toHaveProperty('bcc');
    expect(MailApp.sentEmails[0].subject).toMatch(/^\[PRUEBAS\] /);
  });

  test('si falta una pestaña TEST_ no utiliza la original', function () {
    resetMockSheets({ Tiendas: [['tienda_id'], ['0001']] });
    const runtime = loadTestRuntime('sandbox@example.com');
    expect(function () { runtime.context.getSheet_('Tiendas'); }).toThrow(/TEST_Tiendas/);
    expect(runtime.reads.mock.calls).toEqual([['TEST_Tiendas']]);
    expect(function () { runtime.context.getSheet_('Otra'); }).toThrow(/contrato/);
  });

  test('la caché de producción no puede sustituir los datos TEST ni ser invalidada desde TEST', function () {
    fixtures();
    putCachedJson_(CACHE_KEYS.SYSTEM, { origen: 'PROD' }, 5);
    const runtime = loadTestRuntime('sandbox@example.com');
    const params = runtime.context.getSystemParams_();
    expect(params).not.toHaveProperty('origen');
    expect(params.EMAIL_CC_SOPORTE).toBe('soporte@example.com');
    runtime.context.removeCachedJson_(CACHE_KEYS.SYSTEM);
    expect(getCachedJson_(CACHE_KEYS.SYSTEM)).toEqual({ origen: 'PROD' });
  });

  test('las copias y destinatarios reales, aunque sean inválidos, nunca se usan para entregar en TEST', function () {
    fixtures();
    const runtime = loadTestRuntime('sandbox@example.com');
    runtime.context.sendConfirmationEmail_({ email: 'solicitante@example.com' }, 'SOL-TEST', {
      equipo: 'NEVERA', tipo_gestion: 'RETIRADA', mensaje_email: 'Prueba',
      email_destino: 'destino-invalido', email_copia: 'copia-invalida'
    }, {}, { EMAIL_CC_SOPORTE: 'soporte-invalido' });
    expect(MailApp.sentEmails[0]).toMatchObject({ to: 'sandbox@example.com', cc: '' });
  });

  test('un buzón de pruebas vacío o con varios destinatarios impide enviar', function () {
    ['', 'uno@example.com,dos@example.com'].forEach(function (email) {
      fixtures();
      const runtime = loadTestRuntime(email);
      expect(function () {
        runtime.context.sendConfirmationEmail_({ email: 'solicitante@example.com' }, 'SOL-TEST', {
          mensaje_email: 'Prueba'
        }, {}, {});
      }).toThrow(/buzón de pruebas/);
    });
    expect(MailApp.sentEmails).toHaveLength(0);
  });

  test('identifica la web como PRUEBAS y dirige Solicitar acceso al mismo buzón', function () {
    fixtures();
    const runtime = loadTestRuntime('sandbox@example.com');
    runtime.context.findUserByEmail_ = function () { return undefined; };
    expect(runtime.context.checkAccess().adminEmail).toBe('sandbox@example.com');
    let template;
    runtime.context.HtmlService = {
      createTemplateFromFile: function () {
        template = { evaluate: function () {
          const output = { setTitle: function () { return output; }, addMetaTag: function () { return output; } };
          return output;
        } };
        return template;
      }
    };
    runtime.context.doGet();
    expect(template.applicationName).toMatch(/PRUEBAS/);
  });
});

describe('Publicación de pruebas con destino explícito', function () {
  const config = { testEmail: 'sandbox@example.com', productionDeploymentId: 'prod', productionVersion: 27 };
  test('rechaza configuración incompleta y destinos iguales', function () {
    expect(function () { validateTestConfig({ testEmail: 'sandbox@example.com' }); }).toThrow(/producción/);
    expect(function () { validateTestConfig({ ...config, testDeploymentId: 'prod' }); }).toThrow(/distintos/);
    expect(function () { validateTestConfig({ ...config, testEmail: 'a@example.com,b@example.com' }); }).toThrow(/único/);
  });
  test('detiene la publicación si cambia producción o si el destino de pruebas no está identificado', function () {
    expect(function () { assertDeploymentTargets([{ deploymentId: 'prod', versionNumber: 28 }], config); })
      .toThrow(/producción/);
    expect(function () { assertDeploymentTargets([
      { deploymentId: 'prod', versionNumber: 27 }, { deploymentId: 'otra', versionNumber: 5 }
    ], { ...config, testDeploymentId: 'otra' }); }).toThrow(/pruebas/);
  });
  test('comprueba que todas las implementaciones ajenas a TEST conservan su versión', function () {
    const before = [{ deploymentId: 'prod', versionNumber: 27 }];
    expect(function () { assertUnchangedDeployments(before, [
      ...before, { deploymentId: 'test', versionNumber: 28 }
    ], 'test'); }).not.toThrow();
    expect(function () { assertUnchangedDeployments(before, [
      { deploymentId: 'prod', versionNumber: 28 }
    ], 'test'); }).toThrow(/cambiado/);
  });
});

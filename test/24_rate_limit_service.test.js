describe('24_rate_limit_service - límite persistente por usuario', function () {
  beforeEach(function () {
    resetMockSheets({ Sistema: [['clave', 'valor']] });
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T10:00:00Z'));
  });

  afterEach(function () {
    jest.useRealTimers();
  });

  test('admite diez intentos y rechaza el undécimo sin guardar el email', function () {
    for (let i = 0; i < 10; i++) {
      expect(function () { consumeSubmissionAttempt_(' ANA@DIAGROUP.COM '); }).not.toThrow();
    }
    let firstError;
    try { consumeSubmissionAttempt_('ana@diagroup.com'); } catch (error) { firstError = error; }
    expect(firstError.isPublic).toBe(true);
    expect(firstError.isRateLimit).toBe(true);
    expect(firstError.logRateLimit).toBe(true);
    expect(firstError.message).toMatch(/10 minutos/);

    let repeatedError;
    try { consumeSubmissionAttempt_('ana@diagroup.com'); } catch (error) { repeatedError = error; }
    expect(repeatedError.logRateLimit).toBe(false);
    const properties = PropertiesService._dump();
    const keys = Object.keys(properties).filter(function (key) {
      return key.startsWith('limite_envios_usuario:');
    });
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^limite_envios_usuario:[a-f0-9]{64}$/);
    expect(JSON.stringify(properties)).not.toContain('ana@diagroup.com');
  });

  test('aísla usuarios y reinicia la ventana después de diez minutos', function () {
    for (let i = 0; i < 10; i++) consumeSubmissionAttempt_('ana@diagroup.com');
    expect(function () { consumeSubmissionAttempt_('bea@diagroup.com'); }).not.toThrow();
    jest.advanceTimersByTime(9 * 60 * 1000);
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); }).toThrow(/1 minuto/);
    jest.advanceTimersByTime(60 * 1000);
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); }).not.toThrow();
  });

  test('un estado corrupto y un fallo de bloqueo impiden continuar', function () {
    expect(function () { parseSubmissionRateState_('malformado'); }).toThrow(/no es válido/);
    expect(function () { parseSubmissionRateState_('100:11:0'); }).toThrow(/no es válido/);
    const originalGetScriptLock = LockService.getScriptLock;
    LockService.getScriptLock = function () {
      return { waitLock: function () { throw new Error('timeout'); }, releaseLock: jest.fn() };
    };
    try {
      expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); }).toThrow(/timeout/);
      expect(PropertiesService._dump()).toEqual({});
    } finally {
      LockService.getScriptLock = originalGetScriptLock;
    }
  });

  test('elimina estados vencidos sin tocar otras propiedades', function () {
    consumeSubmissionAttempt_('ana@diagroup.com');
    PropertiesService.getScriptProperties().setProperty('ULTIMO_ID_PETICION', '12');
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    consumeSubmissionAttempt_('bea@diagroup.com');
    const properties = PropertiesService._dump();
    const userKeys = Object.keys(properties).filter(function (key) {
      return key.startsWith('limite_envios_usuario:');
    });
    expect(userKeys).toHaveLength(1);
    expect(properties.ULTIMO_ID_PETICION).toBe('12');
  });

  test('la limpieza diaria borra como máximo cincuenta claves por pasada', function () {
    for (let i = 0; i < 52; i++) {
      consumeSubmissionAttempt_('usuario' + i + '@diagroup.com');
    }
    jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    consumeSubmissionAttempt_('nuevo@diagroup.com');
    const remainingUserKeys = Object.keys(PropertiesService._dump()).filter(function (key) {
      return key.startsWith('limite_envios_usuario:');
    });
    expect(remainingUserKeys).toHaveLength(3);
    consumeSubmissionAttempt_('otro-nuevo@diagroup.com');
    const afterSecondBatch = Object.keys(PropertiesService._dump()).filter(function (key) {
      return key.startsWith('limite_envios_usuario:');
    });
    expect(afterSecondBatch).toHaveLength(2);
  });

  test('limita por separado las consultas de acceso y tienda sin guardar el email', function () {
    for (let i = 0; i < 30; i++) consumeReadAttempt_(' ANA@DIAGROUP.COM ', 'access');
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'access'); })
      .toThrow(/Demasiadas consultas/);
    for (let i = 0; i < 60; i++) consumeReadAttempt_('ana@diagroup.com', 'store');
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'store'); })
      .toThrow(/Demasiadas consultas/);
    expect(function () { consumeReadAttempt_('bea@diagroup.com', 'store'); }).not.toThrow();
    expect(JSON.stringify(PropertiesService._dump())).not.toContain('ana@diagroup.com');
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'access'); }).not.toThrow();
  });

  test('un estado de lecturas corrupto deniega y no afecta al límite de registros', function () {
    consumeReadAttempt_('ana@diagroup.com', 'store');
    const properties = PropertiesService.getScriptProperties();
    const key = Object.keys(PropertiesService._dump()).find(function (candidate) {
      return candidate.startsWith('limite_lecturas_usuario:store:');
    });
    properties.setProperty(key, 'malformado');
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'store'); })
      .toThrow(/no válido/);
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); }).not.toThrow();
  });

  test('acepta los estados de ventana persistidos por la versión anterior', function () {
    expect(parseSubmissionRateState_('100:2:0')).toMatchObject({
      attempts: 2, maxAttempts: 10, windowMs: 600000
    });
    expect(parseReadRateState_('100:2', 'store')).toMatchObject({
      attempts: 2, maxAttempts: 60, windowMs: 600000
    });
  });

  test('usa el límite de envíos de Sistema y aplica cambios en la ventana siguiente', function () {
    const sheet = getSheet_(SHEET_NAMES.SISTEMA);
    sheet.appendRow([SYSTEM_PARAM_KEYS.SUBMISSION_ATTEMPTS_LIMIT, 2]);
    sheet.appendRow([SYSTEM_PARAM_KEYS.SUBMISSION_WINDOW_SECONDS, 60]);
    consumeSubmissionAttempt_('ana@diagroup.com');
    consumeSubmissionAttempt_('ana@diagroup.com');
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); })
      .toThrow(/límite de intentos/);
    sheet.getRange(2, 2).setValue(3);
    removeCachedJson_(CACHE_KEYS.SYSTEM);
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); })
      .toThrow(/límite de intentos/);
    jest.advanceTimersByTime(60 * 1000);
    for (let i = 0; i < 3; i++) {
      expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); }).not.toThrow();
    }
    expect(function () { consumeSubmissionAttempt_('ana@diagroup.com'); })
      .toThrow(/límite de intentos/);
  });

  test('usa los umbrales de acceso y tienda de Sistema por separado', function () {
    const sheet = getSheet_(SHEET_NAMES.SISTEMA);
    sheet.appendRow([SYSTEM_PARAM_KEYS.ACCESS_LOOKUPS_LIMIT, 1]);
    sheet.appendRow([SYSTEM_PARAM_KEYS.STORE_LOOKUPS_LIMIT, 2]);
    sheet.appendRow([SYSTEM_PARAM_KEYS.READ_WINDOW_SECONDS, 60]);
    consumeReadAttempt_('ana@diagroup.com', 'access');
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'access'); })
      .toThrow(/Demasiadas consultas/);
    consumeReadAttempt_('ana@diagroup.com', 'store');
    consumeReadAttempt_('ana@diagroup.com', 'store');
    expect(function () { consumeReadAttempt_('ana@diagroup.com', 'store'); })
      .toThrow(/Demasiadas consultas/);
  });
});

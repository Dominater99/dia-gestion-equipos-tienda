describe('20_config_service', function () {
  test('lee clave y valor por cabecera aunque haya metadatos y las columnas cambien de orden', function () {
    resetMockSheets({ Sistema: [
      ['categoria', 'valor', 'descripcion', 'clave'], ['Identidad visual', BRAND_ASSETS.LOGO_URL, 'Logo', 'LOGO_URL']
    ] });
    expect(getSystemParams_().LOGO_URL).toBe(BRAND_ASSETS.LOGO_URL);
    setSystemParam_('LOGO_URL', 'https://www.dia.es/otro-logo.svg');
    expect(getSystemParams_().LOGO_URL).toBe('https://www.dia.es/otro-logo.svg');
  });

  test('rechaza claves duplicadas y cabeceras sin clave o valor', function () {
    resetMockSheets({ Sistema: [['clave', 'valor'], ['LOGO_URL', 'uno'], [' LOGO_URL ', 'dos']] });
    expect(function () { getSystemParams_(); }).toThrow(/duplicada/);
    resetMockSheets({ Sistema: [['nombre', 'dato']] });
    expect(function () { getSystemParams_(); }).toThrow(/clave y valor/);
  });

  test('valida el origen y HTTPS del logo compartido por web y correo', function () {
    expect(resolveLogoUrl_({})).toBe(BRAND_ASSETS.LOGO_URL);
    expect(resolveLogoUrl_({ LOGO_URL: 'https://www.dia.es/nuevo.svg' })).toBe('https://www.dia.es/nuevo.svg');
    ['http://www.dia.es/logo.svg', 'https://www.dia.es.ejemplo.com/logo.svg', 'javascript:alert(1)',
      'https://www.dia.es/logo.svg" onerror="alert(1)'].forEach(function (url) {
      expect(function () { resolveLogoUrl_({ LOGO_URL: url }); }).toThrow(/LOGO_URL/);
    });
  });
  test('getSystemParams_ lee los pares parametro/valor de la pestaña Sistema', function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['EMAIL_ADMIN', 'admin@diagroup.com'],
        ['ULTIMO_ID_PETICION', 5]
      ]
    });

    const params = getSystemParams_();

    expect(params.EMAIL_ADMIN).toBe('admin@diagroup.com');
    expect(params.ULTIMO_ID_PETICION).toBe(5);
    expect(global.CacheService._dump()).toHaveProperty(CACHE_KEYS.SYSTEM);
  });

  test('CACHE_HABILITADA=FALSE evita almacenar Sistema', function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['CACHE_HABILITADA', false]
      ]
    });

    getSystemParams_();

    expect(global.CacheService._dump()).not.toHaveProperty(CACHE_KEYS.SYSTEM);
  });

  test('setSystemParam_ actualiza un parámetro existente', function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['ULTIMO_ID_PETICION', 5]
      ]
    });

    setSystemParam_('ULTIMO_ID_PETICION', 6);

    expect(getSystemParams_().ULTIMO_ID_PETICION).toBe(6);
  });

  test('setSystemParam_ crea el parámetro si todavía no existe', function () {
    resetMockSheets({ Sistema: [['parametro', 'valor']] });

    setSystemParam_('EMAIL_CC_SOPORTE', 'soporte@diagroup.com');

    expect(getSystemParams_().EMAIL_CC_SOPORTE).toBe('soporte@diagroup.com');
  });

  test('los umbrales operativos configurados deben ser enteros positivos seguros', function () {
    expect(positiveIntegerSystemParam_({}, 'LIMITE', 10)).toBe(10);
    expect(positiveIntegerSystemParam_({ LIMITE: '25' }, 'LIMITE', 10)).toBe(25);
    ['0', '-1', '2.5', 'sin límite', '999999999999999999999'].forEach(function (value) {
      expect(function () { positiveIntegerSystemParam_({ LIMITE: value }, 'LIMITE', 10); })
        .toThrow(/entero positivo/);
    });
    expect(rateWindowMs_({ VENTANA: 30 }, 'VENTANA', 600000)).toBe(30000);
  });

  test('un texto vacío de Sistema recupera el valor inicial', function () {
    expect(textSystemParam_({ TEXTO: '  ' }, 'TEXTO', 'Predeterminado')).toBe('Predeterminado');
    expect(textSystemParam_({ TEXTO: '  Personalizado  ' }, 'TEXTO', 'Predeterminado'))
      .toBe('Personalizado');
  });
});

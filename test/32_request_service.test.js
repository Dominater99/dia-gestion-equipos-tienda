describe('32_request_service - validateRequestPayload_', function () {
  test('exige tienda de origen y destino en un movimiento', function () {
    const element = { tipo_gestion: 'MOVIMIENTO', equipo: 'CAFETERA', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(element, { tiendaOrigen: '0001' });
    }).toThrow(/origen/);
  });

  test('rechaza un movimiento entre la misma tienda aunque haya espacios', function () {
    const element = { tipo_gestion: 'MOVIMIENTO', equipo: 'CAFETERA', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(element, {
        tiendaOrigen: '0001', tiendaDestino: ' 0001 ', comentarios: 'Traslado solicitado.'
      });
    }).toThrow(/deben ser distintas/);
    expect(function () {
      validateRequestPayload_(element, {
        tiendaOrigen: '0001', tiendaDestino: '0002', comentarios: 'Traslado solicitado.'
      });
    }).not.toThrow();
  });

  test('exige fecha de inicio y fin en una desconexión temporal', function () {
    const element = { tipo_gestion: 'DESCONEXION_TEMPORAL', equipo: 'LOCKER', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(element, { tienda: '0001' });
    }).toThrow(/fecha de inicio/);
  });

  test('exige fecha máxima de retirada solo para Locker', function () {
    const elementLocker = { tipo_gestion: 'RETIRADA', equipo: 'LOCKER', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(elementLocker, { tienda: '0001' });
    }).toThrow(/fecha máxima/);

    const elementCafetera = { tipo_gestion: 'RETIRADA', equipo: 'CAFETERA', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(elementCafetera, { tienda: '0001', comentarios: 'Retirada solicitada.' });
    }).not.toThrow();
  });

  test('rechaza un código de ServiceNow con formato incorrecto cuando el elemento lo requiere', function () {
    const element = { tipo_gestion: 'INCIDENCIA_SERVICENOW', equipo: 'LOCKER', requiere_service_now: 'SI' };
    expect(function () {
      validateRequestPayload_(element, { tienda: '0001', codigoServiceNow: 'TASK123' });
    }).toThrow(/TASK/);
  });

  test('acepta un código de ServiceNow con el formato correcto', function () {
    const element = { tipo_gestion: 'INCIDENCIA_SERVICENOW', equipo: 'LOCKER', requiere_service_now: 'SI' };
    expect(function () {
      validateRequestPayload_(element, {
        tienda: '0001',
        codigoServiceNow: 'TASK0012345',
        comentarios: 'Incidencia detallada.'
      });
    }).not.toThrow();
  });

  test('rechaza prefijos, longitudes y caracteres ajenos al patrón TASK y siete dígitos', function () {
    const element = { tipo_gestion: 'INCIDENCIA_SERVICENOW', equipo: 'LOCKER', requiere_service_now: 'SI' };
    ['', 'TASK123456', 'TASK12345678', 'task1234567', 'TASK123456A', 'CASE1234567'].forEach(function (code) {
      expect(function () {
        validateRequestPayload_(element, {
          tienda: '0001', codigoServiceNow: code, comentarios: 'Incidencia detallada.'
        });
      }).toThrow(/TASK seguido de 7 dígitos/);
    });
  });

  test('valida también un código enviado cuando el elemento no lo exige', function () {
    const element = { tipo_gestion: 'RETIRADA', equipo: 'CAFETERA', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(element, {
        tienda: '0001', codigoServiceNow: 'TASK123', comentarios: 'Retirada solicitada.'
      });
    }).toThrow(/TASK seguido de 7 dígitos/);
    expect(function () {
      validateRequestPayload_(element, {
        tienda: '0001', codigoServiceNow: 'TASK1234567', comentarios: 'Retirada solicitada.'
      });
    }).not.toThrow();
  });

  test('no exige código de ServiceNow si el elemento no lo requiere', function () {
    const element = { tipo_gestion: 'RECLAMACION_SIN_PARTE', equipo: 'CAFETERA', requiere_service_now: 'NO' };
    expect(function () {
      validateRequestPayload_(element, { tienda: '0001', comentarios: 'Reclamación detallada.' });
    }).not.toThrow();
  });

  test('exige siempre Comentarios y limita el contenido a 2.000 caracteres', function () {
    const element = { tipo_gestion: 'RETIRADA', equipo: 'CAFETERA', requiere_service_now: 'NO' };

    expect(function () {
      validateRequestPayload_(element, { tienda: '0001', comentarios: '   ' });
    }).toThrow(/Comentarios.*obligatorio/);

    expect(function () {
      validateRequestPayload_(element, { tienda: '0001', comentarios: 'x'.repeat(2001) });
    }).toThrow(/2\.000/);

    expect(function () {
      validateRequestPayload_(element, { tienda: '0001', comentarios: 'x'.repeat(2000) });
    }).not.toThrow();
  });

  test('normaliza líneas vacías, espacios repetidos y caracteres invisibles', function () {
    expect(normalizeCommentText_('  Primera   línea \r\n\r\n\tSegunda\u00a0  línea\u200b  '))
      .toBe('Primera línea\nSegunda línea');
  });
});

describe('RequestService - fechas futuras', function () {
  beforeEach(function () {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-12T12:00:00Z'));
  });

  afterEach(function () {
    jest.useRealTimers();
  });

  test('rechaza hoy y ayer para las cuatro fechas, y acepta mañana', function () {
    [
      'fechaLimiteRecogida', 'fechaInicio', 'fechaFin', 'fechaMaximaRetirada'
    ].forEach(function (field) {
      expect(function () { validateFutureDates_({ [field]: '2026-09-11' }); }).toThrow(/posterior a hoy/);
      expect(function () { validateFutureDates_({ [field]: '2026-09-12' }); }).toThrow(/posterior a hoy/);
      expect(function () { validateFutureDates_({ [field]: '2026-09-13' }); }).not.toThrow();
    });
    expect(function () { validateFutureDates_({ fechaLimiteRecogida: '' }); }).not.toThrow();
  });

  test('rechaza formatos erróneos y fechas de calendario imposibles', function () {
    ['2026-02-30', '2026-13-01', '13/09/2026', '   '].forEach(function (value) {
      expect(function () { validateFutureDates_({ fechaInicio: value }); }).toThrow(/no es válida/);
    });
  });

  test('usa el día de Europe/Madrid incluso cerca de medianoche UTC', function () {
    jest.setSystemTime(new Date('2026-09-12T22:30:00Z'));
    expect(function () { validateFutureDates_({ fechaInicio: '2026-09-13' }); }).toThrow(/posterior a hoy/);
    expect(function () { validateFutureDates_({ fechaInicio: '2026-09-14' }); }).not.toThrow();
  });
});

describe('RequestService - generateRequestId_', function () {
  test('empieza por el ID 1 sin modificar Sistema y conserva el correlativo', function () {
    const systemRows = [['clave', 'valor'], ['ENTORNO', 'PROD']];
    const sheets = resetMockSheets({ Sistema: systemRows });

    expect(generateRequestId_()).toMatch(/^SOL-\d{8}-0001$/);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBe('1');
    expect(generateRequestId_()).toMatch(/^SOL-\d{8}-0002$/);
    expect(sheets.Sistema._getRawValues()).toEqual(systemRows);
  });

  test('incrementa el valor existente de forma monotónica', function () {
    resetMockSheets({ Sistema: [['clave', 'valor']] });
    PropertiesService.getScriptProperties().setProperty('ULTIMO_ID_PETICION', '9');

    expect(generateRequestId_()).toMatch(/^SOL-\d{8}-0010$/);
  });

  test('usa solo ULTIMO_ID_PETICION de Script Properties', function () {
    const systemRows = [['clave', 'valor'], ['EMAIL_ADMIN', 'admin@diagroup.com']];
    const sheets = resetMockSheets({ Sistema: systemRows });
    PropertiesService.getScriptProperties().setProperty('ULTIMO_ID_PETICION', '3');

    expect(generateRequestId_()).toMatch(/^SOL-\d{8}-0004$/);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBe('4');
    expect(sheets.Sistema._getRawValues()).toEqual(systemRows);
  });

  test('rechaza un contador guardado con formato inválido', function () {
    resetMockSheets({ Sistema: [['clave', 'valor']] });
    PropertiesService.getScriptProperties().setProperty('ULTIMO_ID_PETICION', 'sin-numero');

    expect(function () { generateRequestId_(); }).toThrow(/contador.*Script Properties/);
  });
});

describe('RequestService - submitRequest', function () {
  function buildFixtures(usuarioEstado, elementoEstado) {
    return resetMockSheets({
      Usuarios: [
        ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
        ['ana@diagroup.com', 'Ana Gómez', usuarioEstado, 'GESTOR_DELEGACION', 'DELEGACION', 'Madrid']
      ],
      Sistema: [
        ['parametro', 'valor'],
        ['EMAIL_CC_SOPORTE', 'dia.es.soporte.layouts@diagroup.com']
      ],
      Elementos: [
        ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta', 'estado', 'requiere_service_now', 'solo_tiendas_abiertas', 'email_destino', 'orden'],
        ['CAF-RETIRADA', 'CAFETERA', '', 'RETIRADA', '', 'Retirada de cafetera sin destino', elementoEstado, 'NO', 'NO', '', 10]
      ],
      Tiendas: [
        STORE_COLUMNS,
        ['ES000000001', '0001', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39,
          'Illescas Flujo', 'AV JUAN XXIII 10', 'Pozuelo de Alarcón', 'MADRID', 'Abierta']
      ],
      Registros: [[
        'id_peticion', 'timestamp_registro', 'email_usuario', 'nombre_usuario', 'delegacion_usuario',
        'id_elemento', 'etiqueta_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo',
        'tienda', 'tienda_origen', 'tienda_destino', 'fecha_limite_recogida', 'fecha_inicio', 'fecha_fin',
        'fecha_maxima_retirada', 'necesita_codigo_servicenow', 'codigo_servicenow', 'comentarios'
      ]]
    });
  }

  test('graba la fila en Registros (con id_elemento y etiqueta_elemento) y envía el correo de confirmación', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA',
      tienda: '0001',
      tiendaOrigen: '99999',
      fechaInicio: '2099-01-01',
      codigoServiceNow: 'TASK1234567',
      comentarios: 'Retirada coordinada con la tienda.'
    });

    expect(result.success).toBe(true);
    expect(result.idPeticion).toMatch(/^SOL-\d{8}-0001$/);

    const filaGrabada = sheets.Registros._getRawValues()[1];
    expect(filaGrabada).toHaveLength(21);
    expect(filaGrabada[5]).toBe('CAF-RETIRADA'); // id_elemento
    expect(filaGrabada[6]).toBe('Retirada de cafetera sin destino'); // etiqueta_elemento
    expect(filaGrabada[11]).toBe('0001 - AV JUAN XXIII 10, Pozuelo de Alarcón');
    expect(filaGrabada[12]).toBe('');
    expect(filaGrabada[15]).toBe('');
    expect(filaGrabada[19]).toBe('');
    expect(global.MailApp.sentEmails[0].subject).toContain('0001-MADRID-Pozuelo de Alarcón-AV JUAN XXIII 10');

    expect(global.MailApp.sentEmails).toHaveLength(1);
    expect(global.MailApp.sentEmails[0].to).toBe('ana@diagroup.com');
    expect(global.MailApp.sentEmails[0].body).not.toContain('2099-01-01');
    expect(global.MailApp.sentEmails[0].body).not.toContain('TASK1234567');
    expect(sheets.Logs._getRawValues()[1].slice(1, 6)).toEqual([
      'INFO', 'SOLICITUD_REGISTRADA', 'ana@diagroup.com', result.idPeticion,
      'Solicitud registrada correctamente.'
    ]);
    const logContext = JSON.parse(sheets.Logs._getRawValues()[1][6]);
    expect(logContext).toEqual({
      etapa: 'NOTIFICACION',
      idElemento: 'CAF-RETIRADA',
      equipo: 'CAFETERA',
      tipoGestion: 'RETIRADA',
      notificacionEnviada: true
    });
    expect(JSON.stringify(logContext)).not.toContain('Retirada coordinada con la tienda.');
    expect(JSON.stringify(logContext)).not.toContain('AV JUAN XXIII');
  });

  test('no genera ID ni graba un movimiento con la misma tienda de origen y destino', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Elementos._getRawValues()[1][3] = 'MOVIMIENTO';
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tiendaOrigen: '0001', tiendaDestino: '0001',
      comentarios: 'Traslado solicitado.'
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/deben ser distintas/);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBeNull();
    expect(sheets.Logs._getRawValues()[1].slice(1, 6)).toEqual([
      'AVISO', 'SOLICITUD_RECHAZADA', 'ana@diagroup.com', '',
      'Solicitud rechazada.'
    ]);
    expect(JSON.parse(sheets.Logs._getRawValues()[1][6])).toEqual({
      etapa: 'VALIDACION',
      idElemento: 'CAF-RETIRADA',
      equipo: 'CAFETERA',
      tipoGestion: 'MOVIMIENTO'
    });
  });

  test('no genera ID ni graba una solicitud con un código ServiceNow inválido', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Elementos._getRawValues()[1][3] = 'INCIDENCIA_SERVICENOW';
    sheets.Elementos._getRawValues()[1][7] = 'SI';
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001',
      codigoServiceNow: 'TASK123456', comentarios: 'Incidencia detallada.'
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/TASK seguido de 7 dígitos/);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBeNull();
  });

  test('persiste y envía los comentarios normalizados', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001',
      comentarios: '  Solicitud   urgente\n\n   Confirmada  con tienda.  '
    });

    expect(result.success).toBe(true);
    expect(sheets.Registros._getRawValues()[1][20]).toBe('Solicitud urgente\nConfirmada con tienda.');
    expect(global.MailApp.sentEmails[0].body)
      .toContain('Comentarios: Solicitud urgente\nConfirmada con tienda.');
  });

  test('rechaza una tienda que no pertenece al ámbito visible del usuario', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA',
      tienda: '9999',
      comentarios: 'Solicitud de prueba.'
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no está disponible/);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
  });

  test('mantiene el alta como correcta si falla la notificación posterior', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    global.MailApp.sendEmail = function () {
      throw new Error('Fallo simulado de correo');
    };

    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    let result;
    try {
      result = submitRequest({
        idElemento: 'CAF-RETIRADA',
        tienda: '0001',
        comentarios: 'Retirada coordinada con la tienda.'
      });
      expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleError.mock.calls[0][0].message).toContain('submitRequest [NOTIFICACION]');
      expect(consoleError.mock.calls[0][0].message).toContain('Fallo simulado de correo');
    } finally {
      consoleError.mockRestore();
    }

    expect(result.success).toBe(true);
    expect(result.notificationSent).toBe(false);
    expect(sheets.Registros._getRawValues()).toHaveLength(2);
    expect(sheets.Logs._getRawValues()[1][2]).toBe('NOTIFICACION_FALLIDA');
    expect(sheets.Logs._getRawValues()[1][4]).toBe(result.idPeticion);
    expect(JSON.parse(sheets.Logs._getRawValues()[1][6])).toMatchObject({
      etapa: 'NOTIFICACION', idElemento: 'CAF-RETIRADA', notificacionEnviada: false
    });
  });

  test('identifica la clave de Sistema cuando el asunto impide notificar', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema.appendRow(['ASUNTO_EMAIL', 'Gestión {{marcador_desconocido}}']);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud registrada.'
    });
    expect(result.success).toBe(true);
    expect(result.notificationSent).toBe(false);
    expect(result.message).toContain('ASUNTO_EMAIL');
    expect(sheets.Registros._getRawValues()).toHaveLength(2);
    expect(JSON.parse(sheets.Logs._getRawValues()[1][6])).toMatchObject({
      etapa: 'NOTIFICACION', idElemento: 'CAF-RETIRADA', notificacionEnviada: false
    });
  });

  test('identifica email_destino cuando la dirección del elemento no es válida', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Elementos._getRawValues()[1][9] = 'uno@diagroup.com,dos@diagroup.com';
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud registrada.'
    });
    expect(result.success).toBe(true);
    expect(result.notificationSent).toBe(false);
    expect(result.message).toContain('email_destino de Elementos');
    expect(sheets.Registros._getRawValues()).toHaveLength(2);
  });

  test('limita a diez registros diarios por usuario sin consumir otro ID', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const today = new Date();
    for (let i = 0; i < 10; i++) {
      const row = Array(21).fill('');
      row[0] = 'SOL-ANTERIOR-' + i;
      row[1] = today;
      row[2] = 'ana@diagroup.com';
      sheets.Registros.appendRow(row);
    }
    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Otra retirada.'
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/límite de 10 solicitudes/);
    expect(sheets.Registros._getRawValues()).toHaveLength(11);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBeNull();
    expect(global.MailApp.sentEmails).toHaveLength(0);
  });

  test('usa el límite configurable y no cuenta registros de otro día', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema.appendRow(['LIMITE_REGISTROS_DIARIOS_USUARIO', 1]);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const oldRow = Array(21).fill('');
    oldRow[0] = 'SOL-ANTERIOR';
    oldRow[1] = new Date('2020-01-01T12:00:00Z');
    oldRow[2] = 'ana@diagroup.com';
    sheets.Registros.appendRow(oldRow);
    expect(submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Primera de hoy.'
    }).success).toBe(true);
    const blocked = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Segunda de hoy.'
    });
    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/límite de 1 solicitudes/);
  });

  test('consulta solo el tramo final de Registros y reutiliza la cabecera al insertar', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    for (let i = 0; i < 500; i++) {
      const row = Array(21).fill('');
      row[0] = 'SOL-ANTERIOR-' + i;
      row[1] = new Date('2020-01-01T12:00:00Z');
      row[2] = 'otro@diagroup.com';
      sheets.Registros.appendRow(row);
    }
    const todayRow = Array(21).fill('');
    todayRow[0] = 'SOL-HOY';
    todayRow[1] = new Date();
    todayRow[2] = 'otro@diagroup.com';
    sheets.Registros.appendRow(todayRow);
    sheets.Registros.getDataRange = function () {
      throw new Error('No debe leerse Registros completa');
    };
    const originalGetRange = sheets.Registros.getRange;
    const reads = [];
    sheets.Registros.getRange = function (row, col, numRows, numCols) {
      reads.push([row, col, numRows, numCols]);
      return originalGetRange(row, col, numRows, numCols);
    };

    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud de hoy.'
    });
    expect(result.success).toBe(true);
    expect(reads).toHaveLength(2);
    expect(reads[0][0]).toBe(1);
    expect(reads[1][2]).toBeLessThanOrEqual(REGISTROS_SCAN_BATCH_ROWS);
    expect(reads[1][0]).toBeGreaterThan(2);
  });

  test('registra un estado corrupto del limitador y lo limpia antes de otro intento', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    consumeSubmissionAttempt_('ana@diagroup.com');
    const properties = PropertiesService.getScriptProperties();
    const key = Object.keys(PropertiesService._dump()).find(function (candidate) {
      return candidate.startsWith(SUBMISSION_RATE_LIMIT.PROPERTY_PREFIX);
    });
    properties.setProperty(key, 'malformado');

    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    let rejected;
    try {
      rejected = submitRequest({
        idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud.'
      });
      expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleError.mock.calls[0][0].message).toContain('submitRequest [LIMITE_ENVIOS]');
      expect(consoleError.mock.calls[0][0].message).toContain('El estado del límite de envíos no es válido');
    } finally {
      consoleError.mockRestore();
    }
    expect(rejected.success).toBe(false);
    expect(sheets.Logs._getRawValues()[1][2]).toBe(LOG_EVENTS.RATE_LIMIT_STATE_INVALID);
    expect(properties.getProperty(key)).toBeNull();
    expect(sheets.Registros._getRawValues()).toHaveLength(1);

    const next = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud.'
    });
    expect(next.success).toBe(true);
  });

  test('un segundo envío crea otra solicitud y otro correo', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const payload = {
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Retirada solicitada.'
    };
    const first = submitRequest(payload);
    const second = submitRequest(payload);
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.idPeticion).not.toBe(first.idPeticion);
    expect(sheets.Registros._getRawValues()).toHaveLength(3);
    expect(global.MailApp.sentEmails).toHaveLength(2);
  });

  test('el cupo diario bloquea un segundo envío idéntico', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema.appendRow(['LIMITE_REGISTROS_DIARIOS_USUARIO', 1]);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const payload = {
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud única.'
    };
    const first = submitRequest(payload);
    expect(first.success).toBe(true);
    const retry = submitRequest(payload);
    expect(retry.success).toBe(false);
    expect(retry.message).toMatch(/límite de 1 solicitudes/);
    expect(sheets.Registros._getRawValues()).toHaveLength(2);
    expect(global.MailApp.sentEmails).toHaveLength(1);
  });

  test('deniega un límite diario inválido antes de asignar ID', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema.appendRow(['LIMITE_REGISTROS_DIARIOS_USUARIO', 'sin límite']);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud.'
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('LIMITE_REGISTROS_DIARIOS_USUARIO');
    expect(result.message).toContain('Sistema');
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBeNull();
  });

  test('deja vacías las columnas antiguas de reintento si ya existen en Registros', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Registros._getRawValues()[0].push('clave_idempotencia', 'huella_solicitud');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const result = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud.'
    });
    expect(result.success).toBe(true);
    expect(sheets.Registros._getRawValues()).toHaveLength(2);
    expect(sheets.Registros._getRawValues()[1].slice(21)).toEqual(['', '']);
  });

  test('rechaza identidad vacía sin leer hojas ni escribir Logs', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    const originalGetDataRange = sheets.Sistema.getDataRange;
    let systemReads = 0;
    sheets.Sistema.getDataRange = function () {
      systemReads++;
      return originalGetDataRange();
    };
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return ''; } };
    };

    const result = submitRequest({ idElemento: 'CAF-RETIRADA' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/identificar/);
    expect(systemReads).toBe(0);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(sheets.Logs).toBeUndefined();
  });

  test('un fallo del limitador deniega sin amplificar escrituras en Logs', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const originalGetProperties = PropertiesService.getScriptProperties;
    PropertiesService.getScriptProperties = function () {
      return { getProperty: function () { throw new Error('Fallo simulado de Properties'); } };
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      const result = submitRequest({ idElemento: 'CAF-RETIRADA' });
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Properties');
      expect(sheets.Registros._getRawValues()).toHaveLength(1);
      expect(sheets.Logs).toBeUndefined();
      expect(global.MailApp.sentEmails).toHaveLength(0);
    } finally {
      consoleError.mockRestore();
      PropertiesService.getScriptProperties = originalGetProperties;
    }
  });

  test('devuelve success=false y no graba nada si el usuario no está activo', function () {
    const sheets = buildFixtures('INACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({ idElemento: 'CAF-RETIRADA', tienda: '0001' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/acceso/);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(global.MailApp.sentEmails).toHaveLength(0);
  });

  test('devuelve success=false si el elemento ya no está ACTIVE (se desactivó entre cargar la página y enviar)', function () {
    buildFixtures('ACTIVO', 'INACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({ idElemento: 'CAF-RETIRADA', tienda: '0001' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/ya no está disponible/);
  });

  test('devuelve success=false si falta un campo obligatorio', function () {
    buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({ idElemento: 'CAF-RETIRADA' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/tienda/);
  });

  test('devuelve success=false si no se indica idElemento', function () {
    buildFixtures('ACTIVO', 'ACTIVE');
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = submitRequest({ tienda: '0001' });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/qué se quiere gestionar/);
  });

  test('bloquea la ráfaga por usuario antes de generar ID, escribir o enviar correo', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema._getRawValues().push(['CACHE_HABILITADA', false]);
    const originalGetDataRange = sheets.Sistema.getDataRange;
    let systemReads = 0;
    sheets.Sistema.getDataRange = function () {
      systemReads++;
      return originalGetDataRange();
    };
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    for (let i = 0; i < 10; i++) {
      expect(submitRequest({ idElemento: 'CAF-RETIRADA' }).message).toMatch(/tienda/);
    }
    const readsBeforeBlock = systemReads;
    const blocked = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud válida.'
    });
    const blockedAgain = submitRequest({
      idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud válida.'
    });

    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/límite de intentos/);
    expect(blockedAgain.message).toMatch(/límite de intentos/);
    expect(sheets.Registros._getRawValues()).toHaveLength(1);
    expect(global.MailApp.sentEmails).toHaveLength(0);
    expect(PropertiesService.getScriptProperties().getProperty('ULTIMO_ID_PETICION')).toBeNull();
    expect(systemReads).toBe(readsBeforeBlock);
    const events = sheets.Logs._getRawValues().slice(1).map(function (row) { return row[2]; });
    expect(events.filter(function (event) { return event === 'LIMITE_ENVIOS_EXCEDIDO'; })).toHaveLength(1);
    expect(events).toHaveLength(11); // diez rechazos normales y un único aviso de límite
  });

  test('lee Sistema una vez por alta con la caché desactivada', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Sistema._getRawValues().push(['CACHE_HABILITADA', false]);
    const originalGetDataRange = sheets.Sistema.getDataRange;
    let reads = 0;
    sheets.Sistema.getDataRange = function () {
      reads++;
      return originalGetDataRange();
    };
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    expect(submitRequest({ idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Primera solicitud.' }).success)
      .toBe(true);
    expect(reads).toBe(1);

    expect(submitRequest({ idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Segunda solicitud.' }).success)
      .toBe(true);
    expect(reads).toBe(2);
  });

  test('un fallo de Logs no convierte en fallida una solicitud ya guardada', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Logs = createMockSheet([HEADERS_LOGS]);
    sheets.Logs.appendRow = function () { throw new Error('Error interno del logger'); };
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      const result = submitRequest({
        idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Solicitud válida.'
      });
      expect(result.success).toBe(true);
      expect(sheets.Registros._getRawValues()).toHaveLength(2);
      expect(global.MailApp.sentEmails).toHaveLength(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('oculta un fallo interno de Sheets y deja un evento sin datos del formulario', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    delete sheets.Registros;
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    let result;
    try {
      result = submitRequest({
        idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Texto privado de prueba.'
      });
      expect(consoleError).toHaveBeenCalledWith(expect.any(Error));
      expect(consoleError.mock.calls[0][0].message).toContain('submitRequest [REGISTROS]');
      expect(consoleError.mock.calls[0][0].message).toContain('No se encuentra la pestaña');
      expect(consoleError.mock.calls[0][0].message).not.toContain('Texto privado');
    } finally {
      consoleError.mockRestore();
    }

    expect(result.success).toBe(false);
    expect(result.message).not.toContain('Registros');
    expect(result.message).toMatch(/Contacta con soporte/);
    expect(JSON.stringify(sheets.Logs._getRawValues())).not.toContain('Texto privado');
    expect(JSON.parse(sheets.Logs._getRawValues()[1][6]).etapa).toBe('REGISTROS');
  });

  test('diagnostica una columna obligatoria ausente sin mostrar el esquema al usuario', function () {
    const sheets = buildFixtures('ACTIVO', 'ACTIVE');
    sheets.Registros._getRawValues()[0].splice(0, 1);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      const result = submitRequest({
        idElemento: 'CAF-RETIRADA', tienda: '0001', comentarios: 'Contenido privado.'
      });

      expect(result.success).toBe(false);
      expect(result.message).not.toContain('id_peticion');
      expect(sheets.Registros._getRawValues()).toHaveLength(1);
      expect(consoleError.mock.calls[0][0].message).toContain('Faltan columnas obligatorias en Registros');
      expect(consoleError.mock.calls[0][0].message).not.toContain('Contenido privado');
    } finally {
      consoleError.mockRestore();
    }
  });

  test('redacta emails, URLs y tokens del diagnóstico técnico', function () {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      logRequestFailure_('REGISTROS', new Error(
        'ana@diagroup.com https://example.com/privado ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'
      ));
      const diagnostic = consoleError.mock.calls[0][0];
      expect(diagnostic).toBeInstanceOf(Error);
      expect(diagnostic.message).toContain('[email] [url] [dato]');
      expect(diagnostic.stack).not.toContain('ana@diagroup.com');
      expect(diagnostic.stack).not.toContain('example.com');
      expect(diagnostic.stack).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456');
    } finally {
      consoleError.mockRestore();
    }
  });
});

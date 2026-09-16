describe('31_mail_service', function () {
  const element = {
    id_elemento: 'CAF-RETIRADA',
    equipo: 'CAFETERA',
    proveedor: '',
    tipo_gestion: 'RETIRADA',
    subtipo: '',
    etiqueta: 'Retirada de cafetera sin destino',
    email_destino: '',
    mensaje_email: 'Hola Ana,\n\nTu solicitud ha sido registrada correctamente.'
  };

  beforeEach(function () {
    resetMockSheets({ Sistema: [['parametro', 'valor']] });
  });

  test('usa mensaje_email como cuerpo literal del correo', function () {
    const body = buildConfirmationEmailBody_(element);

    expect(body).toBe('Hola Ana,\n\nTu solicitud ha sido registrada correctamente.');
    expect(body).not.toContain('Tienda:');
  });

  test('sustituye variables simples y dobles de mensaje_email con datos del servidor', function () {
    const body = buildConfirmationEmailBody_(Object.assign({}, element, {
      equipo: 'CAFETERA',
      subtipo: 'Error en pantalla',
      mensaje_email: 'Equipo: {equipo}\nMotivo: {{subtipo}}\nTienda: {{tienda_id}}\nComentarios: {{comentarios}}'
    }), {
      tienda: '0001 - Dia Centro',
      comentarios: 'La pantalla no enciende.',
      _storeDetails: { tienda: { tienda_id: '0001' } }
    });

    expect(body).toBe('Equipo: CAFETERA\nMotivo: Error en pantalla\nTienda: 0001\nComentarios: "La pantalla no enciende."');
  });
  test('admite todas las variables de Elementos y Registros', function () {
    const body = buildConfirmationEmailBody_(Object.assign({}, element, {
      proveedor: 'Proveedor A',
      prioridad: 'Alta',
      mensaje_email: '{{proveedor}}|{{prioridad}}|{{id_peticion}}|{{email_usuario}}|{{nombre_usuario}}|{{tienda_origen}}|{{tienda_destino}}|{{fecha_limite_recogida}}|{{codigo_servicenow}}|{{enchufe_disponible}}'
    }), {
      tiendaOrigen: '0001 - Centro',
      tiendaDestino: '0002 - Norte',
      fechaLimiteRecogida: '2099-02-03',
      codigoServiceNow: 'TASK1234567',
      enchufeDisponible: 'SI'
    }, {
      email: 'ana@diagroup.com', nombre: 'Ana Gómez', delegacion: 'Madrid'
    }, 'SOL-20260915-0001');

    expect(body).toBe('Proveedor A|Alta|SOL-20260915-0001|ana@diagroup.com|Ana Gómez|0001 - Centro|0002 - Norte|2099-02-03|TASK1234567|SI');
  });

  test('rechaza una variable de mensaje_email no admitida', function () {
    expect(function () {
      buildConfirmationEmailBody_(Object.assign({}, element, { mensaje_email: 'Hola {{destinatario}}' }), {});
    }).toThrow(/variable no admitida/i);
  });


  test('muestra comentarios entre comillas y en cursiva en el HTML', function () {
    const html = buildConfirmationEmailHtml_(Object.assign({}, element, {
      mensaje_email: 'Comentarios: {{comentarios}}'
    }), { comentarios: 'Línea uno\nLínea dos' }, { email: 'ana@diagroup.com' }, 'SOL-1');

    expect(html).toContain('Comentarios: &ldquo;<em>Línea uno<br>Línea dos</em>&rdquo;');
  });
  test('sendConfirmationEmail_ usa el CC por defecto si Sistema no define EMAIL_CC_SOPORTE y el elemento no tiene email_destino', function () {
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      element,
      { tienda: '0001' }
    );

    const sent = global.MailApp.sentEmails[0];
    expect(sent.to).toBe('ana@diagroup.com');
    expect(sent.cc).toBe('dia.es.soporte.layouts@diagroup.com');
    expect(sent.name).toBe('Dia Layouts');
    expect(sent.htmlBody).toContain('SOLICITUD REGISTRADA');
    expect(sent.htmlBody).toContain('Hola Ana,');
    expect(sent.htmlBody).toContain('Tu solicitud ha sido registrada correctamente.');
    expect(sent.htmlBody).toContain('<img src="' + BRAND_ASSETS.LOGO_URL + '"');
    expect(sent.htmlBody).toContain('width="56" height="31" alt="DIA"');
    expect(sent.htmlBody).not.toMatch(/<button\b|Abrir la aplicación|<a\b/i);
  });

  test('adjunta la foto de Error en pantalla directamente al correo', function () {
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      Object.assign({}, element, { tipo_gestion: 'ERROR_PANTALLA', etiqueta: 'Error en pantalla' }),
      {
        tienda: '0001',
        _photoAttachment: {
          bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00],
          mimeType: 'image/png'
        }
      }
    );

    const sent = global.MailApp.sentEmails[0];
    expect(sent.attachments).toHaveLength(1);
    expect(sent.attachments[0].getContentType()).toBe('image/png');
    expect(sent.attachments[0].getName()).toBe('foto-SOL-20260910-0001.png');
    expect(sent.body).toBe(element.mensaje_email);
  });

  test('incluye las dos disponibilidades y los dos adjuntos de Nueva solicitud de Cafetera', function () {
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      Object.assign({}, element, { tipo_gestion: 'NUEVA_SOLICITUD', etiqueta: 'Nueva solicitud para tienda abierta' }),
      {
        tienda: '0001', enchufeDisponible: 'SI', tomaAguaDisponible: 'NO',
        _photoAttachments: [
          { fieldName: 'fotoUbicacion', bytes: [0xff, 0xd8, 0xff, 0x00], mimeType: 'image/jpeg' },
          { fieldName: 'fotoLayout', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: 'image/png' }
        ]
      }
    );

    const sent = global.MailApp.sentEmails[0];
    expect(sent.attachments.map(function (attachment) { return attachment.getName(); }))
      .toEqual(['foto-ubicacion-SOL-20260910-0001.jpg', 'foto-layout-SOL-20260910-0001.png']);
    expect(sent.body).toBe(element.mensaje_email);
  });

  test('incluye enchufe y las cuatro fotos adjuntas de Nueva solicitud de Locker', function () {
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      Object.assign({}, element, { equipo: 'LOCKER', tipo_gestion: 'NUEVA_SOLICITUD', etiqueta: 'Nueva solicitud para tienda abierta' }),
      {
        tienda: '0001', enchufeDisponible: 'NO',
        _photoAttachments: [
          { fieldName: 'fotoHorario', bytes: [0xff, 0xd8, 0xff, 0x00], mimeType: 'image/jpeg' },
          { fieldName: 'fotoCobertura', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: 'image/png' },
          { fieldName: 'fotoUbicacion', bytes: [0xff, 0xd8, 0xff, 0x00], mimeType: 'image/jpeg' },
          { fieldName: 'fotoLayout', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: 'image/png' }
        ]
      }
    );

    const sent = global.MailApp.sentEmails[0];
    expect(sent.attachments.map(function (attachment) { return attachment.getName(); }))
      .toEqual([
        'foto-horario-SOL-20260910-0001.jpg',
        'foto-cobertura-SOL-20260910-0001.png',
        'foto-ubicacion-SOL-20260910-0001.jpg',
        'foto-layout-SOL-20260910-0001.png'
      ]);
    expect(sent.body).toBe(element.mensaje_email);
  });

  test('usa el nombre de remitente configurado en Sistema', function () {
    resetMockSheets({
      Sistema: [
        ['clave', 'valor'],
        ['NOMBRE_REMITENTE_EMAIL', 'Equipo Layouts']
      ]
    });

    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      element,
      { tienda: '0001' }
    );

    expect(global.MailApp.sentEmails[0].name).toBe('Equipo Layouts');
  });

  test('usa mensaje_email e ignora las filas heredadas de Sistema', function () {
    resetMockSheets({
      Sistema: [
        ['clave', 'valor'],
        ['SALUDO_CONFIRMACION_EMAIL', 'Texto heredado'],
        ['TEXTO_CONFIRMACION_EMAIL', 'Texto heredado'],
        ['PIE_CONFIRMACION_EMAIL', 'Texto heredado']
      ]
    });
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001', element, { tienda: '0001' }
    );
    const body = global.MailApp.sentEmails[0].body;
    expect(body).toBe(element.mensaje_email);
    expect(body).not.toContain('Texto heredado');
  });

  test('el HTML escapa mensaje_email y conserva sus saltos de línea', function () {
    const html = buildConfirmationEmailHtml_(Object.assign({}, element, {
      mensaje_email: 'Hola <Prueba>\nSegunda línea'
    }));

    expect(html).toContain('Hola &lt;Prueba&gt;<br>Segunda línea');
    expect(html).not.toContain('Hola <Prueba>');
    expect(html).not.toContain('Abrir la aplicación');
  });

  test('rechaza un elemento sin mensaje_email', function () {
    expect(function () { getElementEmailMessage_({}); }).toThrow(/mensaje_email/i);
  });

  test('usa el asunto configurable y los datos de tienda verificados en servidor', function () {
    resetMockSheets({
      Sistema: [
        ['clave', 'valor'],
        ['ASUNTO_EMAL', '[Gestión equipos]-{{equipo}}-{{tipo_gestion}}- {{tienda}}-{{provincia}}-{{municipio}}-{{direccion}}']
      ]
    });

    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      element,
      {
        tienda: '0001 - AV JUAN XXIII 10, Pozuelo de Alarcón',
        _storeDetails: {
          tienda: {
            tienda_id: '0001', provincia: 'MADRID', municipio: 'Pozuelo de Alarcón',
            direccion: 'AV JUAN XXIII 10'
          }
        }
      }
    );

    expect(global.MailApp.sentEmails[0].subject).toBe(
      '[Gestión equipos]-CAFETERA-RETIRADA- 0001-MADRID-Pozuelo de Alarcón-AV JUAN XXIII 10'
    );
  });

  test('rechaza marcadores de asunto no soportados', function () {
    expect(function () {
      buildConfirmationSubject_('{{secreto}}', element, {});
    }).toThrow(/no admitido/);
  });

  test('admite id_elemento en el asunto configurado de Sistema', function () {
    resetMockSheets({
      Sistema: [['clave', 'valor'], ['ASUNTO_EMAL', 'Gestión {{id_elemento}} - {{equipo}}']]
    });

    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001', element, { tienda: '0001' }
    );

    expect(global.MailApp.sentEmails[0].subject).toBe('Gestión CAF-RETIRADA - CAFETERA');
  });

  test('prefiere ASUNTO_EMAIL y conserva ASUNTO_EMAL como clave heredada', function () {
    resetMockSheets({
      Sistema: [['clave', 'valor'], ['ASUNTO_EMAL', 'Asunto antiguo'], ['ASUNTO_EMAIL', 'Asunto correcto']]
    });
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001', element, { tienda: '0001' }
    );
    expect(global.MailApp.sentEmails[0].subject).toBe('Asunto correcto');
  });

  test('sendConfirmationEmail_ usa email_destino como destinatario y copia soporte y solicitante', function () {
    resetMockSheets({ Sistema: [['parametro', 'valor'], ['EMAIL_CC_SOPORTE', 'soporte@diagroup.com']] });

    const elementConDestino = Object.assign({}, element, { email_destino: 'cafeteras@diagroup.com' });

    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' },
      'SOL-20260910-0001',
      elementConDestino,
      { tienda: '0001' }
    );

    expect(global.MailApp.sentEmails[0].to).toBe('cafeteras@diagroup.com');
    expect(global.MailApp.sentEmails[0].cc).toBe('soporte@diagroup.com,ana@diagroup.com');
  });

  test('admite varias direcciones de soporte separadas por comas y elimina duplicados', function () {
    resetMockSheets({
      Sistema: [['clave', 'valor'], ['EMAIL_CC_SOPORTE',
        'soporte@diagroup.com, Cafeteras@diagroup.com, SOPORTE@diagroup.com']]
    });

    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' }, 'SOL-20260910-0001',
      Object.assign({}, element, { email_destino: 'cafeteras@diagroup.com' }), { tienda: '0001' }
    );

    expect(global.MailApp.sentEmails[0].to).toBe('cafeteras@diagroup.com');
    expect(global.MailApp.sentEmails[0].cc).toBe('soporte@diagroup.com,ana@diagroup.com');
  });

  test('rechaza una lista de soporte con separadores o direcciones vacías no admitidos', function () {
    ['uno@diagroup.com;', 'uno@diagroup.com,,dos@diagroup.com', 'uno@diagroup.com\r\nBcc:otro@ejemplo.com']
      .forEach(function (value) {
        expect(function () { normalizeSupportCcEmails_(value); }).toThrow(/EMAIL_CC_SOPORTE/);
      });
  });

  test('rechaza una celda de CC con varios destinatarios o saltos de línea', function () {
    ['uno@diagroup.com,dos@diagroup.com', 'uno@diagroup.com\r\nBcc:otro@ejemplo.com'].forEach(function (value) {
      expect(function () { normalizeSingleEmail_(value); }).toThrow(/dirección válida/);
    });
  });

  test('no envía dos veces la misma dirección en CC', function () {
    resetMockSheets({
      Sistema: [['clave', 'valor'], ['EMAIL_CC_SOPORTE', 'soporte@diagroup.com']]
    });
    sendConfirmationEmail_(
      { email: 'ana@diagroup.com', nombre: 'Ana' }, 'SOL-20260910-0001',
      Object.assign({}, element, { email_destino: 'SOPORTE@diagroup.com' }),
      { tienda: '0001' }
    );
    expect(global.MailApp.sentEmails[0].to).toBe('SOPORTE@diagroup.com');
    expect(global.MailApp.sentEmails[0].cc).toBe('ana@diagroup.com');
  });
});

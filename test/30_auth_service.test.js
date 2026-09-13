describe('30_auth_service', function () {
  beforeEach(function () {
    resetMockSheets({
      Usuarios: [
        ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
        ['ana@diagroup.com', 'Ana Gómez', 'ACTIVO', 'GESTOR_DELEGACION', 'DELEGACION', 'Madrid'],
        ['ines@diagroup.com', 'Inés Ruiz', 'INACTIVO', 'GESTOR_DELEGACION', 'DELEGACION', 'Madrid'],
        ['lucas@diagroup.com', 'Lucas', 'ACTIVO', 'CONSULTA', '', 'Madrid']
      ],
      Tiendas: [
        STORE_COLUMNS,
        ['ES000000001', '0001', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39,
          'Illescas Flujo', 'AV JUAN XXIII 10', 'Pozuelo de Alarcón', 'MADRID', 'Abierta']
      ],
      Elementos: [
        ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta', 'estado', 'requiere_service_now', 'solo_tiendas_abiertas', 'email_destino', 'orden'],
        ['CAF-RETIRADA', 'CAFETERA', '', 'RETIRADA', '', 'Retirada de cafetera sin destino', 'ACTIVE', 'NO', 'NO', '', 10],
        ['CAF-MOV', 'CAFETERA', '', 'MOVIMIENTO', '', 'Movimiento entre tiendas', 'INACTIVE', 'NO', 'NO', '', 20]
      ],
      Sistema: [
        ['parametro', 'valor'],
        ['EMAIL_ADMIN', 'admin@diagroup.com']
      ]
    });
  });

  test('findUserByEmail_ compara el email sin distinguir mayúsculas/minúsculas', function () {
    const user = findUserByEmail_('ANA@diagroup.com');
    expect(user.nombre).toBe('Ana Gómez');
    expect(global.CacheService._dump()).toHaveProperty(CACHE_KEYS.USERS);
  });

  test('una identidad sin email no puede coincidir con una fila de usuario vacía', function () {
    resetMockSheets({
      Usuarios: [
        ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
        ['', 'Sin correo', 'ACTIVO', 'ADMINISTRADOR', '', '']
      ],
      Sistema: [['clave', 'valor']]
    });
    expect(findUserByEmail_('')).toBeUndefined();
  });

  test('checkAccess lee Sistema una sola vez aun con caché desactivada', function () {
    const sheet = getSheet_(SHEET_NAMES.SISTEMA);
    sheet._getRawValues().push(['CACHE_HABILITADA', false]);
    const originalGetDataRange = sheet.getDataRange;
    let reads = 0;
    sheet.getDataRange = function () { reads++; return originalGetDataRange(); };
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    expect(checkAccess().authorized).toBe(true);
    expect(reads).toBe(1);
  });

  test('checkAccess devuelve authorized=false y el email de administración si el usuario no está activo', function () {
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ines@diagroup.com'; } };
    };

    const result = checkAccess();

    expect(result.authorized).toBe(false);
    expect(result.adminEmail).toBe('admin@diagroup.com');
  });

  test('la solicitud de acceso usa asunto y cuerpo configurados en Sistema', function () {
    const sheet = getSheet_(SHEET_NAMES.SISTEMA);
    sheet.appendRow(['ASUNTO_SOLICITUD_ACCESO', 'Acceso a Layouts']);
    sheet.appendRow(['CUERPO_SOLICITUD_ACCESO', 'Alta para {{email}}']);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ines@diagroup.com'; } };
    };
    const result = checkAccess();
    expect(result.accessRequestSubject).toBe('Acceso a Layouts');
    expect(result.accessRequestBody).toBe('Alta para ines@diagroup.com');
  });

  test('checkAccess devuelve authorized=true y solo los elementos ACTIVE, sin exponer Tiendas', function () {
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    const result = checkAccess();

    expect(result.authorized).toBe(true);
    expect(result.user.nombre).toBe('Ana Gómez');
    expect(result.stores).toBeUndefined();
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].id_elemento).toBe('CAF-RETIRADA');
    expect(result.uiText.commentsHint).toBe(UI_TEXT_DEFAULTS.COMMENTS_HINT);
    expect(result.uiText.submissionTransportFailure).toBe(UI_TEXT_DEFAULTS.SUBMISSION_TRANSPORT_FAILURE);
  });

  test('los textos de interfaz se entregan desde Sistema al usuario autorizado', function () {
    getSheet_(SHEET_NAMES.SISTEMA).appendRow(['AVISO_COMENTARIOS', 'Texto revisado por negocio.']);
    getSheet_(SHEET_NAMES.SISTEMA).appendRow([
      'MENSAJE_ERROR_TRANSPORTE_REGISTRO', 'Comprueba el correo antes de repetir.'
    ]);
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const uiText = checkAccess().uiText;
    expect(uiText.commentsHint).toBe('Texto revisado por negocio.');
    expect(uiText.submissionTransportFailure).toBe('Comprueba el correo antes de repetir.');
  });

  test('checkAccess rechaza un rol que no pertenece a la lista cerrada', function () {
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'lucas@diagroup.com'; } };
    };

    expect(checkAccess().authorized).toBe(false);
  });
});

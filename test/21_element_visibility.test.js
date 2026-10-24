describe('Visibilidad de gestiones por rol', function () {
  const roles = Object.values(ROLES);
  function session(role) {
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return role.toLowerCase() + '@example.com'; } };
    };
  }
  beforeEach(function () {
    resetMockSheets({
      Sistema: [['clave', 'valor'], ['CACHE_HABILITADA', true], ['CACHE_TTL_CORTO_SEGUNDOS', 5]],
      Usuarios: [['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion']].concat(
        roles.map(function (role) { return [role.toLowerCase() + '@example.com', 'Prueba', 'ACTIVO', role, 'DELEGACION', 'Madrid']; })
      ),
      Elementos: [['id_elemento', 'equipo', 'tipo_gestion', 'estado', 'rol_visible', 'mensaje_email', 'orden']].concat(
        ['TODOS'].concat(roles).map(function (role, index) {
          return [role, 'CAFETERA', 'MOVIMIENTO', 'ACTIVE', role, 'Movimiento solicitado.', index];
        })
      ),
      Tiendas: [STORE_COLUMNS,
        ['ES000000001', '0001', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39, 'Flujo', 'Calle Uno', 'Madrid', 'MADRID', 'Abierta'],
        ['ES000000002', '0002', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39, 'Flujo', 'Calle Dos', 'Madrid', 'MADRID', 'Abierta']],
      Registros: [REGISTRO_COLUMNS.slice()],
      Logs: [['fecha', 'nivel', 'evento', 'email', 'id_solicitud', 'contexto']]
    });
    session(ROLES.GESTOR_DELEGACION);
  });

  test.each(roles)('el menú de %s solo entrega TODOS y su rol, usando la misma caché', function (role) {
    session(ROLES.ADMINISTRADOR);
    checkAccess();
    session(role);
    const result = checkAccess();
    expect(result.authorized).toBe(true);
    expect(result.elements.map(function (element) { return element.id_elemento; })).toEqual(['TODOS', role]);
    expect(result.elements.every(function (element) { return element.rol_visible === undefined; })).toBe(true);
    expect(lookupStore('0001', role).success).toBe(true);
  });

  test('columna ausente o vacía conserva el acceso para todos los roles autorizados', function () {
    const rows = getSheet_(SHEET_NAMES.ELEMENTOS)._getRawValues();
    rows[1][4] = '';
    expect(getElementById_('TODOS').rol_visible).toBe('TODOS');
    rows[0].splice(4, 1);
    rows.slice(1).forEach(function (row) { row.splice(4, 1); });
    removeCachedJson_(CACHE_KEYS.ELEMENTS);
    expect(checkAccess().elements).toHaveLength(4);
  });

  test('normaliza mayúsculas y espacios, y rechaza roles desconocidos o listas', function () {
    expect(normalizeElementRole_(' gestor_global ')).toBe(ROLES.GESTOR_GLOBAL);
    expect(normalizeElementRole_('  ')).toBe('TODOS');
    ['CONSULTA', 'ADMINISTRADOR,GESTOR_GLOBAL', '*', 123].forEach(function (role) {
      expect(function () { normalizeElementRole_(role, 2); }).toThrow(/fila 2.*rol_visible/);
    });
    getSheet_(SHEET_NAMES.ELEMENTOS)._getRawValues()[1][4] = 'GESTOR_GLOABL';
    expect(checkAccess()).toMatchObject({ authorized: false, configurationError: true });
  });

  test('TODOS no concede acceso a usuarios inactivos ni a roles desconocidos', function () {
    const element = getElementById_('TODOS');
    expect(canUseElement_(element, { estado: 'INACTIVO', rol: ROLES.ADMINISTRADOR })).toBe(false);
    expect(canUseElement_(element, { estado: 'ACTIVO', rol: 'CONSULTA' })).toBe(false);
    expect(canUseElement_(element, undefined)).toBe(false);
    expect(canUseElement_(Object.assign({}, element, { estado: 'INACTIVE' }),
      { estado: 'ACTIVO', rol: ROLES.ADMINISTRADOR })).toBe(false);
  });

  test('una gestión de otro rol no permite ni consultar tiendas', function () {
    const stores = getSheet_(SHEET_NAMES.TIENDAS);
    const read = jest.spyOn(stores, 'getDataRange');
    expect(lookupStore('0001', ROLES.ADMINISTRADOR)).toMatchObject({ success: false, message: expect.stringMatching(/rol/) });
    expect(read).not.toHaveBeenCalled();
  });

  test('un ID oculto o rol falsificado no consume ID, guarda registros, envía correo ni devuelve formulario', function () {
    const result = submitRequest({ idElemento: ROLES.ADMINISTRADOR, rol: ROLES.ADMINISTRADOR,
      formRevision: 'manipulada', tiendaOrigen: '0001', tiendaDestino: '0002', comentarios: 'Movimiento.' });
    expect(result).toMatchObject({ success: false, idPeticion: null, message: expect.stringMatching(/rol/) });
    expect(result.updatedElement).toBeNull();
    expect(getSheet_(SHEET_NAMES.REGISTROS)._getRawValues()).toHaveLength(1);
    expect(MailApp.sentEmails).toHaveLength(0);
    expect(PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_KEYS.REQUEST_COUNTER)).toBeNull();
    expect(JSON.stringify(getSheet_(SHEET_NAMES.LOGS)._getRawValues())).toContain('GESTION_NO_PERMITIDA');
  });

  test('retirar el permiso con un formulario abierto bloquea consulta y envío al renovarse el catálogo', function () {
    expect(checkAccess().elements[0].id_elemento).toBe('TODOS');
    getSheet_(SHEET_NAMES.ELEMENTOS)._getRawValues()[1][4] = ROLES.ADMINISTRADOR;
    removeCachedJson_(CACHE_KEYS.ELEMENTS);
    expect(lookupStore('0001', 'TODOS').success).toBe(false);
    expect(submitRequest({ idElemento: 'TODOS' }).success).toBe(false);
    expect(checkAccess().elements.map(function (element) { return element.id_elemento; })).toEqual([ROLES.GESTOR_DELEGACION]);
    expect(getSheet_(SHEET_NAMES.REGISTROS)._getRawValues()).toHaveLength(1);
  });

  test('un movimiento permitido completa el alta', function () {
    const result = submitRequest({ idElemento: ROLES.GESTOR_DELEGACION,
      tiendaOrigen: '0001', tiendaDestino: '0002', comentarios: 'Traslado solicitado.' });
    expect(result.success).toBe(true);
    expect(getSheet_(SHEET_NAMES.REGISTROS)._getRawValues()).toHaveLength(2);
    expect(MailApp.sentEmails).toHaveLength(1);
  });
});

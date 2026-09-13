describe('22_store_service', function () {
  beforeEach(function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['CACHE_HABILITADA', true],
        ['CACHE_TTL_CORTO_SEGUNDOS', 5],
        ['CACHE_TTL_LARGO_SEGUNDOS', 100]
      ],
      Tiendas: [
        STORE_COLUMNS,
        ['ES000000001', '0001', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39,
          'Illescas Flujo', 'AV JUAN XXIII 10', 'Pozuelo de Alarcón', 'MADRID', 'Abierta'],
        ['ES000000002', '0002', 'Barcelona', 'SMD_6', 350, 'CATALUÑA', 600,
          'Sabadell', 'CALLE NORTE 2', 'Barcelona', 'BARCELONA', 'Cerrada']
      ]
    });
  });

  test('GESTOR_DELEGACION solo ve las tiendas de su propia delegación', function () {
    const stores = getStoresForUser_({
      rol: 'GESTOR_DELEGACION',
      ambito: 'DELEGACION',
      delegacion: 'Madrid'
    });

    expect(stores).toHaveLength(1);
    expect(stores[0].tienda_id).toBe('0001');
    expect(global.CacheService._dump()).toHaveProperty(CACHE_KEYS.STORES);
  });

  test('GESTOR_DELEGACION sin ambito DELEGACION no recibe tiendas', function () {
    const sheet = getSheet_(SHEET_NAMES.TIENDAS);
    const originalGetDataRange = sheet.getDataRange;
    let reads = 0;
    sheet.getDataRange = function () { reads++; return originalGetDataRange(); };
    const stores = getStoresForUser_({
      rol: 'GESTOR_DELEGACION',
      ambito: 'GLOBAL',
      delegacion: 'Madrid'
    });
    expect(stores).toEqual([]);
    expect(reads).toBe(0);
  });

  test('lookupStore no revela errores internos de la hoja', function () {
    resetMockSheets({
      Sistema: [['clave', 'valor']],
      Usuarios: [
        ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
        ['ana@diagroup.com', 'Ana', 'ACTIVO', 'ADMINISTRADOR', '', '']
      ],
      Elementos: [
        ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta', 'estado', 'requiere_service_now', 'solo_tiendas_abiertas', 'email_destino', 'orden'],
        ['CAF-RETIRADA', 'CAFETERA', '', 'RETIRADA', '', 'Retirada', 'ACTIVE', 'NO', 'NO', '', 10]
      ]
    });
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };
    const result = lookupStore('0001', 'CAF-RETIRADA');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/No se pudo consultar/);
    expect(result.message).not.toContain('Tiendas');
  });

  test('GESTOR_DELEGACION sin delegación asignada no recibe tiendas', function () {
    const stores = getStoresForUser_({
      rol: 'GESTOR_DELEGACION',
      ambito: 'DELEGACION',
      delegacion: ''
    });
    expect(stores).toEqual([]);
  });

  test('GESTOR_GLOBAL ve todas las tiendas de todas las delegaciones', function () {
    const stores = getStoresForUser_({ rol: 'GESTOR_GLOBAL', ambito: 'GLOBAL', delegacion: 'Madrid' });
    expect(stores).toHaveLength(2);
  });

  test('ADMINISTRADOR ve todas las tiendas de todas las delegaciones', function () {
    const stores = getStoresForUser_({ rol: 'ADMINISTRADOR', ambito: 'GLOBAL', delegacion: 'Madrid' });
    expect(stores).toHaveLength(2);
  });

  test('lookupStore busca tienda_id exacto y aplica delegacion_desc para el usuario', function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['CACHE_HABILITADA', true],
        ['CACHE_TTL_CORTO_SEGUNDOS', 5],
        ['CACHE_TTL_LARGO_SEGUNDOS', 100]
      ],
      Usuarios: [
        ['email', 'nombre', 'estado', 'rol', 'ambito', 'delegacion'],
        ['ana@diagroup.com', 'Ana Gómez', 'ACTIVO', 'GESTOR_DELEGACION', 'DELEGACION', 'Madrid']
      ],
      Elementos: [
        ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta', 'estado', 'requiere_service_now', 'solo_tiendas_abiertas', 'email_destino', 'orden'],
        ['CAF-RETIRADA', 'CAFETERA', '', 'RETIRADA', '', 'Retirada', 'ACTIVE', 'NO', 'NO', '', 10]
      ],
      Tiendas: [
        STORE_COLUMNS,
        ['ES000000001', '0001', 'Madrid', 'SMD_6', 350, 'MADRID', 898.39,
          'Illescas Flujo', 'AV JUAN XXIII 10', 'Pozuelo de Alarcón', 'MADRID', 'Abierta'],
        ['ES000000002', '0002', 'Barcelona', 'SMD_6', 350, 'CATALUÑA', 600,
          'Sabadell', 'CALLE NORTE 2', 'Barcelona', 'BARCELONA', 'Abierta']
      ]
    });
    global.Session.getActiveUser = function () {
      return { getEmail: function () { return 'ana@diagroup.com'; } };
    };

    expect(lookupStore('0001', 'CAF-RETIRADA')).toMatchObject({
      success: true,
      store: {
        apnut: 'ES000000001',
        tienda_id: '0001',
        planograma_desc: 'SMD_6',
        agr_comercial_desc: 'MADRID',
        almacen_desc: 'Illescas Flujo'
      }
    });
    expect(lookupStore('0002', 'CAF-RETIRADA')).toMatchObject({ success: false });
    expect(lookupStore('123456', 'CAF-RETIRADA').message).toMatch(/1 y 5 dígitos/);
  });
});

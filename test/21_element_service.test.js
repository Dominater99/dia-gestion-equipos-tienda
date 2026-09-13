describe('21_element_service', function () {
  beforeEach(function () {
    resetMockSheets({
      Sistema: [
        ['parametro', 'valor'],
        ['CACHE_HABILITADA', true],
        ['CACHE_TTL_CORTO_SEGUNDOS', 5]
      ],
      Elementos: [
        ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta', 'estado', 'requiere_service_now', 'solo_tiendas_abiertas', 'email_destino', 'orden'],
        ['CAF-NUEVA', 'CAFETERA', '', 'NUEVA_SOLICITUD', '', 'Nueva solicitud para tienda abierta', 'ACTIVE', 'NO', 'SI', '', 10],
        ['CAF-MOV', 'CAFETERA', '', 'MOVIMIENTO', '', 'Movimiento entre tiendas', 'INACTIVE', 'NO', 'NO', '', 20],
        ['NEV-REDBULL-NUEVA', 'NEVERA', 'RedBull', 'NUEVA_SOLICITUD', '', 'Nueva solicitud para tienda abierta', 'ACTIVE', 'NO', 'SI', 'redbull@diagroup.com', 5]
      ]
    });
  });

  test('getActiveElements_ devuelve solo los ACTIVE, ordenados por la columna orden', function () {
    const elements = getActiveElements_();

    expect(elements).toHaveLength(2);
    expect(elements[0].id_elemento).toBe('NEV-REDBULL-NUEVA');
    expect(elements[1].id_elemento).toBe('CAF-NUEVA');
    expect(global.CacheService._dump()).toHaveProperty(CACHE_KEYS.ELEMENTS);
  });

  test('getElementById_ encuentra un elemento aunque esté INACTIVE', function () {
    const element = getElementById_('CAF-MOV');
    expect(element).toBeDefined();
    expect(element.estado).toBe('INACTIVE');
  });

  test('getElementById_ devuelve undefined si el id no existe', function () {
    expect(getElementById_('NO-EXISTE')).toBeUndefined();
  });
});

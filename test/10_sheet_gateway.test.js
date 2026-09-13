describe('10_sheet_gateway', function () {
  test('normalizeHeader_ pasa a minúsculas y sustituye espacios por guiones bajos', function () {
    expect(normalizeHeader_('Nombre Tienda')).toBe('nombre_tienda');
  });

  test('readSheetAsObjects_ convierte filas en objetos y descarta filas vacías', function () {
    const sheet = createMockSheet([
      ['codigo_tienda', 'nombre_tienda', 'delegacion', 'estado_tienda'],
      ['0001', 'Dia Centro', 'Madrid', 'ABIERTA'],
      ['', '', '', '']
    ]);

    const rows = readSheetAsObjects_(sheet);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      codigo_tienda: '0001',
      nombre_tienda: 'Dia Centro',
      delegacion: 'Madrid',
      estado_tienda: 'ABIERTA'
    });
  });

  test('readSheetAsObjects_ devuelve un array vacío si solo hay cabecera', function () {
    const sheet = createMockSheet([['codigo_tienda', 'nombre_tienda']]);
    expect(readSheetAsObjects_(sheet)).toEqual([]);
  });

  test('appendRowFromObject_ respeta el orden de las cabeceras existentes e ignora claves sobrantes', function () {
    const sheet = createMockSheet([['codigo_tienda', 'nombre_tienda', 'delegacion', 'estado_tienda']]);

    appendRowFromObject_(sheet, {
      nombre_tienda: 'Dia Centro',
      codigo_tienda: '0001',
      delegacion: 'Madrid',
      estado_tienda: 'ABIERTA',
      campo_que_no_existe: 'se ignora'
    });

    expect(sheet._getRawValues()[1]).toEqual(['0001', 'Dia Centro', 'Madrid', 'ABIERTA']);
  });

  test('getSheet_ lanza un error legible si la pestaña no existe', function () {
    resetMockSheets({});
    expect(function () { getSheet_('NoExiste'); }).toThrow(/No se encuentra la pestaña/);
  });

  test('appendRowFromObject_ neutraliza texto que Sheets interpretaría como fórmula', function () {
    const sheet = createMockSheet([['comentarios']]);

    appendRowFromObject_(sheet, { comentarios: '=IMPORTXML("https://example.com")' });

    expect(sheet._getRawValues()[1][0]).toBe("'=IMPORTXML(\"https://example.com\")");
  });

  test('appendRowFromObject_ reutiliza cabeceras conocidas sin volver a leer la hoja', function () {
    const sheet = createMockSheet([['codigo_tienda', 'nombre_tienda']]);
    sheet.getRange = function () { throw new Error('No debe leer la cabecera'); };
    appendRowFromObject_(sheet, { codigo_tienda: '0001', nombre_tienda: 'Centro' }, [
      'codigo_tienda', 'nombre_tienda'
    ]);
    expect(sheet._getRawValues()[1]).toEqual(['0001', 'Centro']);
  });

  test('lee, escribe y elimina los fragmentos de caché mediante operaciones por lotes', function () {
    const cache = CacheService.getScriptCache();
    const originalGetScriptCache = CacheService.getScriptCache;
    CacheService.getScriptCache = function () { return cache; };
    const getAll = jest.spyOn(cache, 'getAll');
    const putAll = jest.spyOn(cache, 'putAll');
    const removeAll = jest.spyOn(cache, 'removeAll');
    const value = { texto: 'x'.repeat(CACHE_JSON_CHUNK_CHARACTERS + 10) };

    try {
      putCachedJson_('prueba', value, 30);
      expect(putAll).toHaveBeenCalledTimes(1);
      expect(getCachedJson_('prueba')).toEqual(value);
      expect(getAll).toHaveBeenCalledTimes(1);
      removeCachedJson_('prueba');
      expect(removeAll).toHaveBeenCalledTimes(1);
    } finally {
      CacheService.getScriptCache = originalGetScriptCache;
    }
  });
});

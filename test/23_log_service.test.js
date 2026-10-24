describe('23_log_service - auditoría mínima', function () {
  test('conserva compatibilidad con Logs antiguo sin cambiar su cabecera ni sus filas', function () {
    const sheets = resetMockSheets({ Logs: [LEGACY_HEADERS_LOGS] });
    expect(logAppEventSafely_(LOG_EVENTS.REQUEST_REJECTED, '',
      { etapa: 'VALIDACION', motivo: 'FECHA_NO_FUTURA' }, 'ana@example.com')).toBe(true);
    expect(sheets.Logs._getRawValues()[0]).toEqual(LEGACY_HEADERS_LOGS);
    expect(sheets.Logs._getRawValues()[1][5]).toBe('Solicitud rechazada.');
    expect(JSON.parse(sheets.Logs._getRawValues()[1][6]).motivo).toBe('FECHA_NO_FUTURA');
  });
  test('crea Logs una sola vez y registra contexto JSON en seis columnas', function () {
    const sheets = resetMockSheets({});

    expect(logAppEventSafely_(
      LOG_EVENTS.REQUEST_REGISTERED,
      'SOL-20260912-0002',
      { etapa: 'NOTIFICACION', idElemento: 'CAF-RETIRADA', notificacionEnviada: true },
      'Ana@diagroup.com'
    )).toBe(true);
    expect(sheets.Logs._getRawValues()[0]).toEqual(HEADERS_LOGS);
    expect(sheets.Logs._getRawValues()[1].slice(1, 5)).toEqual([
      'INFO', 'SOLICITUD_REGISTRADA', 'ana@diagroup.com', 'SOL-20260912-0002'
    ]);
    expect(JSON.parse(sheets.Logs._getRawValues()[1][5])).toEqual({
      etapa: 'NOTIFICACION', idElemento: 'CAF-RETIRADA', notificacionEnviada: true
    });
    expect(sheets.Logs._getRawValues()[1]).toHaveLength(6);

    expect(logAppEventSafely_(
      LOG_EVENTS.REQUEST_REJECTED, '', { etapa: 'VALIDACION' }, 'ana@diagroup.com'
    )).toBe(true);
    expect(sheets.Logs._getRawValues()).toHaveLength(3);
    expect(sheets.Logs._getRawValues()[2][4]).toBe('');
    expect(JSON.parse(sheets.Logs._getRawValues()[2][5])).toEqual({ etapa: 'VALIDACION' });
  });

  test('limita el contexto a un objeto JSON pequeño', function () {
    expect(serializeLogContext_({ etapa: 'VALIDACION' })).toBe('{"etapa":"VALIDACION"}');
    expect(function () { serializeLogContext_('VALIDACION'); }).toThrow(/objeto/);
    expect(function () {
      serializeLogContext_({ detalle: 'x'.repeat(LOG_CONTEXT_MAX_LENGTH) });
    }).toThrow(/tamaño/);
  });

  test('no altera una cabecera existente inválida ni propaga el fallo', function () {
    const sheets = resetMockSheets({ Logs: [['fecha', 'mensaje']] });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      expect(logAppEventSafely_(
        LOG_EVENTS.REQUEST_REGISTERED, 'SOL-1', { etapa: 'REGISTROS' }
      )).toBe(false);
      expect(sheets.Logs._getRawValues()).toEqual([['fecha', 'mensaje']]);
      expect(consoleError).toHaveBeenCalledWith('No se pudo escribir el evento en Logs.');
    } finally {
      consoleError.mockRestore();
    }
  });

  test('un fallo de escritura en Logs no expone el error interno', function () {
    const sheets = resetMockSheets({ Logs: [HEADERS_LOGS] });
    sheets.Logs.appendRow = function () { throw new Error('secreto interno'); };
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      expect(logAppEventSafely_(
        LOG_EVENTS.MAIL_FAILED, 'SOL-1', { etapa: 'NOTIFICACION' }
      )).toBe(false);
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('secreto interno');
    } finally {
      consoleError.mockRestore();
    }
  });
});

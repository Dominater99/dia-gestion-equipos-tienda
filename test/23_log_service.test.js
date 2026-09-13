describe('23_log_service - auditoría mínima', function () {
  test('crea Logs una sola vez y registra las siete columnas en orden', function () {
    const sheets = resetMockSheets({});

    expect(logAppEventSafely_(LOG_EVENTS.REQUEST_REGISTERED, 'SOL-20260912-0002', 'NOTIFICACION', 'Ana@diagroup.com'))
      .toBe(true);
    expect(sheets.Logs._getRawValues()[0]).toEqual(HEADERS_LOGS);
    expect(sheets.Logs._getRawValues()[1].slice(1)).toEqual([
      'INFO', 'SOLICITUD_REGISTRADA', 'ana@diagroup.com', 'SOL-20260912-0002',
      'Solicitud registrada correctamente.', 'NOTIFICACION'
    ]);
    expect(sheets.Logs._getRawValues()[1]).toHaveLength(7);

    expect(logAppEventSafely_(LOG_EVENTS.REQUEST_REJECTED, '', 'VALIDACION', 'ana@diagroup.com')).toBe(true);
    expect(sheets.Logs._getRawValues()).toHaveLength(3);
    expect(sheets.Logs._getRawValues()[2][4]).toBe('');
    expect(sheets.Logs._getRawValues()[2][5]).toBe('Solicitud rechazada.');
  });

  test('no altera una cabecera existente inválida ni propaga el fallo', function () {
    const sheets = resetMockSheets({ Logs: [['fecha', 'mensaje']] });
    const consoleError = jest.spyOn(console, 'error').mockImplementation(function () {});
    try {
      expect(logAppEventSafely_(LOG_EVENTS.REQUEST_REGISTERED, 'SOL-1', 'REGISTROS')).toBe(false);
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
      expect(logAppEventSafely_(LOG_EVENTS.MAIL_FAILED, 'SOL-1', 'NOTIFICACION')).toBe(false);
      expect(consoleError.mock.calls.flat().join(' ')).not.toContain('secreto interno');
    } finally {
      consoleError.mockRestore();
    }
  });
});

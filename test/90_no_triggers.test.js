const fs = require('fs');
const path = require('path');

describe('Contrato de ejecución sin triggers', function () {
  test('las fuentes no crean triggers ni definen entradas automáticas', function () {
    const backendDir = path.join(__dirname, '..', 'src', 'backend');
    const source = fs.readdirSync(backendDir)
      .filter(function (name) { return name.endsWith('.js'); })
      .map(function (name) { return fs.readFileSync(path.join(backendDir, name), 'utf8'); })
      .join('\n');

    expect(source).not.toMatch(/\bScriptApp\s*\.\s*newTrigger\s*\(/);
    expect(source).not.toMatch(/\bfunction\s+on(?:Open|Edit|FormSubmit|Change|Install)\s*\(/);
  });

  test('el manifiesto no declara activadores', function () {
    const manifest = JSON.parse(fs.readFileSync(
      path.join(__dirname, '..', 'src', 'appsscript.json'), 'utf8'
    ));
    expect(manifest).not.toHaveProperty('triggers');
  });

  test('el backend no expone funciones manuales de preparación', function () {
    const backendDir = path.join(__dirname, '..', 'src', 'backend');
    const source = fs.readdirSync(backendDir)
      .filter(function (name) { return name.endsWith('.js'); })
      .map(function (name) { return fs.readFileSync(path.join(backendDir, name), 'utf8'); })
      .join('\n');

    expect(source).not.toMatch(/\bfunction\s+setup(?:All|Usuarios|Tiendas|RequestCounter|Registros|Logs|Elementos)\s*\(/);
  });
});

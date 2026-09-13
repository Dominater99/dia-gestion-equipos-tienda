'use strict';

const js = require('@eslint/js');

// Servicios globales de Apps Script disponibles en tiempo de ejecución real
// (nunca se importan; el runtime los inyecta en el ámbito global).
const appsScriptGlobals = {
  SpreadsheetApp: 'readonly',
  DriveApp: 'readonly',
  GmailApp: 'readonly',
  HtmlService: 'readonly',
  MailApp: 'readonly',
  LockService: 'readonly',
  PropertiesService: 'readonly',
  CacheService: 'readonly',
  Utilities: 'readonly',
  Session: 'readonly',
  ScriptApp: 'readonly',
  Logger: 'readonly',
  ContentService: 'readonly',
  UrlFetchApp: 'readonly'
};

const nodeBridgeGlobals = {
  // Cada fichero de src/backend se expone también como módulo CommonJS
  // (bloque `if (typeof module !== 'undefined')`) para poder testearlo con
  // Jest, y gas_globals.js reinyecta cada exportación como global (igual que
  // hace Apps Script al concatenar ficheros). Por eso module/global y las
  // funciones/constantes de otros ficheros del proyecto se ven como
  // "no definidas" para ESLint aunque existan en ejecución real: no-undef se
  // desactiva para src/backend y test, y la detección de errores de nombre
  // queda cubierta por la batería de Jest.
  module: 'writable',
  global: 'writable'
};

const jestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  test: 'readonly',
  expect: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  afterAll: 'readonly',
  afterEach: 'readonly',
  jest: 'readonly'
};

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  console: 'readonly',
  global: 'writable'
};

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'sheets/**'] },
  js.configs.recommended,
  {
    files: ['src/backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...appsScriptGlobals, ...nodeBridgeGlobals }
    },
    rules: {
      'no-undef': 'off'
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: { ...appsScriptGlobals, ...nodeGlobals, ...jestGlobals }
    },
    rules: {
      'no-undef': 'off'
    }
  },
  {
    files: ['jest.config.js', 'eslint.config.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: { ...nodeGlobals }
    }
  }
];

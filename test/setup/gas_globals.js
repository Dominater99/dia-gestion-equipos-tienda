/**
 * Mocks mínimos de los servicios de Apps Script (SpreadsheetApp, Session,
 * MailApp, LockService, Utilities, HtmlService) para poder testear con Jest
 * el código de src/ fuera del runtime real de Apps Script.
 *
 * Carga los ficheros numerados de src/ en orden de dependencia.
 * como funciones globales, igual que ocurre en Apps Script (donde todos los
 * archivos comparten un mismo espacio de nombres global).
 */

const path = require('path');
const crypto = require('crypto');

/**
 * Crea una hoja simulada a partir de un array de arrays (cabecera en la fila 0).
 * Soporta getDataRange/getValues, getLastColumn, getRange/getValues/setValue y appendRow,
 * que es lo único que usa el código de src/.
 * @param {Array<Array<*>>} data
 */
function createMockSheet(data) {
  const values = (data || []).map(function (row) { return row.slice(); });

  const sheet = {
    getDataRange: function () {
      return { getValues: function () { return values.map(function (r) { return r.slice(); }); } };
    },
    getLastColumn: function () {
      return values[0] ? values[0].length : 0;
    },
    getLastRow: function () {
      return values.length;
    },
    getRange: function (row, col, numRows, numCols) {
      const range = {
        getValues: function () {
          const result = [];
          for (let r = 0; r < (numRows || 1); r++) {
            const rowValues = [];
            for (let c = 0; c < (numCols || 1); c++) {
              rowValues.push((values[row - 1 + r] || [])[col - 1 + c]);
            }
            result.push(rowValues);
          }
          return result;
        },
        setValue: function (value) {
          if (!values[row - 1]) values[row - 1] = [];
          values[row - 1][col - 1] = value;
          return range;
        },
        setValues: function (newValues) {
          newValues.forEach(function (rowValues, r) {
            if (!values[row - 1 + r]) values[row - 1 + r] = [];
            rowValues.forEach(function (cellValue, c) {
              values[row - 1 + r][col - 1 + c] = cellValue;
            });
          });
          return range;
        },
        // Formato: no hace nada en el mock, solo permite encadenar llamadas
        // igual que el objeto Range real de Apps Script.
        setFontWeight: function () { return range; },
        setBackground: function () { return range; },
        setFontColor: function () { return range; }
      };
      return range;
    },
    appendRow: function (row) {
      values.push(row.slice());
    },
    deleteRow: function (rowNumber) {
      values.splice(rowNumber - 1, 1);
      return sheet;
    },
    setFrozenRows: function () {},
    autoResizeColumns: function () {},
    _getRawValues: function () { return values; }
  };

  return sheet;
}

/**
 * Sustituye SpreadsheetApp por un libro simulado con las pestañas indicadas.
 * Se llama al principio de cada test (o de cada describe) con los datos que necesite.
 * @param {Object<string, Array<Array<*>>>} sheetsByName Ej: { Usuarios: [[...cabecera], [...fila]] }
 */
function resetMockSheets(sheetsByName) {
  global.CacheService._reset();
  global.PropertiesService._reset();
  const sheets = {};
  Object.keys(sheetsByName || {}).forEach(function (name) {
    sheets[name] = createMockSheet(sheetsByName[name]);
  });

  global.SpreadsheetApp = {
    flush: function () {},
    getActiveSpreadsheet: function () {
      return {
        getSheetByName: function (name) {
          return sheets[name] || null;
        },
        insertSheet: function (name) {
          sheets[name] = createMockSheet([]);
          return sheets[name];
        }
      };
    }
  };

  return sheets;
}

global.createMockSheet = createMockSheet;
global.resetMockSheets = resetMockSheets;

global.Session = {
  getActiveUser: function () {
    return { getEmail: function () { return 'test@diagroup.com'; } };
  },
  getEffectiveUser: function () {
    return global.Session.getActiveUser();
  },
  getScriptTimeZone: function () { return 'Europe/Madrid'; }
};

global.MailApp = {
  sentEmails: [],
  sendEmail: function (options) { global.MailApp.sentEmails.push(options); }
};

global.LockService = {
  getScriptLock: function () {
    return { waitLock: function () {}, releaseLock: function () {} };
  }
};

let scriptPropertyValues = {};
global.PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (key) {
        return Object.prototype.hasOwnProperty.call(scriptPropertyValues, key)
          ? scriptPropertyValues[key]
          : null;
      },
      setProperty: function (key, value) {
        scriptPropertyValues[key] = String(value);
      },
      getKeys: function () {
        return Object.keys(scriptPropertyValues);
      },
      getProperties: function () {
        return Object.assign({}, scriptPropertyValues);
      },
      deleteProperty: function (key) {
        delete scriptPropertyValues[key];
      }
    };
  },
  _reset: function () {
    scriptPropertyValues = {};
  },
  _dump: function () {
    return Object.assign({}, scriptPropertyValues);
  }
};

let scriptCacheValues = {};
global.CacheService = {
  getScriptCache: function () {
    return {
      get: function (key) {
        return Object.prototype.hasOwnProperty.call(scriptCacheValues, key)
          ? scriptCacheValues[key]
          : null;
      },
      getAll: function (keys) {
        const result = {};
        keys.forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(scriptCacheValues, key)) {
            result[key] = scriptCacheValues[key];
          }
        });
        return result;
      },
      put: function (key, value) {
        scriptCacheValues[key] = String(value);
      },
      putAll: function (values) {
        Object.keys(values).forEach(function (key) {
          scriptCacheValues[key] = String(values[key]);
        });
      },
      remove: function (key) {
        delete scriptCacheValues[key];
      },
      removeAll: function (keys) {
        keys.forEach(function (key) { delete scriptCacheValues[key]; });
      }
    };
  },
  _reset: function () {
    scriptCacheValues = {};
  },
  _dump: function () {
    return Object.assign({}, scriptCacheValues);
  }
};

global.Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  computeDigest: function (algorithm, value) {
    if (algorithm !== 'SHA_256') throw new Error('Digest no simulado: ' + algorithm);
    return Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest());
  },
  formatDate: function (date, timeZone, format) {
    const d = date instanceof Date ? date : new Date(date);
    const values = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(d).forEach(function (part) { values[part.type] = part.value; });
    if (format === 'yyyyMMdd') return values.year + values.month + values.day;
    if (format === 'yyyy-MM-dd') return values.year + '-' + values.month + '-' + values.day;
    throw new Error('Formato de fecha no simulado: ' + format);
  }
};

global.HtmlService = {
  createTemplateFromFile: function () {
    const output = {
      setTitle: function () { return output; },
      addMetaTag: function () { return output; }
    };
    return {
      evaluate: function () { return output; }
    };
  }
};

// Se cargan en orden de dependencia: cada fichero deja sus funciones en
// `global`, así que al requerir el siguiente ya puede usar las anteriores
// exactamente igual que en Apps Script.
require(path.join(__dirname, '..', '..', 'src', 'backend', '00_constants.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '10_sheet_gateway.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '20_config_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '21_element_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '22_store_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '23_log_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '24_rate_limit_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '30_auth_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '31_mail_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '32_request_service.js'));
require(path.join(__dirname, '..', '..', 'src', 'backend', '90_web_entrypoint.js'));

beforeEach(function () {
  global.MailApp.sentEmails = [];
  global.MailApp.sendEmail = function (options) {
    global.MailApp.sentEmails.push(options);
  };
});

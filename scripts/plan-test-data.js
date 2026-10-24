'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SYSTEM_PARAM_KEYS, BRAND_ASSETS } = require('../src/backend/00_constants');
const { defaultFormFieldRows_, hydrateElementSchemas_, FORM_FIELD_HEADERS } = require('../src/backend/26_form_schema_service');
const { TECHNICAL_RATE_PARAM_KEYS, SYSTEM_PARAM_METADATA } = require('../src/backend/20_config_service');

/** Genera un plan local: nunca abre Google ni modifica el libro. */
function planTestData(elements, systemRows) {
  const rows = elements.flatMap(function (element) { return defaultFormFieldRows_(element); });
  // Valida el catálogo y las invariantes usando el mismo motor que la aplicación.
  const previousUtilities = global.Utilities;
  global.Utilities = {
    DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: function (_algorithm, value) { return Array.from(crypto.createHash('sha256').update(value).digest()); }
  };
  try { hydrateElementSchemas_(elements, rows); } finally { global.Utilities = previousUtilities; }
  const params = systemRows.filter(function (row) {
    return row[0] && !TECHNICAL_RATE_PARAM_KEYS.includes(row[0]);
  });
  if (!params.some(function (row) { return row[0] === SYSTEM_PARAM_KEYS.LOGO_URL; })) {
    params.push([SYSTEM_PARAM_KEYS.LOGO_URL, BRAND_ASSETS.LOGO_URL]);
  }
  return {
    fieldRows: [FORM_FIELD_HEADERS].concat(rows.map(function (row) { return FORM_FIELD_HEADERS.map(function (key) { return row[key]; }); })),
    systemRows: [['clave', 'valor', 'categoria', 'descripcion']].concat(params.map(function (row) {
      const info = SYSTEM_PARAM_METADATA[row[0]] || { categoria: 'Otros', descripcion: 'Parámetro heredado; revisar su uso antes de modificar.' };
      const value = row[0] === SYSTEM_PARAM_KEYS.ENVIRONMENT ? 'TEST' :
        row[0] === SYSTEM_PARAM_KEYS.CACHE_SHORT_TTL_SECONDS ? 5 : row[1];
      return [row[0], value, info.categoria, info.descripcion];
    }))
  };
}

if (require.main === module) {
  const input = JSON.parse(fs.readFileSync(path.join(__dirname, '../.staging/test-data-input.json'), 'utf8'));
  const plan = planTestData(input.elements, input.systemRows);
  fs.writeFileSync(path.join(__dirname, '../.staging/test-data-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  console.log('Plan local generado: ' + (plan.fieldRows.length - 1) + ' campos y ' + (plan.systemRows.length - 1) + ' parámetros.');
}

module.exports = { planTestData };

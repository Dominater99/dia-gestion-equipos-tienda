/** Catálogo técnico de campos. Las reglas por petición se editan en Campos_peticion. */
const FORM_FIELD_CATALOG = Object.freeze({
  tienda: { name: 'tienda', type: 'store', label: 'Tienda' },
  tienda_origen: { name: 'tiendaOrigen', type: 'store', label: 'Tienda de origen' },
  tienda_destino: { name: 'tiendaDestino', type: 'store', label: 'Tienda de destino' },
  fecha_inicio: { name: 'fechaInicio', type: 'date', label: 'Fecha de inicio' },
  fecha_fin: { name: 'fechaFin', type: 'date', label: 'Fecha de fin' },
  fecha_maxima_retirada: { name: 'fechaMaximaRetirada', type: 'date', label: 'Fecha máxima de retirada' },
  codigo_servicenow: { name: 'codigoServiceNow', type: 'text', label: 'Código de ServiceNow' },
  enchufe_disponible: { name: 'enchufeDisponible', type: 'yes-no', label: '¿Enchufe disponible?' },
  toma_agua_disponible: { name: 'tomaAguaDisponible', type: 'yes-no', label: '¿Toma de agua disponible?' },
  foto: { name: 'foto', type: 'photo', label: 'Foto' },
  foto_horario: { name: 'fotoHorario', type: 'photo', label: 'Foto horario' },
  foto_cobertura: { name: 'fotoCobertura', type: 'photo', label: 'Foto cobertura' },
  foto_ubicacion: { name: 'fotoUbicacion', type: 'photo', label: 'Foto ubicación' },
  foto_layout: { name: 'fotoLayout', type: 'photo', label: 'Foto layout' },
  comentarios: { name: 'comentarios', type: 'textarea', label: 'Comentarios' }
});
const FORM_FIELD_HEADERS = Object.freeze(['id_elemento', 'campo', 'estado', 'orden', 'etiqueta', 'ayuda']);

function configurationError_(message) {
  return publicError_(message, 'CONFIGURACION_INVALIDA');
}

function normalizeElementRole_(value, rowNumber) {
  const role = String(value === undefined || value === null ? '' : value).trim().toUpperCase() || ELEMENT_VISIBILITY_ALL;
  if (role !== ELEMENT_VISIBILITY_ALL && !Object.values(ROLES).includes(role)) {
    throw configurationError_('Elementos' + (rowNumber ? ', fila ' + rowNumber : '') +
      ': rol_visible debe ser TODOS, ADMINISTRADOR, GESTOR_GLOBAL o GESTOR_DELEGACION.');
  }
  return role;
}

/** Solo se usa para migrar el contrato anterior y mantener libros todavía no migrados. */
function defaultFormFieldRows_(element) {
  const visible = [];
  function add(key, required) { visible.push({ key: key, required: required !== false }); }
  if (element.tipo_gestion === TIPOS_GESTION.MOVIMIENTO) {
    add('tienda_origen'); add('tienda_destino'); add('fecha_maxima_retirada', false);
  } else {
    add('tienda');
    if (element.tipo_gestion === TIPOS_GESTION.DESCONEXION_TEMPORAL) {
      add('fecha_inicio'); add('fecha_fin');
    } else if (element.tipo_gestion === TIPOS_GESTION.RETIRADA) {
      add('fecha_maxima_retirada', element.equipo === EQUIPOS.LOCKER);
    } else if (element.tipo_gestion === TIPOS_GESTION.ERROR_PANTALLA && element.equipo === EQUIPOS.CAFETERA) {
      add('foto');
    } else if (element.tipo_gestion === TIPOS_GESTION.NUEVA_SOLICITUD) {
      if (element.equipo === EQUIPOS.CAFETERA || element.equipo === EQUIPOS.LOCKER) add('enchufe_disponible');
      if (element.equipo === EQUIPOS.CAFETERA) add('toma_agua_disponible');
      if (element.equipo === EQUIPOS.LOCKER) { add('foto_horario'); add('foto_cobertura'); }
      if (element.equipo === EQUIPOS.CAFETERA || element.equipo === EQUIPOS.LOCKER) {
        add('foto_ubicacion'); add('foto_layout');
      }
    }
  }
  if (String(element.requiere_service_now).toUpperCase() === 'SI') add('codigo_servicenow');
  add('comentarios');
  return Object.keys(FORM_FIELD_CATALOG).map(function (key, index) {
    const position = visible.findIndex(function (item) { return item.key === key; });
    return {
      id_elemento: String(element.id_elemento || ''), campo: key,
      estado: position < 0 ? 'OCULTO' : visible[position].required ? 'OBLIGATORIO' : 'OPCIONAL',
      orden: position < 0 ? 1000 + index : (position + 1) * 10,
      etiqueta: FORM_FIELD_CATALOG[key].label, ayuda: ''
    };
  });
}

function fieldDefinition_(row) {
  const catalog = FORM_FIELD_CATALOG[row.campo];
  let hint = String(row.ayuda || '').trim();
  if (!hint && catalog.type === 'date') hint = 'Selecciona una fecha posterior a hoy.';
  if (!hint && catalog.type === 'photo' && row.campo !== 'foto_cobertura') {
    hint = 'Adjunta una imagen JPEG, JPG o PNG de hasta ' + PHOTO_UPLOAD.MAX_BYTES / (1024 * 1024) + ' MiB.';
  }
  if (!hint && row.campo === 'comentarios') hint = UI_TEXT_DEFAULTS.COMMENTS_HINT;
  if (!hint && row.campo === 'codigo_servicenow') hint = 'Formato TASK seguido de siete dígitos.';
  return {
    key: row.campo, name: catalog.name, type: catalog.type,
    label: String(row.etiqueta || '').trim() || catalog.label,
    required: row.estado === 'OBLIGATORIO', hint: hint, order: Number(row.orden)
  };
}

function getElementFields_(element) {
  return element.formFields || defaultFormFieldRows_(element)
    .filter(function (row) { return row.estado !== 'OCULTO'; })
    .sort(function (a, b) { return a.orden - b.orden; }).map(fieldDefinition_);
}

function readFormConfiguration_(cacheConfig) {
  if (cacheConfig.enabled) {
    const cached = getCachedJson_(CACHE_KEYS.FORM_FIELDS);
    if (cached !== null) return cached;
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const exists = ss.getSheetByName(physicalSheetName_(SHEET_NAMES.CAMPOS_PETICION));
  if (!exists) {
    if (isTestEnvironment_()) throw configurationError_('Falta TEST_Campos_peticion: prepara los campos de las peticiones.');
    return null;
  }
  const headers = exists.getRange(1, 1, 1, FORM_FIELD_HEADERS.length).getValues()[0].map(normalizeHeader_);
  if (!FORM_FIELD_HEADERS.every(function (header, index) { return headers[index] === header; })) {
    throw configurationError_('Campos_peticion: revisa las cabeceras id_elemento, campo, estado, orden, etiqueta y ayuda.');
  }
  return readSheetAsObjectsCached_(SHEET_NAMES.CAMPOS_PETICION, CACHE_KEYS.FORM_FIELDS,
    cacheConfig.shortTtlSeconds, cacheConfig.enabled);
}

function hydrateElementSchemas_(elements, rows) {
  const ids = new Set();
  const normalized = elements.map(function (source, index) {
    const element = Object.assign({}, source);
    ['id_elemento', 'equipo', 'tipo_gestion', 'estado', 'proveedor', 'subtipo', 'etiqueta'].forEach(function (key) {
      element[key] = String(element[key] || '').trim();
    });
    ['equipo', 'tipo_gestion', 'estado'].forEach(function (key) { element[key] = element[key].toUpperCase(); });
    if (!element.id_elemento || ids.has(element.id_elemento)) {
      throw configurationError_('Elementos, fila ' + (index + 2) + ': id_elemento vacío o duplicado.');
    }
    ids.add(element.id_elemento);
    element.rol_visible = normalizeElementRole_(source.rol_visible, index + 2);
    if (!Object.values(EQUIPOS).includes(element.equipo) ||
        !Object.values(TIPOS_GESTION).includes(element.tipo_gestion) ||
        !Object.values(ESTADO_ELEMENTO).includes(element.estado) ||
        (element.tipo_gestion === TIPOS_GESTION.ERROR_PANTALLA && element.equipo !== EQUIPOS.CAFETERA)) {
      throw configurationError_('Elementos, fila ' + (index + 2) + ': equipo, gestión o estado no admitido.');
    }
    ['requiere_service_now', 'solo_tiendas_abiertas'].forEach(function (key) {
      element[key] = String(element[key] || 'NO').trim().toUpperCase();
      if (!['SI', 'NO'].includes(element[key])) throw configurationError_('Elementos, fila ' + (index + 2) + ': ' + key + ' debe ser SI o NO.');
    });
    return element;
  });
  const byElement = Object.create(null);
  (rows || []).forEach(function (source, index) {
    const row = Object.assign({}, source, {
      id_elemento: String(source.id_elemento || '').trim(), campo: String(source.campo || '').trim(),
      estado: String(source.estado || '').trim().toUpperCase(), orden: Number(source.orden)
    });
    if (!ids.has(row.id_elemento) || !Object.prototype.hasOwnProperty.call(FORM_FIELD_CATALOG, row.campo) ||
        !['OCULTO', 'OPCIONAL', 'OBLIGATORIO'].includes(row.estado) ||
        source.orden === '' || !Number.isSafeInteger(row.orden) || row.orden < 0 ||
        String(source.etiqueta || '').length > 150 || String(source.ayuda || '').length > 500) {
      throw configurationError_('Campos_peticion, fila ' + (index + 2) + ': revisa petición, campo, estado, orden, etiqueta y ayuda.');
    }
    if (!byElement[row.id_elemento]) byElement[row.id_elemento] = [];
    if (byElement[row.id_elemento].some(function (prior) { return prior.campo === row.campo; })) {
      throw configurationError_('Campos_peticion, fila ' + (index + 2) + ': campo duplicado en la petición.');
    }
    byElement[row.id_elemento].push(row);
  });
  return normalized.map(function (element) {
    const configured = rows !== null;
    const definitions = configured
      ? byElement[element.id_elemento] || (element.estado === ESTADO_ELEMENTO.INACTIVE ? defaultFormFieldRows_(element) : null)
      : defaultFormFieldRows_(element);
    if (!definitions || !definitions.length) throw configurationError_('Campos_peticion: faltan los campos de ' + element.id_elemento + '.');
    element.formFields = definitions.filter(function (row) { return row.estado !== 'OCULTO'; })
      .sort(function (a, b) { return a.orden - b.orden || a.campo.localeCompare(b.campo); }).map(fieldDefinition_);
    validateSchemaInvariants_(element);
    const code = element.formFields.find(function (field) { return field.key === 'codigo_servicenow'; });
    element.requiere_service_now = code && code.required ? 'SI' : 'NO';
    element._configuredSchema = configured;
    element.formRevision = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([element.id_elemento, element.equipo, element.tipo_gestion,
        element.solo_tiendas_abiertas, element.formFields]))
      .map(function (byte) { return (byte & 255).toString(16).padStart(2, '0'); }).join('');
    return element;
  });
}

function validateSchemaInvariants_(element) {
  const fields = element.formFields;
  const movement = element.tipo_gestion === TIPOS_GESTION.MOVIMIENTO;
  const stores = fields.filter(function (field) { return field.type === 'store'; });
  const required = movement ? ['tiendaOrigen', 'tiendaDestino'] : ['tienda'];
  if (stores.length !== required.length || !required.every(function (name) {
    return stores.some(function (field) { return field.name === name && field.required; });
  })) throw configurationError_('Campos_peticion de ' + element.id_elemento + ': las tiendas obligatorias no corresponden a la gestión.');
  if (element.tipo_gestion === TIPOS_GESTION.DESCONEXION_TEMPORAL &&
      !['fechaInicio', 'fechaFin'].every(function (name) {
        return fields.some(function (field) { return field.name === name && field.required; });
      })) throw configurationError_('Campos_peticion de ' + element.id_elemento + ': la desconexión requiere inicio y fin obligatorios.');
}

function publicElement_(element) {
  const result = {};
  ['id_elemento', 'equipo', 'proveedor', 'tipo_gestion', 'subtipo', 'etiqueta',
    'solo_tiendas_abiertas', 'formFields', 'formRevision'].forEach(function (key) { result[key] = element[key]; });
  return result;
}

function sanitizeRequestPayload_(element, source) {
  const result = { idElemento: String(source.idElemento || ''), formRevision: String(source.formRevision || '') };
  getElementFields_(element).forEach(function (field) {
    const value = source[field.name];
    if (value === undefined || value === null || value === '') return;
    if (field.type === 'photo') {
      if (typeof value !== 'object' || Array.isArray(value)) throw publicError_(VALIDATION_MESSAGES.PHOTO_TYPE, 'FOTO_INVALIDA');
      result[field.name] = { mimeType: String(value.mimeType || ''), base64: String(value.base64 || '') };
    } else {
      if (typeof value !== 'string' && typeof value !== 'number') throw publicError_('Valor no válido en ' + field.label + '.', 'CAMPO_INVALIDO');
      result[field.name] = String(value).trim();
    }
  });
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { FORM_FIELD_CATALOG, FORM_FIELD_HEADERS, configurationError_, normalizeElementRole_, defaultFormFieldRows_,
    fieldDefinition_, getElementFields_, readFormConfiguration_, hydrateElementSchemas_, validateSchemaInvariants_,
    publicElement_, sanitizeRequestPayload_ };
  Object.keys(module.exports).forEach(function (key) { global[key] = module.exports[key]; });
}

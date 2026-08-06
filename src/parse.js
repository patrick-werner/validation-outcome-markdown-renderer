const { XMLParser, XMLValidator } = require('fast-xml-parser');

// FHIR elements that are arrays in the JSON representation even when they
// occur only once in XML. Elements occurring multiple times become arrays
// automatically, so this list only needs the single-occurrence cases.
const ARRAY_ELEMENTS = new Set([
  'entry',
  'issue',
  'extension',
  'modifierExtension',
  'expression',
  'location',
  'contained',
  'link',
  'coding',
  'identifier',
  'profile',
  'parameter'
]);

// FHIR primitive types whose `value` attribute is not a string in JSON
const NUMERIC_VALUE_SUFFIXES = ['Integer', 'Integer64', 'Decimal', 'PositiveInt', 'UnsignedInt'];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) => ARRAY_ELEMENTS.has(name)
});

function coerceValue(key, value) {
  if (typeof value !== 'string') return value;
  if (key === 'valueBoolean') return value === 'true';
  if (NUMERIC_VALUE_SUFFIXES.some(suffix => key.endsWith(suffix)) && key.startsWith('value')) {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  return value;
}

/**
 * Convert the raw fast-xml-parser output into the FHIR JSON representation:
 * - `<severity value="error"/>` → `severity: "error"`
 * - `<resource><OperationOutcome>…` → `resource: { resourceType: "OperationOutcome", … }`
 * - namespace declarations are dropped
 */
function normalize(node, key) {
  if (Array.isArray(node)) return node.map(item => normalize(item, key));
  if (node === null || typeof node !== 'object') return coerceValue(key, node);

  const result = {};
  for (const [childKey, childValue] of Object.entries(node)) {
    if (childKey === 'xmlns' || childKey.startsWith('xmlns:')) continue;
    if (childKey === '#text') continue;
    result[childKey] = normalize(childValue, childKey);
  }

  // FHIR primitive: the `value` attribute carries the actual value
  if (Object.prototype.hasOwnProperty.call(result, 'value')) {
    return coerceValue(key, result.value);
  }

  // Resource wrapper: a single upper-case key is a resource type (element
  // names in FHIR are lowerCamelCase, so this is unambiguous)
  const keys = Object.keys(result);
  if (keys.length === 1 && /^[A-Z]/.test(keys[0])) {
    return asResource(keys[0], result[keys[0]]);
  }

  return result;
}

/** Build a resource object; an empty element parses to '' rather than an object. */
function asResource(resourceType, body) {
  const props = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
  return { resourceType, ...props };
}

/**
 * Parse a FHIR OperationOutcome/Bundle from XML into the JSON representation.
 * @param {string} text - XML document
 * @returns {Object}    - FHIR resource as plain JSON object
 */
function parseXml(text) {
  // the parser itself is lenient, so malformed XML would silently yield garbage
  const validation = XMLValidator.validate(text);
  if (validation !== true) {
    const { msg, line, col } = validation.err;
    throw new Error(`${msg} (line ${line}, column ${col})`);
  }

  const parsed = parser.parse(text);
  const rootName = Object.keys(parsed).find(k => k !== '?xml' && !k.startsWith('#'));
  if (!rootName) {
    throw new Error('XML document contains no root element');
  }
  if (!/^[A-Z]/.test(rootName)) {
    throw new Error(`Unsupported XML root element: ${rootName}`);
  }
  return asResource(rootName, normalize(parsed[rootName], rootName));
}

/**
 * Detect the format and parse a validation outcome file.
 * XML is detected by content (leading `<`), everything else is treated as JSON,
 * so existing JSON inputs keep working unchanged.
 * @param {string} text        - file content
 * @param {string} [filePath]  - used only for error messages
 * @returns {Object}           - FHIR resource as plain JSON object
 */
function parseValidationOutcome(text, filePath = '') {
  const content = text.replace(/^﻿/, '');
  const isXml = content.trimStart().startsWith('<');
  try {
    return isXml ? parseXml(content) : JSON.parse(content);
  } catch (err) {
    const format = isXml ? 'XML' : 'JSON';
    throw new Error(`Failed to parse ${format} file${filePath ? ` ${filePath}` : ''}: ${err.message}`);
  }
}

module.exports = { parseValidationOutcome, parseXml };
'use strict';

/**
 * api-contract-page.js
 *
 * Reads an epic's API contract (generated-docs/epics/<slug>/api-contract.yaml,
 * drafted by design-api-agent) and builds the read-only page that shows it in
 * full, linked from the stories review page.
 *
 * Lists the endpoints the epic adds or changes, then its data shapes. Anything
 * else the page can't put into words is shown as YAML, except workflow
 * bookkeeping (x- keys), operation descriptions and tags, and response headers
 * and links. Schemas it refers to but doesn't define are listed by name only.
 */

const fs = require('fs');
const path = require('path');
const { page, escapeHtml } = require('./review-page');
const { getProjectRoot } = require('./project-root');

// A devDependency of app-frontend, installed with the frontend's packages at intake.
const yaml = require(path.join(getProjectRoot(), 'app-frontend', 'node_modules', 'js-yaml'));

/** The parsed contract, or null when the epic has none. */
function readContract(contractPath) {
  if (!fs.existsSync(contractPath)) return null;
  return yaml.load(fs.readFileSync(contractPath, 'utf8')) || {};
}

const HTTP_METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

/**
 * Every operation in the contract, in file order, as an endpoint:
 * { method, path, operation, pathParameters }, where pathParameters are the ones its path declares.
 */
function listOperations(contract) {
  const endpoints = [];
  for (const [pathName, pathItem] of Object.entries(contract?.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !operation || typeof operation !== 'object') continue;
      endpoints.push({ method, path: pathName, operation, pathParameters: pathItem.parameters || [] });
    }
  }
  return endpoints;
}

/** The story numbers an operation's `x-stories` names: a list, or a single number. */
function storyNumbersOf(operation) {
  return [].concat(operation['x-stories'] ?? []).map(Number);
}

/** The number of the backend story that builds an operation (`x-backend-story`), or null when it names none. */
function backendStoryOf(operation) {
  const backendStoryNumber = Number(operation['x-backend-story']);
  return backendStoryNumber > 0 ? backendStoryNumber : null;
}

/** "1. See the list of orders", or "story 3" (`fallbackName` then the number) when there's no story 3 to name. */
function storyLabel(storyNumber, stories, fallbackName = 'story') {
  const title = stories[storyNumber - 1]?.title;
  return title ? `${storyNumber}. ${title}` : `${fallbackName} ${storyNumber}`;
}

/** The plain line an operation goes by: its summary, falling back to its operationId. */
function operationName(operation) {
  return operation.summary || operation.operationId || 'An unnamed operation';
}

const SCHEMA_REF_PREFIX = '#/components/schemas/';
const schemaNameOf = (ref) =>
  typeof ref === 'string' && ref.startsWith(SCHEMA_REF_PREFIX) ? ref.slice(SCHEMA_REF_PREFIX.length) : null;
const schemaAnchor = (schemaName) => `schema-${schemaName}`;

/** A `$ref` as a link to its schema on this page, or by name when it points elsewhere. */
function refHtml(ref) {
  const schemaName = schemaNameOf(ref);
  if (schemaName) {
    return `<a href="#${escapeHtml(schemaAnchor(schemaName))}">→ ${escapeHtml(schemaName)}</a>`;
  }
  // A shared response, parameter or request body has no card on this page.
  return `<code>${escapeHtml(String(ref).split('/').pop())}</code>`;
}

/** The names of every schema the contract refers to with `$ref`, anywhere in it. */
function referencedSchemaNames(node, schemaNames = new Set()) {
  if (Array.isArray(node)) {
    node.forEach((item) => referencedSchemaNames(item, schemaNames));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && schemaNameOf(value)) schemaNames.add(schemaNameOf(value));
      else referencedSchemaNames(value, schemaNames);
    }
  }
  return schemaNames;
}

/**
 * The keys of `part` (a schema, operation, parameter, …) this page doesn't put into
 * words, shown as YAML so they're still there to read. Extensions (`x-…`) are
 * workflow bookkeeping, not contract.
 */
function leftOverHtml(part, describedKeys) {
  const leftOver = Object.fromEntries(
    Object.entries(part || {}).filter(([key]) => !describedKeys.has(key) && !key.startsWith('x-'))
  );
  if (!Object.keys(leftOver).length) return '';
  return `<pre class="raw">${escapeHtml(yaml.dump(leftOver))}</pre>`;
}

const COMPOSITIONS = [['allOf', 'all of'], ['oneOf', 'one of'], ['anyOf', 'any of']];

/** "1–200", "at least 0", "more than 0, at most 10" — with `unit` after each number. */
function rangeText(low, high, lowExclusive, highExclusive, unit = '') {
  const suffix = unit ? ` ${unit}` : '';
  if (low !== undefined && high !== undefined && !lowExclusive && !highExclusive) {
    return `${escapeHtml(low)}–${escapeHtml(high)}${suffix}`;
  }
  const parts = [];
  if (low !== undefined) parts.push(`${lowExclusive ? 'more than' : 'at least'} ${escapeHtml(low)}${suffix}`);
  if (high !== undefined) parts.push(`${highExclusive ? 'less than' : 'at most'} ${escapeHtml(high)}${suffix}`);
  return parts.join(', ');
}

/** Number bounds, for both OpenAPI 3.0 (boolean exclusive flags) and 3.1 (numeric ones). */
function numberRangeText(schema) {
  const hasExclusiveMinValue = typeof schema.exclusiveMinimum === 'number';
  const hasExclusiveMaxValue = typeof schema.exclusiveMaximum === 'number';
  return rangeText(
    hasExclusiveMinValue ? schema.exclusiveMinimum : schema.minimum,
    hasExclusiveMaxValue ? schema.exclusiveMaximum : schema.maximum,
    hasExclusiveMinValue || schema.exclusiveMinimum === true,
    hasExclusiveMaxValue || schema.exclusiveMaximum === true
  );
}

const valueText = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

// Schema keywords schemaHtml writes out. Any other keyword (not, discriminator,
// if/then/else, …) is shown as YAML beside the words.
const DESCRIBED_SCHEMA_KEYS = new Set([
  '$ref', 'type', 'format', 'enum', 'items', 'properties', 'required', 'additionalProperties',
  'allOf', 'oneOf', 'anyOf', 'nullable', 'default', 'minimum', 'maximum', 'exclusiveMinimum',
  'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'uniqueItems', 'pattern',
  'multipleOf', 'readOnly', 'writeOnly', 'deprecated', 'description', 'title', 'example', 'examples',
]);

/**
 * A schema written out in words — "integer, 1–200, default 50", "array of → Order",
 * "string, one of: Pending, Shipped" — as HTML. An inline object's properties
 * follow, indented, so a nested shape reads the same wherever it appears.
 */
function schemaHtml(schema) {
  if (!schema || typeof schema !== 'object') return '';
  if (schema.$ref) return refHtml(schema.$ref);

  // OpenAPI 3.1 writes "or empty" as a "null" member of `type`; 3.0 as `nullable`.
  const declaredTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const types = declaredTypes.filter((type) => type !== 'null');
  const parts = [];
  const nestedProperties = schema.properties ? propertiesHtml(schema) : '';

  const composition = COMPOSITIONS.find(([keyword]) => Array.isArray(schema[keyword]));
  if (composition) {
    const [keyword, words] = composition;
    parts.push(`${words}: ${schema[keyword].map(schemaHtml).join(', ')}`);
  } else if (types.includes('array') || schema.items) {
    parts.push(`array of ${schemaHtml(schema.items) || 'any value'}`);
  } else if (types.includes('object') || schema.properties || schema.additionalProperties) {
    if (schema.properties || !schema.additionalProperties) parts.push('object');
    if (schema.additionalProperties) {
      const mapValueType =
        schema.additionalProperties === true ? 'any value' : schemaHtml(schema.additionalProperties);
      parts.push(`${schema.properties ? 'plus a map' : 'map'} of ${mapValueType}`);
    }
  } else if (types.length) {
    const format = schema.format ? ` (${escapeHtml(schema.format)})` : '';
    parts.push(escapeHtml(types.join(' or ')) + format);
  }

  if (Array.isArray(schema.enum)) {
    parts.push(`one of: ${schema.enum.map((value) => escapeHtml(valueText(value))).join(', ')}`);
  }
  if (!parts.length) parts.push('any value');

  const numberRange = numberRangeText(schema);
  if (numberRange) parts.push(numberRange);
  const lengthRange = rangeText(schema.minLength, schema.maxLength, false, false, 'characters');
  if (lengthRange) parts.push(lengthRange);
  const itemRange = rangeText(schema.minItems, schema.maxItems, false, false, 'items');
  if (itemRange) parts.push(itemRange);
  if (schema.uniqueItems) parts.push('no repeats');
  if (schema.multipleOf !== undefined) parts.push(`a multiple of ${escapeHtml(schema.multipleOf)}`);
  if (schema.pattern) parts.push(`matching <code>${escapeHtml(schema.pattern)}</code>`);
  if (schema.default !== undefined) parts.push(`default ${escapeHtml(valueText(schema.default))}`);
  if (schema.nullable === true || declaredTypes.includes('null')) parts.push('or empty');
  if (schema.readOnly) parts.push('set by the backend');
  if (schema.writeOnly) parts.push('sent only, never returned');
  if (schema.deprecated) parts.push('deprecated');

  return parts.join(', ') + nestedProperties + leftOverHtml(schema, DESCRIBED_SCHEMA_KEYS);
}

/** An inline object's properties, one per line, indented under its type. */
function propertiesHtml(schema) {
  const requiredNames = new Set(schema.required || []);
  const lines = Object.entries(schema.properties).map(([name, property]) => {
    const required = requiredNames.has(name) ? ' · required' : '';
    const description = property?.description
      ? ` <span class="muted">— ${escapeHtml(property.description)}</span>`
      : '';
    return `<div><code>${escapeHtml(name)}</code> ${schemaHtml(property)}${required}${description}</div>`;
  });
  return `<div class="nested">${lines.join('')}</div>`;
}

/**
 * What a body or response carries, one line per media type. A lone JSON body is
 * the usual case, so it goes unlabelled; otherwise each line names its type.
 */
function contentHtml(content) {
  const mediaTypes = Object.entries(content || {});
  const isLoneJson = mediaTypes.length === 1 && mediaTypes[0][0] === 'application/json';
  return mediaTypes
    .map(([mediaType, media]) => {
      const label = isLoneJson
        ? ''
        : mediaType === 'application/json'
          ? 'JSON: '
          : `<code>${escapeHtml(mediaType)}</code>: `;
      const leftOver = leftOverHtml(media, new Set(['schema', 'example', 'examples']));
      return `<div>${label}${schemaHtml(media?.schema)}${leftOver}</div>`;
    })
    .join('');
}

function tableHtml(headings, rows) {
  const headingRow = `<tr>${headings.map((heading) => `<th>${heading}</th>`).join('')}</tr>`;
  return `<div class="scroll"><table>${headingRow}${rows.join('')}</table></div>`;
}

const DESCRIBED_PARAMETER_KEYS = new Set([
  'name', 'in', 'required', 'schema', 'description', 'deprecated', 'example', 'examples',
]);

/**
 * The parameters the endpoint's path declares, then the operation's own. An operation's
 * parameter replaces the path's one with the same name and place.
 */
function parameterRows(endpoint) {
  const parameterKey = (parameter) => parameter.$ref || `${parameter.in}:${parameter.name}`;
  const operationParameters = (endpoint.operation.parameters || []).filter(Boolean);
  const replacedKeys = new Set(operationParameters.map(parameterKey));
  const pathParameters = endpoint.pathParameters.filter(
    (parameter) => parameter && !replacedKeys.has(parameterKey(parameter))
  );

  return [...pathParameters, ...operationParameters].map((parameter) => {
    if (parameter.$ref) {
      return `<tr><td>${refHtml(parameter.$ref)}</td><td colspan="3"></td>` +
        '<td class="muted">Defined in the shared API.</td></tr>';
    }
    const required = parameter.required || parameter.in === 'path' ? 'required' : 'optional';
    const leftOver = leftOverHtml(parameter, DESCRIBED_PARAMETER_KEYS);
    return `<tr><td><code>${escapeHtml(parameter.name)}</code></td>` +
      `<td>${escapeHtml(parameter.in)}</td>` +
      `<td>${required}</td>` +
      `<td>${schemaHtml(parameter.schema)}${leftOver}</td>` +
      `<td>${escapeHtml(parameter.description)}</td></tr>`;
  });
}

function requestBodyRow(requestBody) {
  if (requestBody.$ref) {
    return `<tr><td></td><td>${refHtml(requestBody.$ref)}</td>` +
      '<td class="muted">Defined in the shared API.</td></tr>';
  }
  const required = requestBody.required ? 'required' : 'optional';
  const leftOver = leftOverHtml(requestBody, new Set(['required', 'description', 'content']));
  return `<tr><td>${required}</td>` +
    `<td>${contentHtml(requestBody.content)}${leftOver}</td>` +
    `<td>${escapeHtml(requestBody.description)}</td></tr>`;
}

/** One row per response. Anything beyond its description and content (headers, links) isn't shown. */
function responseRows(responses) {
  return Object.entries(responses || {}).map(([status, response]) => {
    const statusCell = `<td><code>${escapeHtml(status === 'default' ? 'any other' : status)}</code></td>`;
    if (response?.$ref) {
      return `<tr>${statusCell}<td class="muted">Defined in the shared API.</td>` +
        `<td>${refHtml(response.$ref)}</td></tr>`;
    }
    return `<tr>${statusCell}<td>${escapeHtml(response?.description)}</td>` +
      `<td>${contentHtml(response?.content)}</td></tr>`;
  });
}

function operationCard(endpoint) {
  const { method, operation } = endpoint;
  const parameters = parameterRows(endpoint);
  const responses = responseRows(operation.responses);

  // `security: []` is how the contract marks an operation anyone can call.
  const isPublic = Array.isArray(operation.security) && operation.security.length === 0;
  const describedKeys = new Set([
    'operationId', 'summary', 'description', 'parameters', 'requestBody', 'responses', 'tags', 'deprecated',
  ]);
  if (isPublic) describedKeys.add('security');

  const notes = [
    isPublic && 'Open to everyone — no sign-in needed.',
    operation.deprecated && 'Deprecated.',
  ].filter(Boolean);

  const notesHtml = notes.map((note) => `<div class="small muted" style="margin-top:.35rem">${note}</div>`).join('');
  const parametersHtml = parameters.length
    ? '<div class="label">Parameters</div>' +
      tableHtml(['Name', 'Sent in', 'Required', 'Type', 'Description'], parameters)
    : '';
  const requestBodyHtml = operation.requestBody
    ? '<div class="label">Request body</div>' +
      tableHtml(['Required', 'Type', 'Description'], [requestBodyRow(operation.requestBody)])
    : '';
  const responsesHtml = responses.length
    ? `<div class="label">Responses</div>${tableHtml(['Status', 'Description', 'Returns'], responses)}`
    : '';

  return `<div class="card">
  <div class="op-head">
    <span class="badge ${method}">${method.toUpperCase()}</span>
    <code class="path">${escapeHtml(endpoint.path)}</code>
    <span class="muted">${escapeHtml(operationName(operation))}</span>
  </div>
  ${notesHtml}
  ${parametersHtml}
  ${requestBodyHtml}
  ${responsesHtml}
  ${leftOverHtml(operation, describedKeys)}
</div>`;
}

/** A data shape this epic adds or changes: a field table for an object, one line otherwise. */
function schemaCard(schemaName, schema) {
  const cardStart = `<div class="card" id="${escapeHtml(schemaAnchor(schemaName))}">`;
  const heading = `<h3><code>${escapeHtml(schemaName)}</code></h3>`;
  const description = schema?.description
    ? `<div class="small muted">${escapeHtml(schema.description)}</div>`
    : '';

  const isPlainObject = schema?.properties && !schema.$ref && !COMPOSITIONS.some(([keyword]) => schema[keyword]);
  if (!isPlainObject) {
    return `${cardStart}${heading}<div>${schemaHtml(schema)}</div>${description}</div>`;
  }

  const requiredNames = new Set(schema.required || []);
  const rows = Object.entries(schema.properties).map(([fieldName, property]) =>
    `<tr><td><code>${escapeHtml(fieldName)}</code></td>` +
    `<td>${schemaHtml(property)}</td>` +
    `<td>${requiredNames.has(fieldName) ? 'yes' : ''}</td>` +
    `<td>${escapeHtml(property?.description)}</td></tr>`
  );
  const { additionalProperties } = schema;
  const otherFields = additionalProperties
    ? '<div class="small" style="margin-top:.4rem">Other fields: ' +
      `${additionalProperties === true ? 'any value' : schemaHtml(additionalProperties)}</div>`
    : '';
  const leftOver = leftOverHtml(schema, new Set([
    'type', 'properties', 'required', 'additionalProperties', 'description', 'title', 'example', 'examples',
  ]));

  return `${cardStart}${heading}${description}` +
    `${tableHtml(['Field', 'Type', 'Required', 'Description'], rows)}${otherFields}${leftOver}</div>`;
}

/**
 * The full-contract page.
 *
 * @param {object} options
 * @param {object} options.contract  the parsed api-contract.yaml
 * @param {string} options.epicName  the payload's `name`
 */
function renderContractPage({ contract, epicName }) {
  const endpoints = listOperations(contract);
  const operationsHtml = endpoints.length
    ? `<h2>Endpoints this piece adds or changes</h2>\n${endpoints.map(operationCard).join('\n')}`
    : '';

  const components = contract.components || {};
  const schemas = components.schemas || {};
  const shapesHtml = Object.keys(schemas).length
    ? `<h2>Data shapes this piece adds or changes</h2>
<p class="small muted" style="margin-top:-.3rem">What the requests and responses above carry.</p>
${Object.entries(schemas).map(([schemaName, schema]) => schemaCard(schemaName, schema)).join('\n')}`
    : '';

  const sharedSchemaNames = [...referencedSchemaNames(contract)].filter((schemaName) => !(schemaName in schemas));
  const sharedLines = sharedSchemaNames.map((schemaName) =>
    `<div id="${escapeHtml(schemaAnchor(schemaName))}"><code>${escapeHtml(schemaName)}</code></div>`
  );
  const sharedHtml = sharedLines.length
    ? `<h2>Defined in the shared API</h2>
<div class="card">${sharedLines.join('')}</div>`
    : '';

  // Definitions other than schemas (shared responses, parameters, …) are rare in a
  // contract; shown as YAML rather than left out.
  const otherComponents = Object.fromEntries(
    Object.entries(components).filter(([section]) => section !== 'schemas')
  );
  const otherHtml = Object.keys(otherComponents).length
    ? '<h2>Other definitions</h2>' +
      `<div class="card"><pre class="raw">${escapeHtml(yaml.dump(otherComponents))}</pre></div>`
    : '';

  const noOperationsHtml = '<p class="muted">This piece doesn’t change any operations.</p>';
  return page({
    title: `${epicName || 'Epic'} — API detail`,
    heading: epicName || 'This piece of work',
    pill: 'API detail',
    lede: 'Read-only. To change it, choose “Adjust the stories” in the chat.',
    body: [
      '<div class="api">',
      operationsHtml || noOperationsHtml,
      shapesHtml,
      sharedHtml,
      otherHtml,
      '</div>',
    ].join('\n'),
  });
}

module.exports = {
  readContract, listOperations, storyNumbersOf, backendStoryOf, storyLabel, operationName, renderContractPage,
};

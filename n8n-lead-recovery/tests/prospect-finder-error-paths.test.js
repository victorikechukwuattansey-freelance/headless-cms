'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const workflowPath = path.join(__dirname, '..', 'Lead Recovery Engine — Prospect Finder & Validation V1.json');

let workflow;
let nodesByName;

before(() => {
  workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  nodesByName = new Map(workflow.nodes.map((n) => [n.name, n]));
});

/*
 * Minimal offline n8n Code-node sandbox: evaluates a node body from
 * prosepect-finder-embedded-code.js against $input / $('Node') mocks.
 * No live HTTP, no credentials — deterministic, provider-agnostic.
 */
function runNode(jsCode, { inputItems = [{ json: {} }], nodeData = {}, staticData = {} } = {}) {
  const state = { staticData };
  const accessorCache = new Map();
  const resolve = (name) => {
    if (accessorCache.has(name)) return accessorCache.get(name);
    const items = (nodeData[name] || []).map((raw) => ({ json: raw && raw.json !== undefined ? raw.json : raw }));
    const accessor = { first: () => items[0] || { json: {} }, all: () => items };
    accessorCache.set(name, accessor);
    return accessor;
  };
  const sandbox = {
    $input: {
      first: () => inputItems[0] || { json: {} },
      all: () => inputItems,
    },
    $getWorkflowStaticData: () => state.staticData,
    $: resolve,
    Math,
    Date,
    JSON,
    Object,
    Array,
    String,
    Number,
    RegExp,
    Boolean,
    Error,
    Symbol,
    Set,
    Map,
    Promise,
    undefined,
  };
  const fn = vm.runInNewContext(`(function() {\n${jsCode}\n})`, sandbox, { filename: 'embedded-node.js' });
  const items = fn();
  return { items, staticData: state.staticData };
}

function nodeJsCode(name) {
  const node = nodesByName.get(name);
  assert.ok(node, `node ${name} must exist in the artifact`);
  return node.parameters.jsCode;
}

function mergeEdge(sourceNode) {
  return (workflow.connections[sourceNode]?.main?.[0] || []).find((e) => e.node === 'Merge');
}

describe('Prospect Finder error paths & sink filtering (R3)', () => {
  describe('§6.3 GPL error branch', () => {
    it('routes the GPL HTTP error output to the GPL Error Envelope node', () => {
      const h = nodesByName.get('Google Places API');
      const errorOut = workflow.connections['Google Places API'].main[1] || [];
      assert.equal(h.onError, 'continueErrorOutput', 'GPL node must keep continueErrorOutput');
      assert.deepEqual(
        errorOut.map((e) => e.node),
        ['GPL Error Envelope'],
        'error output must be wired (was unwired → silently swallowed pre-R3)',
      );
    });

    it('the GPL Error Envelope reaches Merge at a distinct input index', () => {
      assert.equal(mergeEdge('GPL Error Envelope').index, 3);
    });

    it('converts a real HTTP failure into an explicit failure envelope (offline)', () => {
      const { items, staticData } = runNode(nodeJsCode('GPL Error Envelope'), {
        inputItems: [
          { json: { error: { message: 'Request failed with status code 403', description: 'API key rejected', httpCode: 403 } } },
        ],
        nodeData: { 'Build GPL API Query': [{ json: { input_id: 'TEST-GPL-LIVE-001', niche: 'HVAC' } }] },
      });
      assert.equal(items.length, 1);
      const env = items[0].json;
      assert.equal(env._provider, 'google_places');
      assert.equal(env._status, 'error');
      assert.equal(env.search_input_id, 'TEST-GPL-LIVE-001');
      assert.equal(env.input_id, 'TEST-GPL-LIVE-001');
      assert.match(env._errorMessage, /^Google Places API error: .*\(HTTP 403\)/);
      assert.equal(env._rawStatus, 'HTTP 403');
      assert.equal(env.source, 'google_places:error');
      assert.ok(env.notes.length > 0);
      assert.equal(env.lead_id, undefined, 'error envelope must not fabricate lead fields');
      assert.equal(staticData.errorsEncountered, 1, 'live HTTP failure increments errorsEncountered');
    });

    it('GPL error envelope emits both input_id and search_input_id (cleanup matcher parity)', () => {
      const { items } = runNode(nodeJsCode('GPL Error Envelope'), {
        inputItems: [{ json: { error: { message: 'boom', httpCode: 500 } } }],
        nodeData: { 'Build GPL API Query': [{ json: { input_id: 'TEST-GPL-LIVE-001' } }] },
      });
      const env = items[0].json;
      assert.equal(env.input_id, 'TEST-GPL-LIVE-001');
      assert.equal(env.search_input_id, 'TEST-GPL-LIVE-001', 'live-cleanup matches by search_input_id LIKE TEST-GPL-LIVE-%');
    });

    it('degrades gracefully if the HTTP node error payload has no httpCode', () => {
      const { items } = runNode(nodeJsCode('GPL Error Envelope'), {
        inputItems: [{ json: { error: { message: 'Network error' } } }],
        nodeData: { 'Build GPL API Query': [{ json: {} }] },
      });
      assert.equal(items[0].json._rawStatus, 'ERROR');
      assert.equal(items[0].json._errorMessage, 'Google Places API error: Network error');
    });
  });

  describe('§6.4 FSQ error handling', () => {
    it('routes the FSQ HTTP error output to the FSQ Error Envelope node', () => {
      const f = nodesByName.get('Foursquare Places API');
      assert.equal(f.onError, 'continueErrorOutput', 'FSQ node must opt into the error output (was default continueRegularOutput pre-R3)');
      assert.deepEqual(
        (workflow.connections['Foursquare Places API'].main[1] || []).map((e) => e.node),
        ['FSQ Error Envelope'],
        'Foursquare error output must be wired',
      );
    });

    it('the FSQ Error Envelope reaches Merge at a distinct input index', () => {
      assert.equal(mergeEdge('FSQ Error Envelope').index, 4);
    });

    it('converts a real FSQ HTTP failure into an explicit failure envelope (offline)', () => {
      const { items, staticData } = runNode(nodeJsCode('FSQ Error Envelope'), {
        inputItems: [{ json: { error: { message: 'Request failed with status code 500', httpCode: 500 } } }],
        nodeData: { 'Build FSQ API Query': [{ json: { input_id: 'TEST-GPL-LIVE-002' } }] },
      });
      assert.equal(items.length, 1);
      const env = items[0].json;
      assert.equal(env._provider, 'foursquare');
      assert.equal(env._status, 'error');
      assert.equal(env.search_input_id, 'TEST-GPL-LIVE-002');
      assert.match(env._errorMessage, /^Foursquare API error: .*\(HTTP 500\)/);
      assert.equal(env._rawStatus, 'HTTP 500');
      assert.equal(env.source, 'foursquare:error');
      assert.equal(staticData.errorsEncountered, 1);
    });
  it('FSQ error envelope emits both input_id and search_input_id (cleanup matcher parity)', () => {
      const { items } = runNode(nodeJsCode('FSQ Error Envelope'), {
        inputItems: [{ json: { error: { message: 'boom', httpCode: 500 } } }],
        nodeData: { 'Build FSQ API Query': [{ json: { input_id: 'TEST-GPL-LIVE-002' } }] },
      });
      const env = items[0].json;
      assert.equal(env.input_id, 'TEST-GPL-LIVE-002');
      assert.equal(env.search_input_id, 'TEST-GPL-LIVE-002', 'matches by the same search_input_id contract as GPL');
    });
  });

  describe('§6.6 _noResults sink filtering', () => {
    it('suppresses a successful-but-empty provider envelope before Raw Leads', () => {
      const { items } = runNode(nodeJsCode('Filter Empty Envelopes'), {
        inputItems: [
          { json: { _noResults: true, _message: 'Google Places returned zero results', _provider: 'google_places' } },
          { json: { lead_id: 'GP-00000001', business_name: 'Cool Air HVAC', source: 'google_places', search_input_id: 'T1' } },
        ],
      });
      const kept = items.map((i) => i.json);
      assert.equal(kept.length, 1, '_noResults envelope must be dropped');
      assert.equal(kept[0].lead_id, 'GP-00000001', 'real lead must pass through');
    });

    it('does NOT suppress a provider-failure envelope (must propagate)', () => {
      const { items } = runNode(nodeJsCode('Filter Empty Envelopes'), {
        inputItems: [
          { json: { _provider: 'google_places', _status: 'error', _errorMessage: 'Google Places API error: X (HTTP 403)', _rawStatus: 'HTTP 403', source: 'google_places:error', search_input_id: 'T1' } },
          { json: { _noResults: true, _provider: 'google_places' } },
        ],
      });
      const kept = items.map((i) => i.json);
      assert.equal(kept.length, 1);
      assert.equal(kept[0]._status, 'error');
    });

    it('drops a completely empty envelope', () => {
      const { items } = runNode(nodeJsCode('Filter Empty Envelopes'), {
        inputItems: [{ json: {} }, { json: { business_name: 'B', dedupe_key: 'd' } }],
      });
      assert.deepEqual(items.map((i) => i.json), [{ business_name: 'B', dedupe_key: 'd' }]);
    });
  });

  describe('Structural integrity (R3)', () => {
    it('Merge is fed by the three providers on indices 0,1,2 and error envelopes on 3,4', () => {
      const indices = ['Process FSQ', 'Process OSM', 'Process GPL', 'GPL Error Envelope', 'FSQ Error Envelope'].map((p) => {
        const edge = mergeEdge(p);
        assert.ok(edge, `${p} must connect to Merge`);
        return edge.index;
      });
      assert.deepEqual([...indices].sort((a, b) => a - b), [0, 1, 2, 3, 4]);
    });

    it('wires error-path consumer chain Merge → Filter Empty Envelopes → Write Raw Leads', () => {
      const mergeOut = workflow.connections['Merge'].main[0];
      assert.equal(mergeOut.length, 1);
      assert.equal(mergeOut[0].node, 'Filter Empty Envelopes');
      assert.equal(workflow.connections['Filter Empty Envelopes'].main[0][0].node, 'Write Raw Leads');
    });

    it('contains no feedback edges from Merge back into its own inputs (R1/R3 invariant)', () => {
      // The workflow intentionally loops per-search through `Loop Through
      // Searches`; the R1 defect was a *direct* Merge → Process GPL edge. The
      // guarded invariant: Merge may never write back into any node that feeds
      // its own input slots.
      const mergeInputSources = ['Process FSQ', 'Process OSM', 'Process GPL', 'GPL Error Envelope', 'FSQ Error Envelope'];
      const mergeOut = workflow.connections['Merge']?.main?.[0] || [];
      for (const edge of mergeOut) {
        assert.ok(
          !mergeInputSources.includes(edge.node),
          `Merge must not feed back into input source ${edge.node}`,
        );
      }
      assert.equal(
        mergeOut.filter((e) => e.node === 'Process GPL').length,
        0,
        'no Merge -> Process GPL feedback edge anywhere',
      );
    });

    it('both provider HTTP nodes keep their non-retry parameters unchanged', () => {
      const gpl = nodesByName.get('Google Places API');
      assert.equal(gpl.parameters.url, 'https://places.googleapis.com/v1/places:searchText');
      assert.equal(gpl.retryOnFail, true);
      assert.equal(gpl.waitBetweenTries, 5000);
      const fsq = nodesByName.get('Foursquare Places API');
      assert.equal(fsq.parameters.url, 'https://places-api.foursquare.com/places/search');
    });

    it('the three provider success inputs were not renumbered (GPL still at 2)', () => {
      assert.equal(mergeEdge('Process FSQ').index, 0);
      assert.equal(mergeEdge('Process OSM').index, 1);
      assert.equal(mergeEdge('Process GPL').index, 2);
    });
  });
});
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const WF_PATH = path.join(__dirname, '..', 'Lead Recovery Engine — Prospect Finder & Validation V1.json');
const { prospectFinderWorkflow } = require('../scripts/build-prospect-finder-workflow.js');
const { CODE_BY_NODE } = require('../src/prospect-finder-embedded-code.js');
const { referenceWorkflow, CODE_NODE_NAMES } = require('../src/prospect-finder-workflow-contract.js');

/*
 * Frozen-by-convention hash anchor — the current artifact fingerprint
 * (revision R1). This guard FAILS if any hand-edit changes the artifact
 * without rebuilding and updating this anchor. When you intentionally change
 * the workflow through the builder (spec or embedded code edit + build),
 * update this constant to the new artifact hash (see
 * reports/PROSPECT-FINDER-GPL-PREFLIGHT.md §12.3 revision log).
 */
const ARTIFACT_HASH = '51739c9bb18def72af9250ed54bd6b07bb0baa3f73bfc9e2014c9ac04dad6347';

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const artifactBytes = () => fs.readFileSync(WF_PATH, 'utf8');

function serialize(workflow) {
  return JSON.stringify(workflow, null, 2);
}

describe('Prospect Finder deterministic builder', () => {
  it('builds twice into temp files and emits byte-identical output', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-builder-'));
    const a = path.join(dir, 'a.json');
    const b = path.join(dir, 'b.json');
    try {
      fs.writeFileSync(a, serialize(prospectFinderWorkflow()), 'utf8');
      fs.writeFileSync(b, serialize(prospectFinderWorkflow()), 'utf8');
      const aBytes = fs.readFileSync(a, 'utf8');
      const bBytes = fs.readFileSync(b, 'utf8');
      assert.equal(aBytes, bBytes, 'two builds must be byte-identical');
      assert.equal(sha256(aBytes), sha256(bBytes));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits the artifact byte-for-byte (no regeneration drift)', () => {
    const built = serialize(prospectFinderWorkflow());
    assert.equal(built, artifactBytes(), 'builder output must equal the shipped artifact bytes');
    assert.equal(Buffer.byteLength(built, 'utf8'), 81715);
    assert.equal(sha256(built), sha256(artifactBytes()));
  });

  it('an exact second build also byte-matches the artifact (fresh object each call)', () => {
    assert.equal(
      serialize(prospectFinderWorkflow()),
      serialize(prospectFinderWorkflow()),
      'repeated builds must not drift',
    );
  });

  it('hash anchor: the current artifact fingerprint is frozen at ARTIFACT_HASH', () => {
    assert.equal(
      sha256(artifactBytes()),
      ARTIFACT_HASH,
      'artifact hash changed vs frozen anchor — fallback to a hand-edit or an unrecorded rebuild',
    );
  });

  it('workflow identity and node count are preserved', () => {
    const built = prospectFinderWorkflow();
    assert.equal(built.nodes.length, 32);
    assert.equal(built.name, 'Lead Recovery Engine — Prospect Finder & Validation V1');
    assert.equal(built.id, 'WcUgtTPiKXPL0BLH');
    assert.equal(built.versionId, 'd4206a64-3385-4ea8-b8c1-51628540674f');
    assert.equal(built.active, false);
    assert.deepEqual(built.meta, { templateCredsSetupCompleted: true, instanceId: built.meta.instanceId });
  });

  it('every code node receives its exact jsCode from the embedded-code module', () => {
    const built = prospectFinderWorkflow();
    const byName = new Map(built.nodes.map((n) => [n.name, n]));
    for (const name of CODE_NODE_NAMES) {
      const node = byName.get(name);
      assert.equal(node.type, 'n8n-nodes-base.code', `${name} must be a code node`);
      assert.equal(node.parameters.jsCode, CODE_BY_NODE[name], `${name} jsCode must equal the embedded constant`);
    }
    assert.equal(
      Object.keys(CODE_BY_NODE).length,
      built.nodes.filter((n) => n.type === 'n8n-nodes-base.code').length,
      'embedded-code map must cover exactly the code nodes',
    );
  });

  it('non-code parameters survive the build (no jsCode stripping outside code nodes)', () => {
    const built = prospectFinderWorkflow();
    const readVerified = built.nodes.find((n) => n.name === 'Read Verified Leads');
    assert.equal(readVerified.parameters.documentId.value, '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ');
    assert.equal(readVerified.parameters.sheetName.value, 102);
    assert.deepEqual(readVerified.credentials, {
      googleSheetsOAuth2Api: { id: 'rOKhG0ESKifN5zy2', name: 'Google Sheets account' },
    });
    const gplApi = built.nodes.find((n) => n.name === 'Google Places API');
    assert.equal(gplApi.parameters.method, 'POST');
    assert.equal(gplApi.parameters.url, 'https://places.googleapis.com/v1/places:searchText');
  });

  it('Merge uses append mode (not combine) — A.9 D1 fix', () => {
    const built = prospectFinderWorkflow();
    const merge = built.nodes.find((n) => n.name === 'Merge');
    assert.equal(merge.parameters.mode, 'append');
    assert.equal(merge.parameters.combineBy, undefined, 'combineBy must not be emitted in append mode');
    assert.equal(merge.parameters.combinationMode, undefined, 'combinationMode must not be emitted');
  });

  it('Merge numberOfInputs is 5 — A.9 D1 fix', () => {
    const built = prospectFinderWorkflow();
    const merge = built.nodes.find((n) => n.name === 'Merge');
    assert.equal(merge.parameters.numberOfInputs, 5);
  });

  it('Merge has no combine-mode parameters — A.9 D1 drift guard', () => {
    const built = prospectFinderWorkflow();
    const merge = built.nodes.find((n) => n.name === 'Merge');
    assert.equal(merge.parameters.fieldsToMatch, undefined, 'fieldsToMatch must not be emitted');
    assert.equal(merge.parameters.joinMode, undefined, 'joinMode must not be emitted');
  });

  it('Dedup & Prepare Verified has alwaysOutputData: true — A.9 D2\' fix', () => {
    const built = prospectFinderWorkflow();
    const dedup = built.nodes.find((n) => n.name === 'Dedup & Prepare Verified');
    assert.equal(dedup.alwaysOutputData, true);
  });

  it('Dedup & Prepare Verified alwaysOutputData placement matches pattern — A.9 D2\' fix', () => {
    const built = prospectFinderWorkflow();
    const readVerified = built.nodes.find((n) => n.name === 'Read Verified Leads');
    const dedup = built.nodes.find((n) => n.name === 'Dedup & Prepare Verified');
    assert.equal(readVerified.alwaysOutputData, true, 'Read Verified Leads also uses alwaysOutputData');
    assert.equal(dedup.alwaysOutputData, true);
  });

  it('Google Places API uses n8n 2.x body+header params (no v1-era params) — A.8 fix', () => {
    const built = prospectFinderWorkflow();
    const gpl = built.nodes.find((n) => n.name === 'Google Places API');
    assert.equal(gpl.parameters.contentType, 'json');
    assert.equal(gpl.parameters.specifyBody, 'json');
    assert.equal(gpl.parameters.jsonBody, "={{ JSON.stringify({ textQuery: $json.gpl_query, maxResultCount: $json.gpl_max_results, languageCode: 'en' }) }}");
    assert.equal(gpl.parameters.sendHeaders, true);
    assert.equal(gpl.parameters.jsonParameters, undefined, 'v1 jsonParameters must not be emitted');
    assert.equal(gpl.parameters.bodyParametersJson, undefined, 'v1 bodyParametersJson must not be emitted');
    assert.equal(gpl.parameters.sendBody, true);
    const headers = gpl.parameters.headerParameters.parameters.map((h) => h.name);
    assert.ok(headers.includes('X-Goog-Api-Key'));
    assert.ok(headers.includes('X-Goog-FieldMask'));
  });

  it('no node carries a v1-only param across the whole workflow — A.8 drift guard', () => {
    const built = prospectFinderWorkflow();
    const v1Only = ['jsonParameters', 'bodyParametersJson', 'combinationMode'];
    for (const node of built.nodes) {
      const present = v1Only.filter((p) => node.parameters[p] !== undefined);
      assert.deepEqual(
        present,
        [],
        `${node.name} emits v1-only param(s) removed in n8n 2.x: ${present.join(', ')}`,
      );
    }
  });

  it('structural wiring invariants hold on the freshly-built workflow', () => {
    // Mirror of tests/gpl-workflow.test.js "Merge wiring integrity" (canonical
    // block) — asserted here against BUILT output so spec/regeneration changes
    // cannot silently reintroduce the R1 wiring defect.
    const built = prospectFinderWorkflow();
    const conns = built.connections;
    const merge = built.nodes.find((n) => n.name === 'Merge');

    assert.equal(merge.parameters.numberOfInputs, 5);
    assert.equal(merge.parameters.mode, 'append');

    const inputs = [];
    for (const p of ['Process FSQ', 'Process OSM', 'Process GPL', 'GPL Error Envelope', 'FSQ Error Envelope']) {
      const edge = conns[p].main[0].find((c) => c.node === 'Merge');
      assert.ok(edge, `${p} must connect to Merge`);
      inputs.push(edge.index);
    }
    assert.deepEqual([...inputs].sort((x, y) => x - y), [0, 1, 2, 3, 4]);
    assert.equal(conns['Process GPL'].main[0].find((c) => c.node === 'Merge').index, 2);
    assert.equal(conns['GPL Error Envelope'].main[0].find((c) => c.node === 'Merge').index, 3);
    assert.equal(conns['FSQ Error Envelope'].main[0].find((c) => c.node === 'Merge').index, 4);

    // Error outputs of the provider HTTP nodes are wired (R3/§6.3, §6.4).
    assert.deepEqual(
      conns['Google Places API'].main[1].map((e) => e.node),
      ['GPL Error Envelope'],
    );
    assert.deepEqual(
      conns['Foursquare Places API'].main[1].map((e) => e.node),
      ['FSQ Error Envelope'],
    );

    const mergeOut = conns['Merge'].main[0];
    assert.equal(mergeOut.length, 1, 'Merge must have exactly one output edge');
    assert.equal(mergeOut[0].node, 'Filter Empty Envelopes');
    assert.equal(
      conns['Filter Empty Envelopes'].main[0][0].node,
      'Write Raw Leads',
    );
    assert.equal(
      mergeOut.filter((e) => e.node === 'Process GPL').length,
      0,
      'no Merge -> Process GPL feedback edge',
    );
  });

  it('the contract is a functional spec (referenceWorkflow builds a valid base)', () => {
    const base = referenceWorkflow();
    assert.equal(base.nodes.length, 32);
    // Contract code nodes carry a parameters: {} placeholder, ready for injection.
    for (const name of CODE_NODE_NAMES) {
      const node = base.nodes.find((n) => n.name === name);
      assert.deepEqual(node.parameters, {});
    }
  });
});
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { referenceWorkflow, CODE_NODE_NAMES } = require('../src/prospect-finder-workflow-contract');
const { CODE_BY_NODE } = require('../src/prospect-finder-embedded-code');

const OUTPUT = path.join(__dirname, '..', 'Lead Recovery Engine — Prospect Finder & Validation V1.json');

/*
 * Prospect Finder workflow builder (Prompt A.5).
 *
 * Reproduces the artifact byte-for-byte from the canonical spec:
 *   - src/prospect-finder-workflow-contract.js   — topology: nodes, ids,
 *     positions, types, connections, settings, meta, all non-code parameters
 *     (Sheet / HTTP / Merge / IF / loop nodes) in artifact key order;
 *   - src/prospect-finder-embedded-code.js       — the 12 code-node jsCode
 *     bodies as byte-exact, line-preserving strings.
 *
 * The builder injects each jsCode into its code node by name (same pattern as
 * scripts/build-response-interpretation-workflow.js). Serialization matches the
 * artifact exactly: JSON.stringify(workflow, null, 2) — with NO trailing
 * newline, because the artifact itself ends on the closing brace (authored by
 * scripts/add-gpl-to-workflow.js, which used plain stringify without '\n').
 *
 * meta.generatedBy: deliberately NOT set. The artifact's meta block carries
 * only { templateCredsSetupCompleted, instanceId }; adding a generatedBy key
 * would change the bytes and break byte-identity. Per Prompt A.5 this conflict
 * is resolved in favor of byte-identity; the meta update is deferred to a
 * follow-up phase and recorded in reports/PROSPECT-FINDER-GPL-PREFLIGHT.md.
 *
 * Determinism: builds purely from the two spec modules — no timestamps, no
 * randomness, no filesystem iteration. tests/prospect-finder-builder.test.js
 * pins the emitted bytes to the artifact hash (E7CCCBFB…14BCB4) and runs the
 * build twice into temp files to assert byte-identical output.
 */
function prospectFinderWorkflow() {
  const workflow = referenceWorkflow();
  const byName = new Map(workflow.nodes.map((node) => [node.name, node]));
  for (const name of CODE_NODE_NAMES) {
    const node = byName.get(name);
    if (!node) throw new Error(`contract code node missing from workflow: ${name}`);
    const code = CODE_BY_NODE[name];
    if (typeof code !== 'string') throw new Error(`embedded code missing for node: ${name}`);
    node.parameters = { jsCode: code };
  }
  return workflow;
}

function main() {
  const workflow = prospectFinderWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(workflow, null, 2));
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  console.log(`Prospect Finder workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | writes: 7 sheets`);
}

if (require.main === module) {
  main();
}

module.exports = { prospectFinderWorkflow, OUTPUT };
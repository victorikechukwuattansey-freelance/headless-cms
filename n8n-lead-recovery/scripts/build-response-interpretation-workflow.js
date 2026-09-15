'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { referenceWorkflow } = require('../src/response-interpretation-workflow-contract');
const { interpretCode, relayCode } = require('../src/embedded-response-interpret');

const OUTPUT = path.join(__dirname, '..', 'Response-Interpretation V1.json');

/**
 * Read-only response interpretation workflow. Exactly FIVE nodes — no
 * initialization node, wired as a strict linear chain (Phase 5.4):
 *   Manual Trigger → Read Reconciliation Report → Read Response Log
 *     → Interpret Responses → Response Interpretation Complete
 *
 * The topology, ids, positions, meta, AND connections are the Phase 3/5.4
 * contract reference (`referenceWorkflow` from
 * src/response-interpretation-workflow-contract.js) — that reference is the
 * single source of truth for the chain wiring; this builder only injects the
 * embedded jsCode into the two code nodes:
 *   - Read Reconciliation Report → relayCode (read-only pure relay that
 *     surfaces the per-run reconciliation report artifact — injected as
 *     workflow input — plus its read-error metadata),
 *   - Interpret Responses        → interpretCode (the self-contained mirror of
 *     src/response-interpretation.js).
 *
 * The chain (Phase 5.4) is not cosmetic: n8n pairs every item to a single
 * parent (pairedItem), so Interpret Responses can only resolve
 * `$('Read Reconciliation Report')` when that node is a transitive ancestor.
 * The pre-5.4 diamond placed the two reads on sibling branches and failed at
 * runtime with pairedItemNoConnectionCodeNode ("Node 'Read Reconciliation
 * Report' hasn't been executed").
 *
 * The Manual Trigger carries optional operator metadata
 * (response_log_read_error / reconciliation_read_error) so a failed read is
 * reported honestly as INCOMPLETE. Both code nodes set alwaysOutputData so the
 * chain always executes — empty successful reads yield COMPLETED with valid
 * zero metrics rather than a silently skipped run. Reconciliation is consumed
 * as authoritative evidence and NEVER recomputed here.
 */
function responseInterpretationWorkflow() {
  const workflow = referenceWorkflow();
  for (const node of workflow.nodes) {
    if (node.name === 'Read Reconciliation Report') {
      node.parameters = { jsCode: relayCode };
    } else if (node.name === 'Interpret Responses') {
      node.parameters = { jsCode: interpretCode };
    }
  }
  return workflow;
}

function main() {
  const workflow = responseInterpretationWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  console.log(`Response Interpretation workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | writes: 0`);
}

if (require.main === module) {
  main();
}

module.exports = { responseInterpretationWorkflow, OUTPUT };
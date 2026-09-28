/**
 * A deliberately small n8n executor.
 *
 * It exists so the measurement layer can be tested against the engine's REAL
 * behaviour instead of a hand-written copy of it. Every Code node's `jsCode` is
 * read out of the workflow JSON and executed verbatim; every IF condition,
 * googleSheets operation, emailSend parameter and respondToWebhook body is read
 * from the JSON too. If the engine changes, the harness changes with it — there
 * is no second copy of the business logic to drift.
 *
 * Execution model (n8n semantics, verified against the engine's own node
 * configuration — every Code node is typeVersion 2 with no `mode`, i.e.
 * `runOnceForAllItems`):
 *   - A node receives an ARRAY of items.
 *   - A Code node in runOnceForAllItems mode runs ONCE for that array, sees it
 *     through `$input`, may reference any other node's output with `$('X')`,
 *     and its return value REPLACES the whole array. This is why the engine's
 *     `$('Get Business Config').all()` lookups work while the workflow still
 *     emits exactly one item downstream.
 *   - Every other node type runs once PER ITEM, and its outputs concatenate.
 *   - A googleSheets `read` emits one item per row, which is what makes the
 *     engine's `.all()` lookups resolve.
 *   - emailSend with `onError: continueErrorOutput` routes success to output 0
 *     and failure to output 1.
 *
 * It is NOT a general n8n emulator. An unknown node type throws loudly rather
 * than guessing.
 */
import { SheetStore } from './sheet-store.js';
import { makeEvaluator } from './expression.js';
import { readSheetName } from './contract.js';

const CODE_ONCE_FOR_ALL = 'runOnceForAllItems';

export class ExecutionError extends Error {
  constructor(nodeName, cause) {
    super(`[${nodeName}] ${cause.message}`);
    this.nodeName = nodeName;
    this.cause = cause;
  }
}

export class Engine {
  /**
   * @param {object} wf parsed workflow JSON
   * @param {object} opts
   * @param {SheetStore} [opts.sheets]
   * @param {Record<string,string>} [opts.vars] n8n $vars
   * @param {Record<string,string>} [opts.env]  n8n $env
   * @param {() => number} [opts.now] clock, injectable for determinism
   * @param {(spec) => void} [opts.onEmail]
   * @param {(spec) => Error|null} [opts.emailFault] return an Error to fail a send
   */
  constructor(wf, opts = {}) {
    this.wf = wf;
    this.sheets = opts.sheets || new SheetStore();
    this.vars = opts.vars || {};
    this.env = opts.env || {};
    this.now = opts.now || (() => Date.now());
    this.onEmail = opts.onEmail || (() => {});
    this.emailFault = opts.emailFault || (() => null);
    this.emptyOutputHaltsBranch = opts.emptyOutputHaltsBranch !== false;
    this.outputs = new Map();
    this.outbox = [];
    this.responses = [];
    this.trace = [];
    this.executionId = `exec_${this.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  outputsOf(name) {
    return this.outputs.get(name) || [];
  }

  node(name) {
    const n = this.wf.nodes.find((x) => x.name === name);
    if (!n) throw new Error(`Unknown node "${name}" in ${this.wf.__file}`);
    return n;
  }

  triggerName() {
    const t = this.wf.nodes.find((n) =>
      ['n8n-nodes-base.webhook', 'n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.errorTrigger'].includes(n.type)
    );
    if (!t) throw new Error(`${this.wf.__file} has no trigger node`);
    return t.name;
  }

  get scope() {
    const self = this;
    return {
      $: (nodeName) => {
        const items = self.outputsOf(nodeName);
        if (items.length === 0) {
          throw new Error(`Referenced node "${nodeName}" has produced no output in this execution`);
        }
        return {
          first: () => items[0],
          last: () => items[items.length - 1],
          all: () => items,
          item: items[0]
        };
      },
      $execution: { id: self.executionId, mode: 'trigger', resumeUrl: '' },
      $vars: self.vars,
      $env: self.env,
      $workflow: { id: self.wf.id, name: self.wf.name, active: self.wf.active }
    };
  }

  ev() {
    return makeEvaluator(this.scope);
  }

  /* --- driver ------------------------------------------------------ */

  /** Run the workflow end to end from its trigger with one input payload. */
  runAll(inputJson) {
    const start = this.triggerName();
    this.outputs.set(start, [{ json: inputJson }]);
    this.trace.push({ node: start, type: this.node(start).type, in: 1 });

    let queue = [{ name: start, items: [{ json: inputJson }] }];
    const visited = new Set();
    let steps = 0;

    while (queue.length) {
      const { name, items } = queue.shift();
      const key = `${name}#${visited.size}`;
      visited.add(key);
      steps += 1;
      if (steps > 200) throw new Error(`Execution exceeded 200 steps (cycle?) in ${this.wf.__file}`);
      queue.push(...this.runNode(name, items));
    }
    return this;
  }

  /**
   * Execute one node for a whole item array. Returns queued downstream work:
   * `[{name, items}]` entries.
   */
  runNode(name, items) {
    const node = this.node(name);
    const p = node.parameters || {};
    const ev = this.ev();
    const record = (extra) => this.trace.push({ node: name, type: node.type, in: items.length, ...extra });

    switch (node.type) {
      case 'n8n-nodes-base.webhook':
      case 'n8n-nodes-base.scheduleTrigger':
      case 'n8n-nodes-base.errorTrigger':
        record({});
        return this.queue(node, 0, items);

      case 'n8n-nodes-base.code': {
        const mode = p.mode || CODE_ONCE_FOR_ALL;
        if (mode !== CODE_ONCE_FOR_ALL) {
          throw new Error(`Code node "${name}" uses mode "${mode}" — extend the harness, do not guess.`);
        }
        const out = this.runCode(p.jsCode, items);
        this.append(name, out);
        record({ out: out.length });
        return this.queue(node, 0, out);
      }

      case 'n8n-nodes-base.if': {
        const buckets = [[], []];
        for (const item of items) {
          const idx = ev.ifBranch(p.conditions, item.json);
          buckets[idx].push(item);
        }
        // A multi-output node still has an output as far as $('Node') is
        // concerned, so record the union (true branch first). n8n resolves
        // $('IF') against the node's emitted items; the two branches of a gate
        // in this engine always carry the same lead, so either is equivalent.
        this.append(name, [...buckets[0], ...buckets[1]]);
        record({ trueCount: buckets[0].length, falseCount: buckets[1].length });
        return [...this.queue(node, 0, buckets[0]), ...this.queue(node, 1, buckets[1])];
      }

      case 'n8n-nodes-base.noOp':
        this.append(name, items);
        record({});
        return this.queue(node, 0, items);

      case 'n8n-nodes-base.googleSheets': {
        const op = (p.operation || 'read').toString();
        let out;
        try {
          out = this.runSheets(node, p, op, items);
        } catch (e) {
          record({ op, failed: e.message });
          throw new ExecutionError(name, e);
        }
        this.append(name, out);
        record({ op, tab: readSheetName(node), out: out.length });
        return this.queue(node, 0, out);
      }

      case 'n8n-nodes-base.emailSend': {
        const ok = [];
        const failed = [];
        for (const item of items) {
          const spec = {
            node: name,
            to: String(ev.resolve(p.toEmail, item.json) || ''),
            from: ev.resolve(p.fromEmail, item.json),
            subject: ev.resolve(p.subject, item.json),
            body: ev.resolve(p.html, item.json),
            replyTo: p.options ? ev.resolve(p.options.replyTo, item.json) : ''
          };
          const fault = this.emailFault(spec);
          if (fault) {
            this.outbox.push({ ...spec, sent: false, error: fault.message });
            // n8n hands a failed node's error to the error branch as
            // `{ error: { message, name } }`. Without this the
            // `Build * Email Error Record` nodes could never read a message and
            // every row recorded "unknown email error".
            failed.push({
              ...item,
              json: {
                ...item.json,
                error: { message: fault.message, name: fault.name || 'Error' },
                _emailError: fault.message,
                _emailNode: name
              }
            });
          } else {
            this.outbox.push({ ...spec, sent: true });
            this.onEmail(spec);
            ok.push(item);
          }
        }
        record({ sent: ok.length, failed: failed.length });
        const continueOnError = (node.onError || '') === 'continueErrorOutput';
        return [...this.queue(node, 0, ok), ...(continueOnError ? this.queue(node, 1, failed) : [])];
      }

      case 'n8n-nodes-base.respondToWebhook': {
        for (const item of items) {
          const code = p.options && p.options.responseCode ? p.options.responseCode : 200;
          this.responses.push({ node: name, code, body: ev.resolve(p.responseBody, item.json) });
        }
        record({ response: items.length });
        return [];
      }

      default:
        throw new Error(`Harness has no executor for node type "${node.type}" (${name}). Extend the harness; do not guess.`);
    }
  }

  /**
   * Queue the downstream node(s) on connection output `index`, if any items.
   *
   * `emptyOutputHaltsBranch` models n8n's rule that a node producing zero items
   * does not execute its downstream nodes. Left at its faithful default of true.
   * It is switchable ONLY so a live experiment can settle the behaviour on a
   * genuinely empty tab; the measurement layer never depends on it.
   */
  queue(node, index, items) {
    if (!items || items.length === 0) {
      if (this.emptyOutputHaltsBranch) return [];
      items = items && items.length ? items : this.lastItems || [];
      if (items.length === 0) return [];
    }
    const conns = this.wf.connections[node.name];
    if (!conns || !conns.main) return [];
    const targets = conns.main[index];
    if (!targets || targets.length === 0) return [];
    this.lastItems = items;
    return targets.map((t) => ({ name: t.node, items }));
  }

  append(name, items) {
    if (!this.outputs.has(name)) this.outputs.set(name, []);
    this.outputs.get(name).push(...items);
  }

  runCode(jsCode, items) {
    const $ = this.scope.$;
    const $input = {
      all: () => items,
      first: () => items[0],
      last: () => items[items.length - 1],
      item: items[0]
    };
    const newFunction = new Function('$', '$input', '$execution', '$vars', '$env', '$workflow', jsCode); // eslint-disable-line no-new-func
    let out;
    try {
      out = newFunction($, $input, this.scope.$execution, this.vars, this.env, this.scope.$workflow);
    } catch (e) {
      throw new ExecutionError('code', e);
    }
    const arr = Array.isArray(out) ? out : [out];
    return arr.map((o) => (o && o.json !== undefined ? o : { json: o }));
  }

  /**
   * Read a googleSheets node's column mapping. n8n has two serialisations in
   * use inside this engine and both are supported:
   *   v4 classic  fieldsUi.values[] | fieldsUi.fieldValues[]
   *   v4 mapping  columns.value{} plus columns.matchingColumns[]
   */
  sheetsMapping(p) {
    if (p.fieldsUi && Array.isArray(p.fieldsUi.values)) {
      return {
        match: p.columnToMatchOn,
        values: p.fieldsUi.values.map((v) => [v.column, v.fieldValue])
      };
    }
    if (p.fieldsUi && Array.isArray(p.fieldsUi.fieldValues)) {
      return {
        match: p.columnToMatchOn,
        values: p.fieldsUi.fieldValues.map((v) => [v.fieldId, v.fieldValue])
      };
    }
    if (p.columns && p.columns.value && typeof p.columns.value === 'object') {
      const values = Object.entries(p.columns.value).filter(([k]) => k !== 'row_number');
      return {
        match: p.columnToMatchOn || (p.columns.matchingColumns || [])[0],
        values
      };
    }
    return null;
  }

  runSheets(node, p, op, items) {
    const ev = this.ev();
    const tab = readSheetName(node);
    if (!['leads', 'bookings', 'status_updates', 'errors', 'business_config'].includes(tab)) {
      throw new Error(`Harness has no header contract for tab "${tab}" (${node.name})`);
    }

    if (op === 'read') {
      return this.sheets.read(tab).map((row) => ({ json: row }));
    }

    const map = this.sheetsMapping(p);
    // n8n's `append` accepts a node with NO column mapping and writes a row of
    // empty cells. The engine has two such nodes (see FINDINGS.md F10), so this
    // must not throw. `update` genuinely cannot work without a mapping.
    if (!map && op !== 'append') {
      throw new Error(`Harness cannot read the ${op} mapping for ${node.name}`);
    }

    const out = [];
    for (const item of items) {
      const values = {};
      if (map) for (const [col, expr] of map.values) values[col] = ev.resolve(expr, item.json);
      if (op === 'append') {
        out.push(...this.sheets.append(tab, values));
      } else if (op === 'update') {
        if (!map) throw new Error(`Harness cannot read the update mapping for ${node.name}`);
        if (!map.match) throw new Error(`Harness needs a match column for ${node.name}`);
        // In the v4 `columns` mapping mode there is no separate valueToMatchOn:
        // the value written to the matching column is also the value matched on.
        const raw = p.valueToMatchOn !== undefined && p.valueToMatchOn !== null
          ? ev.resolve(p.valueToMatchOn, item.json)
          : values[map.match];
        if (raw === undefined || raw === null || raw === '') {
          throw new Error(`Harness could not resolve the match value for ${node.name} on column "${map.match}"`);
        }
        out.push(...this.sheets.update(tab, map.match, String(raw), values));
      } else {
        throw new Error(`Harness has no executor for googleSheets operation "${op}" (${node.name})`);
      }
    }
    return out;
  }

  /** The last webhook response, or null if the workflow never responded. */
  response() {
    return this.responses.length ? this.responses[this.responses.length - 1] : null;
  }
}

export function runWorkflowFile(wf, inputJson, opts = {}) {
  return new Engine(wf, opts).runAll(inputJson);
}

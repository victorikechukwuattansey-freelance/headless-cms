/**
 * Expression evaluation for n8n parameter values.
 *
 * Supports exactly the two forms the engine uses:
 *   1. whole-string expression  "={{ expr }}"        -> raw JS value
 *   2. literal with moustache   "=a {{ expr }} b"   -> string interpolation
 *
 * Operators are limited to the three the engine's IF nodes actually declare
 * (boolean/true, string/equals, string/notEmpty) — proven exhaustively by
 * tests/workflow-contract.test.js. An unrecognised operator throws rather than
 * silently returning true, so a future engine edit can never be quietly
 * mis-simulated.
 */

export function isExpression(v) {
  return typeof v === 'string' && v.startsWith('=');
}

export function makeEvaluator(scope) {
  const PARAM_NAMES = ['$', '$json', '$node', '$execution', '$vars', '$env', '$workflow'];
  const compile = (expr) => {
    const body = '\nreturn (' + expr + ');\n';
    return new Function(...PARAM_NAMES, body);
  };

  function evalExpr(expr, json) {
    const fn = compile(expr);
    return fn(scope.$, json, scope.node, scope.$execution, scope.$vars, scope.$env, scope.$workflow);
  }

  const WHOLE = /^\s*\{\{([\s\S]+)\}\}\s*$/;
  const HOLE = /\{\{([\s\S]+?)\}\}/g;

  return {
    /**
     * Resolve a parameter value into a real JS value, using n8n's rule:
     *  - `=...` marks an expression.
     *  - A value that is exactly one `{{ ... }}` returns the evaluated value
     *    with its type preserved (so object literals stay objects).
     *  - Anything else interpolates each `{{ ... }}` hole into a string.
     */
    resolve(value, json) {
      if (typeof value !== 'string') return value;
      if (!value.startsWith('=')) return value;

      const body = value.slice(1);
      const whole = WHOLE.exec(body);
      if (whole) return evalExpr(whole[1].trim(), json);

      HOLE.lastIndex = 0;
      return body.replace(HOLE, (_m, expr) => {
        const v = evalExpr(expr.trim(), json);
        return v === undefined || v === null ? '' : String(v);
      });
    },

    /** n8n boolean-ish coercion (typeValidation: strict still accepts 'true'/'false'). */
    truthy(v) {
      if (v === true) return true;
      if (typeof v === 'string') return v.trim().toLowerCase() === 'true';
      if (typeof v === 'number') return v === 1;
      return false;
    },

    notEmpty(v) {
      if (v === undefined || v === null) return false;
      if (typeof v === 'string') return v.trim() !== '';
      if (Array.isArray(v)) return v.length > 0;
      return true;
    },

    /**
     * Evaluate an IF node's condition set. Returns the output index (0 = true,
     * 1 = false) exactly as n8n wires it.
     *
     * Both IF serialisations appear in the engine and both are supported:
     *   v2/v3  { conditions: { conditions: [{leftValue,rightValue,operator}], combinator } }
     *   v1     { conditions: { boolean: [{value1,operation,value2}], combinator } }
     */
    ifBranch(conditions, json) {
      if (!conditions) throw new Error('IF node with no conditions object');
      if (Array.isArray(conditions.conditions)) return this._evalV2(conditions, json);
      if (Array.isArray(conditions.boolean)) return this._evalV1(conditions, json);
      throw new Error(`Harness cannot read IF condition shape (keys: ${Object.keys(conditions).join(', ')})`);
    },

    _evalV2(conditions, json) {
      const list = conditions.conditions || [];
      const combinator = (conditions.combinator || 'and').toLowerCase();
      const results = list.map((c) => {
        const left = this.resolve(c.leftValue, json);
        const op = c.operator || {};
        const key = `${op.type}/${op.operation}`;
        switch (key) {
          case 'boolean/true':
            return this.truthy(left);
          case 'string/equals': {
            const right = this.resolve(c.rightValue, json);
            if (left === undefined || left === null) return false;
            return String(left) === String(right);
          }
          case 'string/notEmpty':
            return this.notEmpty(left);
          default:
            throw new Error(`Harness cannot evaluate IF operator "${key}" — extend the harness rather than guessing.`);
        }
      });
      if (results.length === 0) throw new Error('IF node with no conditions');
      const passed = combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
      return passed ? 0 : 1;
    },

    _evalV1(conditions, json) {
      const list = conditions.boolean || [];
      const combinator = (conditions.combinator || 'and').toLowerCase();
      const results = list.map((c) => {
        const left = this.resolve(c.value1, json);
        switch (c.operation) {
          case 'isTrue':
            return this.truthy(left);
          case 'isNotTrue':
            return !this.truthy(left);
          case 'isEmpty':
            return !this.notEmpty(left);
          case 'isNotEmpty':
            return this.notEmpty(left);
          case 'equals':
            return String(left) === String(this.resolve(c.value2, json));
          case 'notEquals':
            return String(left) !== String(this.resolve(c.value2, json));
          case 'contains':
            return String(left ?? '').includes(String(this.resolve(c.value2, json) ?? ''));
          default:
            throw new Error(`Harness cannot evaluate v1 IF operation "${c.operation}" — extend the harness rather than guessing.`);
        }
      });
      if (results.length === 0) throw new Error('IF node with no v1 conditions');
      const passed = combinator === 'or' ? results.some(Boolean) : results.every(Boolean);
      return passed ? 0 : 1;
    }
  };
}

/**
 * Expression resolution for `{{path.to.value}}` syntax.
 * Path root: a node key, `input`, `trigger`, or `workflow`.
 * Supports array indexes: `{{list.0.name}}` and JSON path segments.
 */
function resolvePath(path: string, root: Record<string, unknown>): unknown {
  const segments = path.split(".").filter((s) => s.length > 0);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
      continue;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
      continue;
    }
    return undefined;
  }
  return current;
}

export function resolveExpression(expression: string, root: Record<string, unknown>): unknown {
  const trimmed = expression.trim();
  if (!trimmed.startsWith("{{") || !trimmed.endsWith("}}")) {
    return expression;
  }
  return resolvePath(trimmed.slice(2, -2).trim(), root);
}

export function resolveTemplate(template: string, root: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path: string) => {
    const value = resolvePath(path.trim(), root);
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Recursively resolve `{{...}}` expressions inside a config object.
 * Leaves that are pure expressions resolve to their typed value (not stringified).
 */
export function resolveConfig(config: Record<string, unknown>, root: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("{{") && trimmed.endsWith("}}") && (trimmed.match(/\{\{/g)?.length ?? 0) === 1) {
        result[key] = resolveExpression(trimmed, root);
      } else {
        result[key] = resolveTemplate(value, root);
      }
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "object" && item !== null
          ? resolveConfig(item as Record<string, unknown>, root)
          : typeof item === "string"
            ? resolveTemplate(item, root)
            : item,
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = resolveConfig(value as Record<string, unknown>, root);
    } else {
      result[key] = value;
    }
  }
  return result;
}

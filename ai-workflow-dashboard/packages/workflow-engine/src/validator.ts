import type { EngineGraph, ValidationIssue, ValidationResult } from "./types";

export function validateGraph(graph: EngineGraph, knownNodeTypes: ReadonlySet<string>): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeKeys = new Set<string>();

  for (const node of graph.nodes) {
    if (nodeKeys.has(node.id)) {
      issues.push({ code: "DUPLICATE_NODE_ID", message: `Duplicate node id: ${node.id}`, nodeKey: node.id });
    }
    nodeKeys.add(node.id);
  }

  for (const node of graph.nodes) {
    if (!knownNodeTypes.has(node.nodeType)) {
      issues.push({
        code: "UNKNOWN_NODE_TYPE",
        message: `Node '${node.id}' uses unknown type '${node.nodeType}'`,
        nodeKey: node.id,
      });
    }
  }

  for (const conn of graph.connections) {
    if (!nodeKeys.has(conn.sourceNode)) {
      issues.push({
        code: "MISSING_SOURCE",
        message: `Connection references missing source node '${conn.sourceNode}'`,
      });
    }
    if (!nodeKeys.has(conn.targetNode)) {
      issues.push({
        code: "MISSING_TARGET",
        message: `Connection references missing target node '${conn.targetNode}'`,
      });
    }
  }

  // Cycle detection (Kahn's algorithm)
  const incoming = new Map<string, number>();
  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
  }
  for (const conn of graph.connections) {
    if (nodeKeys.has(conn.sourceNode) && nodeKeys.has(conn.targetNode)) {
      incoming.set(conn.targetNode, (incoming.get(conn.targetNode) ?? 0) + 1);
    }
  }
  const queue = [...incoming.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const conn of graph.connections) {
      if (conn.sourceNode === current && nodeKeys.has(conn.targetNode)) {
        const next = (incoming.get(conn.targetNode) ?? 1) - 1;
        incoming.set(conn.targetNode, next);
        if (next === 0) {
          queue.push(conn.targetNode);
        }
      }
    }
  }
  if (visited < graph.nodes.length) {
    const cyclic = [...incoming.entries()].filter(([, count]) => count > 0).map(([id]) => id);
    issues.push({
      code: "CIRCULAR_DEPENDENCY",
      message: `Circular dependency detected involving nodes: ${cyclic.join(", ")}`,
    });
  }

  if (graph.nodes.length === 0) {
    issues.push({ code: "EMPTY_GRAPH", message: "Workflow contains no nodes" });
  }

  return { valid: issues.length === 0, issues };
}

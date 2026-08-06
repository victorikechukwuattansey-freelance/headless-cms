"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type FlowNode = Node<{
  nodeType: string;
  configuration: Record<string, unknown>;
  label?: React.ReactNode;
}>;
export type FlowEdge = Edge;

interface WorkflowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[], dirty: boolean) => void;
  onEdgesChange: (edges: FlowEdge[], dirty: boolean) => void;
  onConnect: (edge: FlowEdge) => void;
  onNodeClick: (node: FlowNode) => void;
  onPaneClick: () => void;
}

export default function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
}: WorkflowCanvasProps) {
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes) as FlowNode[];
      const dirty = changes.some((c) => (c.type === "position" && !c.dragging) || c.type === "remove");
      onNodesChange(next, dirty);
    },
    [nodes, onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, edges);
      onEdgesChange(next, changes.some((c) => c.type === "remove"));
    },
    [edges, onEdgesChange],
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      const edge: FlowEdge = {
        id: `edge-${Date.now()}`,
        source: conn.source ?? "",
        target: conn.target ?? "",
        animated: true,
        style: { stroke: "#64748b" },
      };
      onConnect(edge);
    },
    [onConnect],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onNodeClick={(_, node) => onNodeClick(node as FlowNode)}
      onPaneClick={onPaneClick}
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
    >
      <Background color="#334155" gap={24} />
      <Controls />
      <MiniMap className="!bg-slate-900" nodeColor="#312e81" maskColor="rgba(15,23,42,0.7)" />
    </ReactFlow>
  );
}

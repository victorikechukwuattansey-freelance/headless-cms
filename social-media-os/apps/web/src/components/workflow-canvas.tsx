'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Play, Zap, Webhook, Clock } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge } from '@/types';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  className?: string;
}

const nodeColors = {
  trigger: 'border-green-500 bg-green-50 dark:bg-green-950',
  action: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  condition: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
};

const nodeIcons = {
  trigger: Zap,
  action: Play,
  condition: Webhook,
};

export function WorkflowCanvas({ nodes, edges, onNodesChange, onEdgesChange, className }: WorkflowCanvasProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    setDragging(nodeId);
    const startX = e.clientX;
    const startY = e.clientY;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const handleMouseMove = (me: MouseEvent) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      const updated = nodes.map((n) =>
        n.id === nodeId
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      );
      onNodesChange(updated);
    };

    const handleMouseUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [nodes, onNodesChange]);

  const addNode = (type: WorkflowNode['type']) => {
    const newId = `node-${Date.now()}`;
    const label = type === 'trigger' ? 'New Trigger' : type === 'action' ? 'New Action' : 'New Condition';
    const newNode: WorkflowNode = {
      id: newId,
      type,
      label,
      config: {},
      position: { x: 100 + nodes.length * 220, y: 200 },
    };
    onNodesChange([...nodes, newNode]);
  };

  const deleteNode = (nodeId: string) => {
    onNodesChange(nodes.filter((n) => n.id !== nodeId));
    onEdgesChange(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
  };

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => addNode('trigger')}>
          <Zap className="h-3 w-3 mr-1" /> Add Trigger
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('action')}>
          <Play className="h-3 w-3 mr-1" /> Add Action
        </Button>
        <Button variant="outline" size="sm" onClick={() => addNode('condition')}>
          <Webhook className="h-3 w-3 mr-1" /> Add Condition
        </Button>
      </div>

      <div
        ref={canvasRef}
        className="relative min-h-[400px] rounded-xl border bg-card bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:20px_20px]"
      >
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Drag nodes here or use the buttons above to build your workflow
          </div>
        )}

        {/* Connection lines */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {edges.map((edge) => {
            const source = nodes.find((n) => n.id === edge.source);
            const target = nodes.find((n) => n.id === edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={edge.id}
                x1={source.position.x + 150}
                y1={source.position.y + 40}
                x2={target.position.x + 10}
                y2={target.position.y + 40}
                stroke="hsl(var(--border))"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
            );
          })}
        </svg>

        {nodes.map((node) => {
          const Icon = nodeIcons[node.type];
          return (
            <div
              key={node.id}
              className={cn(
                'absolute flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing',
                dragging === node.id && 'opacity-80'
              )}
              style={{
                left: node.position.x,
                top: node.position.y,
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(node.id, e)}
            >
              <div
                className={cn(
                  'w-72 rounded-lg border-2 p-3 shadow-sm transition-shadow hover:shadow-md',
                  nodeColors[node.type]
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium capitalize">{node.type}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-xs font-medium mb-1">{node.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {node.type === 'trigger' ? 'Fires when event occurs' : 'Executes this action'}
                </p>
              </div>
              <div className="h-2 w-0.5 bg-border" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

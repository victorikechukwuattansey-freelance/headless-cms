'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { WorkflowCanvas } from '@/components/workflow-canvas';
import { GitBranch, Plus, Play, Pause, Clock, Zap, Webhook, MoreHorizontal } from 'lucide-react';
import type { WorkflowNode, WorkflowEdge } from '@/types';

const initialNodes: WorkflowNode[] = [
  { id: 'trigger-1', type: 'trigger', label: 'New Post Published', config: {}, position: { x: 80, y: 80 } },
  { id: 'action-1', type: 'action', label: 'Post to Social Platforms', config: {}, position: { x: 380, y: 80 } },
  { id: 'action-2', type: 'action', label: 'Send Notification', config: {}, position: { x: 380, y: 220 } },
];

const initialEdges: WorkflowEdge[] = [
  { id: 'e1', source: 'trigger-1', target: 'action-1' },
  { id: 'e2', source: 'action-1', target: 'action-2' },
];

export default function WorkflowsPage() {
  const [workflows] = useState([
    { id: '1', name: 'Auto-Crosspost', description: 'When a post is published, crosspost to all connected platforms', isActive: true, lastRun: '2h ago', trigger: 'Post Published' },
    { id: '2', name: 'Content Approval', description: 'Route posts through approval chain before publishing', isActive: false, lastRun: '1d ago', trigger: 'New Draft Created' },
    { id: '3', name: 'Engagement Alert', description: 'Get notified when engagement spikes on any platform', isActive: true, lastRun: '30m ago', trigger: 'Engagement Threshold' },
  ]);

  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialEdges);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-brand-terracotta" />
          <div>
            <h1 className="text-2xl font-bold">Workflows</h1>
            <p className="text-sm text-muted-foreground">Automate your social media processes</p>
          </div>
        </div>
        <Button onClick={() => { setShowCanvas(true); setSelectedWorkflow('new'); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {showCanvas ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedWorkflow === 'new' ? 'New Workflow' : 'Edit Workflow'}
              </h2>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCanvas(false)}>Cancel</Button>
              <Button>Save Workflow</Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workflow Name</Label>
                  <Input placeholder="e.g., Auto-Crosspost" defaultValue="New Workflow" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <div className="flex gap-2">
                    {[
                      { value: 'schedule', label: 'Schedule', icon: Clock },
                      { value: 'event', label: 'Event', icon: Zap },
                      { value: 'webhook', label: 'Webhook', icon: Webhook },
                    ].map((t) => (
                      <Button key={t.value} variant="outline" className="flex-1 gap-1">
                        <t.icon className="h-3 w-3" />
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Card key={wf.id} className="group cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">{wf.name}</CardTitle>
                    <CardDescription className="text-xs">{wf.description}</CardDescription>
                  </div>
                  <Switch checked={wf.isActive} onCheckedChange={() => {}} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {wf.trigger}
                  </div>
                  <span>Last run: {wf.lastRun}</span>
                </div>
                <div className="mt-3 flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowCanvas(true)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs">
                    {wf.isActive ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                    {wf.isActive ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plug, Plus, Link2, Unlink, Server, Settings2, Key, Check, X } from 'lucide-react';

interface MCPServerItem {
  id: string;
  name: string;
  description: string;
  url: string;
  isConnected: boolean;
  tools: number;
}

const sampleServers: MCPServerItem[] = [
  { id: '1', name: 'PostEverywhere', description: 'Cross-platform publishing API', url: 'https://api.posteverywhere.dev', isConnected: true, tools: 5 },
  { id: '2', name: 'Analytics Engine', description: 'Social media analytics provider', url: 'https://analytics.internal:4000', isConnected: true, tools: 3 },
  { id: '3', name: 'AI Content', description: 'AI-powered content generation', url: 'https://ai.internal:5000', isConnected: false, tools: 8 },
];

export default function MCPSettingsPage() {
  const [servers, setServers] = useState<MCPServerItem[]>(sampleServers);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newApiKey, setNewApiKey] = useState('');

  const addServer = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const newServer: MCPServerItem = {
      id: `mcp-${Date.now()}`,
      name: newName,
      description: newDescription,
      url: newUrl,
      isConnected: false,
      tools: 0,
    };
    setServers([...servers, newServer]);
    setShowAdd(false);
    setNewName('');
    setNewUrl('');
    setNewDescription('');
    setNewApiKey('');
  };

  const toggleConnection = (id: string) => {
    setServers(servers.map((s) =>
      s.id === id ? { ...s, isConnected: !s.isConnected } : s
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Plug className="h-6 w-6" />
          <div>
            <h1 className="text-2xl font-bold">MCP Servers</h1>
            <p className="text-sm text-muted-foreground">Connect external tools and services via MCP protocol</p>
          </div>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Server
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add MCP Server</DialogTitle>
              <DialogDescription>Connect to an MCP-compatible server for extended functionality</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Server Name</Label>
                <Input placeholder="e.g., PostEverywhere" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Server URL</Label>
                <Input placeholder="https://api.example.com/mcp" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="What does this server do?" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>API Key (optional)</Label>
                <Input type="password" placeholder="sk-..." value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button onClick={addServer}>Add Server</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {servers.map((server) => (
          <Card key={server.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg p-2 ${server.isConnected ? 'bg-green-50 dark:bg-green-950' : 'bg-muted'}`}>
                    <Server className={`h-5 w-5 ${server.isConnected ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{server.name}</h3>
                      <Badge variant={server.isConnected ? 'success' : 'secondary'}>
                        {server.isConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                      <Badge variant="outline">{server.tools} tools</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{server.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Link2 className="h-3 w-3" />
                      {server.url}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={server.isConnected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => toggleConnection(server.id)}
                  >
                    {server.isConnected ? (
                      <><Unlink className="h-3 w-3 mr-1" /> Disconnect</>
                    ) : (
                      <><Link2 className="h-3 w-3 mr-1" /> Connect</>
                    )}
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {server.isConnected && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Available Tools</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Array.from({ length: server.tools }).map((_, i) => (
                      <div key={i} className="rounded-md border p-2 text-xs">
                        <p className="font-medium">tool_{i + 1}</p>
                        <p className="text-muted-foreground">Description for tool {i + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, Building2, Users, Flag, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const sampleOrgs = [
  { id: '1', name: 'Acme Corp', slug: 'acme-corp', users: 12, tier: 'pro', status: 'active' as const },
  { id: '2', name: 'Global Media', slug: 'global-media', users: 8, tier: 'agency', status: 'active' as const },
  { id: '3', name: 'Startup XYZ', slug: 'startup-xyz', users: 3, tier: 'free', status: 'suspended' as const },
  { id: '4', name: 'Digital Agency', slug: 'digital-agency', users: 25, tier: 'enterprise', status: 'active' as const },
  { id: '5', name: 'Test Org', slug: 'test-org', users: 2, tier: 'starter', status: 'active' as const },
];

const featureFlags = [
  { key: 'ai-studio', name: 'AI Studio', enabled: true, description: 'AI content generation features' },
  { key: 'workflows', name: 'Workflows', enabled: true, description: 'Automation workflow builder' },
  { key: 'analytics-advanced', name: 'Advanced Analytics', enabled: false, description: 'Advanced analytics with custom reports' },
  { key: 'mcp-integrations', name: 'MCP Integrations', enabled: true, description: 'External MCP server connections' },
  { key: 'white-label', name: 'White Label', enabled: false, description: 'White-label branding options' },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-brand-terracotta" />
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">System administration and management</p>
        </div>
      </div>

      <Tabs defaultValue="orgs">
        <TabsList>
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organizations</CardTitle>
              <CardDescription>Manage all organizations on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {sampleOrgs.map((org) => (
                  <div key={org.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug} • {org.users} users</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{org.tier}</Badge>
                      <Badge variant={org.status === 'active' ? 'success' : 'destructive'} className="capitalize">
                        {org.status}
                      </Badge>
                      <Button variant="ghost" size="sm">Manage</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>View and manage platform users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-8 justify-center text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">User management interface would appear here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature Flags</CardTitle>
              <CardDescription>Enable or disable platform features globally</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {featureFlags.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{flag.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{flag.description}</p>
                  </div>
                  <Switch checked={flag.enabled} onCheckedChange={() => {}} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">API Status</span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="mt-2 text-lg font-semibold">Operational</p>
                <p className="text-xs text-muted-foreground">99.9% uptime this month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Database</span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="mt-2 text-lg font-semibold">Healthy</p>
                <p className="text-xs text-muted-foreground">45ms avg query time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI Services</span>
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                </div>
                <p className="mt-2 text-lg font-semibold">Degraded</p>
                <p className="text-xs text-muted-foreground">Increased latency detected</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">System Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Active Users', value: '847', change: '+12%' },
                { label: 'Total Posts', value: '12,450', change: '+8%' },
                { label: 'API Requests/min', value: '2,340', change: '+5%' },
                { label: 'Error Rate', value: '0.02%', change: '-0.01%' },
              ].map((metric) => (
                <div key={metric.label} className="flex items-center justify-between">
                  <span className="text-sm">{metric.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{metric.value}</span>
                    <span className="text-xs text-green-600">{metric.change}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

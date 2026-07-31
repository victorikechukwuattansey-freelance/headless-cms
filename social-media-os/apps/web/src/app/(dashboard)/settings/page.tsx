'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Users, CreditCard, Link, Plug, Trash2, Plus } from 'lucide-react';

const teamMembers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Owner', avatar: null },
  { id: '2', name: 'Sarah Wilson', email: 'sarah@example.com', role: 'Admin', avatar: null },
  { id: '3', name: 'Mike Chen', email: 'mike@example.com', role: 'Editor', avatar: null },
  { id: '4', name: 'Emily Park', email: 'emily@example.com', role: 'Viewer', avatar: null },
];

const connectedAccounts = [
  { platform: 'Twitter', handle: '@smohq', status: 'connected' },
  { platform: 'Instagram', handle: 'smo_hq', status: 'connected' },
  { platform: 'LinkedIn', handle: 'Social Media OS', status: 'connected' },
  { platform: 'Facebook', handle: 'SocialMediaOS', status: 'expired' },
  { platform: 'TikTok', handle: '@smohq', status: 'disconnected' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your workspace and account settings</p>
        </div>
      </div>

      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="accounts">Connected Accounts</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="mcp">MCP Servers</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace Settings</CardTitle>
              <CardDescription>Manage your workspace name and details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input defaultValue="My Agency" />
                </div>
                <div className="space-y-2">
                  <Label>Workspace Slug</Label>
                  <Input defaultValue="my-agency" />
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive email updates about your posts</p>
                </div>
                <Switch checked={true} onCheckedChange={() => {}} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Weekly Digest</p>
                  <p className="text-xs text-muted-foreground">Get a weekly performance report</p>
                </div>
                <Switch checked={false} onCheckedChange={() => {}} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI Suggestions</p>
                  <p className="text-xs text-muted-foreground">Show AI content suggestions on dashboard</p>
                </div>
                <Switch checked={true} onCheckedChange={() => {}} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Team Members</CardTitle>
                  <CardDescription>Manage who has access to this workspace</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={member.avatar} alt={member.name} fallback={member.name.charAt(0)} />
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'Owner' ? 'default' : 'secondary'}>
                        {member.role}
                      </Badge>
                      {member.role !== 'Owner' && (
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Accounts</CardTitle>
              <CardDescription>Manage your social media platform connections</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {connectedAccounts.map((account) => (
                  <div key={account.platform} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold uppercase">
                        {account.platform[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{account.platform}</p>
                        <p className="text-xs text-muted-foreground">{account.handle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={account.status === 'connected' ? 'success' : account.status === 'expired' ? 'warning' : 'secondary'}
                        className="capitalize"
                      >
                        {account.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        {account.status === 'disconnected' ? 'Connect' : 'Reconnect'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Plan</CardTitle>
              <CardDescription>You are on the Pro plan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">Pro Plan</p>
                    <p className="text-sm text-muted-foreground">$29/month • 5 team members • 20 connected accounts</p>
                  </div>
                  <Badge variant="default">Current</Badge>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Team Members</span>
                  <span className="font-medium">4 / 5</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-4/5 rounded-full bg-brand-terracotta" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline">Change Plan</Button>
                <Button variant="outline" className="text-red-500">Cancel Subscription</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Configure MCP servers on the{' '}
                <a href="/settings/mcp" className="text-primary hover:underline font-medium">
                  MCP Servers page
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

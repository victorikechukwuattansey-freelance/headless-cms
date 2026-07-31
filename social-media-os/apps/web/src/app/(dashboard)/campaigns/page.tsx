'use client';

import { useState } from 'react';
import { Platform } from '@social-media-os/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlatformSelector } from '@/components/platform-selector';
import { Flag, Plus, Calendar, BarChart3, MoreHorizontal } from 'lucide-react';
import { PLATFORM_LABELS } from '@/lib/constants';

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  platforms: Platform[];
  startDate: string;
  endDate: string | null;
  posts: number;
  engagement: number;
}

const sampleCampaigns: Campaign[] = [
  { id: '1', name: 'Summer Launch 2026', description: 'Product launch campaign across all platforms', status: 'active', platforms: [Platform.INSTAGRAM, Platform.TWITTER, Platform.TIKTOK], startDate: '2026-06-01', endDate: '2026-08-31', posts: 24, engagement: 12450 },
  { id: '2', name: 'Brand Awareness Q3', description: 'Increase brand visibility on LinkedIn and Twitter', status: 'draft', platforms: [Platform.LINKEDIN, Platform.TWITTER], startDate: '2026-07-01', endDate: '2026-09-30', posts: 0, engagement: 0 },
  { id: '3', name: 'Holiday Campaign 2026', description: 'End-of-year festive content series', status: 'draft', platforms: [Platform.FACEBOOK, Platform.INSTAGRAM, Platform.PINTEREST], startDate: '2026-11-15', endDate: '2026-12-31', posts: 0, engagement: 0 },
  { id: '4', name: 'Customer Stories', description: 'Testimonial-based content campaign', status: 'active', platforms: [Platform.LINKEDIN, Platform.TWITTER], startDate: '2026-05-01', endDate: null, posts: 12, engagement: 3450 },
];

const statusColors: Record<string, 'default' | 'success' | 'secondary' | 'destructive'> = {
  active: 'success',
  draft: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

export default function CampaignsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPlatforms, setNewPlatforms] = useState<Platform[]>([]);
  const [newStatus, setNewStatus] = useState('draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Plan and manage your marketing campaigns</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input placeholder="e.g., Summer Launch 2026" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="What is this campaign about?" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} />
              </div>
              <PlatformSelector selected={newPlatforms} onChange={setNewPlatforms} />
              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button>Create Campaign</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Campaigns</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {sampleCampaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <Badge variant={statusColors[campaign.status]} className="capitalize">
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {campaign.startDate} {campaign.endDate ? `- ${campaign.endDate}` : '(ongoing)'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        {campaign.posts} posts
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {campaign.engagement.toLocaleString()} engagements
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {campaign.platforms.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px]">
                          {PLATFORM_LABELS[p]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="active">
          <div className="space-y-4">
            {sampleCampaigns.filter((c) => c.status === 'active').map((campaign) => (
              <Card key={campaign.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{campaign.name}</h3>
                      <p className="text-sm text-muted-foreground">{campaign.description}</p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="draft">
          <div className="space-y-4">
            {sampleCampaigns.filter((c) => c.status === 'draft').map((campaign) => (
              <Card key={campaign.id} className="opacity-70">
                <CardContent className="p-4">
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <p className="text-sm text-muted-foreground">{campaign.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <p className="text-sm text-muted-foreground py-8 text-center">No completed campaigns yet.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

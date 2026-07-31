'use client';

import { useState } from 'react';
import { Platform } from '@social-media-os/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AnalyticsChart } from '@/components/analytics-chart';
import { Badge } from '@/components/ui/badge';
import { PLATFORM_LABELS, PLATFORM_COLORS } from '@/lib/constants';
import { BarChart3, TrendingUp, Users, MessageCircle, Eye, Download, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const periodData = {
  '7d': [
    { name: 'Mon', followers: 120, impressions: 5400, engagement: 450, reach: 3800 },
    { name: 'Tue', followers: 135, impressions: 6200, engagement: 520, reach: 4500 },
    { name: 'Wed', followers: 110, impressions: 5800, engagement: 480, reach: 4100 },
    { name: 'Thu', followers: 158, impressions: 7100, engagement: 610, reach: 5200 },
    { name: 'Fri', followers: 142, impressions: 6800, engagement: 590, reach: 5000 },
    { name: 'Sat', followers: 98, impressions: 4300, engagement: 380, reach: 3100 },
    { name: 'Sun', followers: 105, impressions: 4900, engagement: 410, reach: 3500 },
  ],
};

const platformMetrics = [
  { platform: Platform.INSTAGRAM, followers: 5230, growth: 8.2, engagement: 4.8, posts: 45 },
  { platform: Platform.TWITTER, followers: 3840, growth: 3.1, engagement: 2.1, posts: 78 },
  { platform: Platform.LINKEDIN, followers: 2100, growth: 12.5, engagement: 5.2, posts: 24 },
  { platform: Platform.FACEBOOK, followers: 1677, growth: -1.2, engagement: 1.8, posts: 32 },
  { platform: Platform.TIKTOK, followers: 890, growth: 24.3, engagement: 7.5, posts: 15 },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('7d');
  const [platformFilter, setPlatformFilter] = useState('all');

  const data = periodData[period as keyof typeof periodData] || periodData['7d'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your social media performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={[
              { value: '7d', label: 'Last 7 days' },
              { value: '30d', label: 'Last 30 days' },
              { value: '90d', label: 'Last 90 days' },
            ]}
            className="w-32"
          />
          <Select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            options={[
              { value: 'all', label: 'All Platforms' },
              ...Object.entries(PLATFORM_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
            className="w-40"
          />
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Followers</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">13,737</p>
            <div className="mt-1 flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-0.5" /> +5.2% this period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Impressions</span>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">40,400</p>
            <div className="mt-1 flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-0.5" /> +12.8% this period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Engagement Rate</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">4.2%</p>
            <div className="mt-1 flex items-center text-xs text-red-600">
              <ArrowDownRight className="h-3 w-3 mr-0.5" /> -0.8% this period
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Posts</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-bold">194</p>
            <div className="mt-1 flex items-center text-xs text-green-600">
              <ArrowUpRight className="h-3 w-3 mr-0.5" /> +23 this period
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms">By Platform</TabsTrigger>
          <TabsTrigger value="posts">Top Posts</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Overview</CardTitle>
              <CardDescription>Key metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              <AnalyticsChart
                variant="line"
                data={data}
                series={[
                  { key: 'impressions', name: 'Impressions', color: '#C87A5A' },
                  { key: 'reach', name: 'Reach', color: '#7B8D6F' },
                  { key: 'engagement', name: 'Engagement', color: '#D4A843' },
                ]}
                height={300}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Follower Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsChart
                  variant="area"
                  data={data}
                  series={[{ key: 'followers', name: 'New Followers', color: '#C87A5A' }]}
                  height={200}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagement Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <AnalyticsChart
                  variant="bar"
                  data={data}
                  series={[{ key: 'engagement', name: 'Engagements', color: '#7B8D6F' }]}
                  height={200}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          {platformMetrics.map((pm) => (
            <Card key={pm.platform}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[pm.platform] }} />
                    <span className="font-medium">{PLATFORM_LABELS[pm.platform]}</span>
                  </div>
                  <Badge variant={pm.growth >= 0 ? 'success' : 'destructive'}>
                    {pm.growth >= 0 ? '+' : ''}{pm.growth}%
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{pm.followers.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Followers</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{pm.engagement}%</p>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{pm.posts}</p>
                    <p className="text-xs text-muted-foreground">Posts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performing Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">Post title number {i + 1} with high engagement metrics</p>
                      <p className="text-xs text-muted-foreground">Instagram • {1200 - i * 200} engagements</p>
                    </div>
                    <Badge variant="success">Top</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audience Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Connect analytics platforms to see audience demographics.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

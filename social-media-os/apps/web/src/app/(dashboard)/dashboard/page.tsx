'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarView } from '@/components/calendar-view';
import { AnalyticsChart } from '@/components/analytics-chart';
import { AISuggestionsPanel } from '@/components/ai-suggestions-panel';
import {
  BarChart3,
  Users,
  MessageCircle,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

const statsData = [
  { title: 'Total Followers', value: '12,847', change: 12.5, icon: Users, trend: 'up' as const },
  { title: 'Engagement Rate', value: '4.2%', change: -0.8, icon: TrendingUp, trend: 'down' as const },
  { title: 'Posts Published', value: '147', change: 23.1, icon: BarChart3, trend: 'up' as const },
  { title: 'Comments', value: '892', change: 8.3, icon: MessageCircle, trend: 'up' as const },
];

const chartData = [
  { name: 'Mon', followers: 1200, engagement: 450, impressions: 5400 },
  { name: 'Tue', followers: 1350, engagement: 520, impressions: 6200 },
  { name: 'Wed', followers: 1100, engagement: 480, impressions: 5800 },
  { name: 'Thu', followers: 1580, engagement: 610, impressions: 7100 },
  { name: 'Fri', followers: 1420, engagement: 590, impressions: 6800 },
  { name: 'Sat', followers: 980, engagement: 380, impressions: 4300 },
  { name: 'Sun', followers: 1050, engagement: 410, impressions: 4900 },
];

const recentPosts = [
  { id: '1', content: 'Excited to announce our new feature that will revolutionize...', platform: 'Twitter', status: 'published' as const, time: '2h ago' },
  { id: '2', content: 'Behind the scenes of our latest photoshoot! 📸', platform: 'Instagram', status: 'scheduled' as const, time: 'Tomorrow 9am' },
  { id: '3', content: 'Check out our latest blog post on AI trends in 2026...', platform: 'LinkedIn', status: 'draft' as const, time: 'Last edited 1h ago' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening with your accounts</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.title}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-2xl font-bold">{stat.value}</span>
                <span className={`flex items-center text-xs font-medium ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                  {Math.abs(stat.change)}%
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weekly Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <AnalyticsChart
                variant="area"
                data={chartData}
                series={[
                  { key: 'followers', name: 'Followers', color: '#C87A5A' },
                  { key: 'engagement', name: 'Engagement', color: '#7B8D6F' },
                  { key: 'impressions', name: 'Impressions', color: '#D4A843' },
                ]}
                height={250}
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <AISuggestionsPanel
            suggestions={[
              { id: '1', type: 'content', title: 'Post about industry trends', description: 'Your audience engages most with industry analysis', content: 'Share your thoughts on the latest trends' },
              { id: '2', type: 'timing', title: 'Best time to post', description: 'Your audience is most active at 2pm on weekdays', content: 'Schedule for weekday afternoons' },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPosts.map((post) => (
              <div key={post.id} className="flex items-start justify-between rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.content}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant={post.status === 'published' ? 'success' : post.status === 'scheduled' ? 'default' : 'secondary'}
                      className="capitalize text-[10px]"
                    >
                      {post.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{post.platform}</span>
                    <span className="text-xs text-muted-foreground">{post.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarView
              posts={[
                { id: '1', title: 'Product Launch', platforms: ['twitter', 'instagram'], status: 'scheduled', scheduledAt: new Date() },
                { id: '2', title: 'Weekly Tip', platforms: ['linkedin'], status: 'scheduled', scheduledAt: new Date(Date.now() + 86400000) },
              ]}
              onDayClick={(date) => console.log(date)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

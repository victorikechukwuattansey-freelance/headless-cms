'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarView } from '@/components/calendar-view';
import { Plus, Filter } from 'lucide-react';
import { Platform, PostStatus } from '@social-media-os/shared';
import { PLATFORM_LABELS, PLATFORM_COLORS, POST_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import type { CalendarPost } from '@/types';

const samplePosts: CalendarPost[] = [
  { id: '1', title: 'Product Launch Tweet', platforms: [Platform.TWITTER], status: PostStatus.SCHEDULED, scheduledAt: new Date() },
  { id: '2', title: 'Instagram Story - Behind the Scenes', platforms: [Platform.INSTAGRAM], status: PostStatus.SCHEDULED, scheduledAt: new Date(Date.now() + 86400000) },
  { id: '3', title: 'LinkedIn Article - Industry Trends', platforms: [Platform.LINKEDIN], status: PostStatus.DRAFT, scheduledAt: new Date(Date.now() + 172800000) },
  { id: '4', title: 'Facebook Update - Community Event', platforms: [Platform.FACEBOOK], status: PostStatus.SCHEDULED, scheduledAt: new Date(Date.now() + 259200000) },
  { id: '5', title: 'TikTok - Product Demo', platforms: [Platform.TIKTOK], status: PostStatus.SCHEDULED, scheduledAt: new Date(Date.now() + 345600000) },
];

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayPosts, setDayPosts] = useState<CalendarPost[]>([]);

  const handleDayClick = (date: Date, posts: CalendarPost[]) => {
    setSelectedDate(date);
    setDayPosts(posts);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Calendar</h1>
          <p className="text-sm text-muted-foreground">Plan and visualize your content schedule</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Post
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <CalendarView posts={samplePosts} onDayClick={handleDayClick} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {selectedDate ? formatDateTime(selectedDate) : 'Select a day'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dayPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posts scheduled for this day.</p>
              ) : (
                <div className="space-y-2">
                  {dayPosts.map((post) => (
                    <div key={post.id} className="rounded-lg border p-2">
                      <p className="text-xs font-medium truncate">{post.title}</p>
                      <div className="mt-1 flex items-center gap-1">
                        {post.platforms.map((p) => (
                          <span key={p} className="text-[10px] text-muted-foreground">
                            {PLATFORM_LABELS[p]}
                          </span>
                        ))}
                      </div>
                      <Badge variant={post.status === PostStatus.SCHEDULED ? 'default' : 'secondary'} className="mt-1 text-[10px]">
                        {POST_STATUS_LABELS[post.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {Object.values(Platform).slice(0, 6).map((p) => (
                <div key={p} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
                  {PLATFORM_LABELS[p]}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

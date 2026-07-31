'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/empty-state';
import { Plus, FileText, Filter } from 'lucide-react';
import { PostStatus, Platform } from '@social-media-os/shared';
import { POST_STATUS_LABELS, PLATFORM_LABELS } from '@/lib/constants';

const samplePosts = [
  {
    id: '1',
    workspaceId: 'w1',
    authorId: 'a1',
    content: { text: 'Excited to announce our new AI-powered analytics feature! Your social media insights just got a whole lot smarter. 📊 #AI #SocialMedia' },
    mediaUrls: [],
    postType: 'text' as const,
    status: 'published' as const,
    platforms: [Platform.TWITTER, Platform.LINKEDIN],
    scheduledAt: null,
    publishedAt: new Date(),
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 86400000),
  },
  {
    id: '2',
    workspaceId: 'w1',
    authorId: 'a1',
    content: { text: 'Behind the scenes of our team retreat! Building great products starts with great teams. 🌟' },
    mediaUrls: ['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400'],
    postType: 'image' as const,
    status: 'scheduled' as const,
    platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
    scheduledAt: new Date(Date.now() + 86400000 * 2),
    publishedAt: null,
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '3',
    workspaceId: 'w1',
    authorId: 'a1',
    content: { text: 'Draft: Q3 Content Strategy - focus on video content and community building. Need to finalize the calendar...' },
    mediaUrls: [],
    postType: 'text' as const,
    status: 'draft' as const,
    platforms: [Platform.YOUTUBE, Platform.TIKTOK],
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date(Date.now() - 604800000),
    updatedAt: new Date(Date.now() - 3600000),
  },
];

export default function PostsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  const filtered = samplePosts.filter((post) => {
    const matchesSearch = Object.values(post.content).some((c) =>
      c.toLowerCase().includes(search.toLowerCase())
    );
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || post.platforms.includes(platformFilter as Platform);
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground">Create, schedule, and manage your social media posts</p>
        </div>
        <Link href="/posts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search posts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Statuses' },
                ...Object.entries(POST_STATUS_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              className="max-w-[160px]"
            />
            <Select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Platforms' },
                ...Object.entries(PLATFORM_LABELS).map(([value, label]) => ({ value, label })),
              ]}
              className="max-w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No posts found"
          description="Get started by creating your first post."
          action={{ label: 'Create Post', onClick: () => window.location.href = '/posts/new' }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard
              key={post.id}
              post={post as any}
              onEdit={(id) => window.location.href = `/posts/${id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

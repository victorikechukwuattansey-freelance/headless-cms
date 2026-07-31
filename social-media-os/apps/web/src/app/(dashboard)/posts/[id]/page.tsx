'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Platform, PostType } from '@social-media-os/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PlatformSelector } from '@/components/platform-selector';
import { ArrowLeft, Send, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { PLATFORM_LABELS, POST_STATUS_LABELS } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [platforms] = useState<Platform[]>([Platform.TWITTER, Platform.LINKEDIN]);
  const [content, setContent] = useState('Excited to announce our new AI-powered analytics feature! Your social media insights just got a whole lot smarter.');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published'>('draft');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/posts')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Edit Post</h1>
            <Badge variant={status === 'published' ? 'success' : status === 'scheduled' ? 'default' : 'secondary'}>
              {POST_STATUS_LABELS[status as keyof typeof POST_STATUS_LABELS]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Post ID: {id}</p>
        </div>
        <div className="flex gap-2">
          {status === 'draft' && (
            <>
              <Button variant="outline"><Clock className="h-4 w-4 mr-1" /> Schedule</Button>
              <Button><Send className="h-4 w-4 mr-1" /> Publish</Button>
            </>
          )}
          <Button variant="outline" className="text-red-500"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlatformSelector selected={platforms} onChange={() => {}} />
              <div className="space-y-2">
                <Label>Post Content</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <p className="text-sm font-medium capitalize">{status}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Created</span>
                <p className="text-sm font-medium">{formatDateTime(new Date())}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Platforms</span>
                <div className="flex gap-1 mt-1">
                  {platforms.map((p) => (
                    <Badge key={p} variant="secondary">{PLATFORM_LABELS[p]}</Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Platform Versions</Label>
                {platforms.map((p) => (
                  <div key={p} className="rounded border p-2 text-xs">
                    <span className="font-medium">{PLATFORM_LABELS[p]}:</span>{' '}
                    <span className="text-muted-foreground">{content.slice(0, 50)}...</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                Improve writing
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                Make it more engaging
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" size="sm">
                Reduce length
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

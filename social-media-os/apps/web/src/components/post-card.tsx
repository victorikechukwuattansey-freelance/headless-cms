'use client';

import { Post, PostStatus } from '@social-media-os/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime, formatDateTime } from '@/lib/utils';
import { POST_STATUS_LABELS, POST_STATUS_COLORS, PLATFORM_COLORS } from '@/lib/constants';
import { Edit3, Trash2, Send, Clock } from 'lucide-react';

interface PostCardProps {
  post: Post;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPublish?: (id: string) => void;
  className?: string;
}

const statusVariants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  [PostStatus.DRAFT]: 'secondary',
  [PostStatus.SCHEDULED]: 'default',
  [PostStatus.PUBLISHED]: 'success',
  [PostStatus.FAILED]: 'destructive',
  [PostStatus.CANCELLED]: 'outline',
  [PostStatus.PUBLISHING]: 'warning',
};

export function PostCard({ post, onEdit, onDelete, onPublish, className }: PostCardProps) {
  const primaryContent = post.content?.[Object.keys(post.content)[0]] || '';
  const isScheduled = post.status === PostStatus.SCHEDULED;
  const isDraft = post.status === PostStatus.DRAFT;

  return (
    <Card className={cn('group', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Avatar src={null} alt="Author" fallback="A" size="sm" />
            <div className="text-xs text-muted-foreground">
              {post.authorId && <span>Author • {formatRelativeTime(post.createdAt)}</span>}
            </div>
          </div>
          <Badge variant={statusVariants[post.status]} className="capitalize">
            {POST_STATUS_LABELS[post.status]}
          </Badge>
        </div>

        <p className="text-sm line-clamp-3 mb-3">
          {primaryContent || 'No content'}
        </p>

        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="flex gap-1 mb-3">
            {post.mediaUrls.slice(0, 4).map((url, i) => (
              <div key={i} className="h-12 w-12 rounded-md bg-muted overflow-hidden">
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {post.platforms?.map((p) => (
              <span
                key={p}
                className="h-5 w-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: PLATFORM_COLORS[p] + '20' }}
                title={p}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_COLORS[p] }}
                />
              </span>
            ))}
          </div>

          {isScheduled && post.scheduledAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDateTime(post.scheduledAt)}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(post.id)}>
              <Edit3 className="h-3 w-3 mr-1" /> Edit
            </Button>
          )}
          {isDraft && onPublish && (
            <Button variant="ghost" size="sm" onClick={() => onPublish(post.id)}>
              <Send className="h-3 w-3 mr-1" /> Publish
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => onDelete(post.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

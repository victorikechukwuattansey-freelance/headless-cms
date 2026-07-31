'use client';

import { useState } from 'react';
import { Platform } from '@social-media-os/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PLATFORM_COLORS, PLATFORM_LABELS } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import { MessageCircle, Send, Filter, Search, Smile, Meh, Frown } from 'lucide-react';
import type { EngagementItem } from '@/types';

const sampleEngagements: EngagementItem[] = [
  { id: '1', platform: Platform.TWITTER, authorName: 'Sarah Johnson', authorAvatar: '', content: 'Love this feature! When can I get early access? 🚀', sentiment: 'positive', timestamp: new Date(Date.now() - 3600000), postId: 'p1' },
  { id: '2', platform: Platform.INSTAGRAM, authorName: 'Mike Chen', authorAvatar: '', content: 'Great behind the scenes content. More of this please!', sentiment: 'positive', timestamp: new Date(Date.now() - 7200000), postId: 'p2' },
  { id: '3', platform: Platform.TWITTER, authorName: 'Alex Rivera', authorAvatar: '', content: 'The pricing seems a bit high for small businesses. Any startup plans?', sentiment: 'neutral', timestamp: new Date(Date.now() - 14400000), postId: 'p1' },
  { id: '4', platform: Platform.LINKEDIN, authorName: 'Dr. Emily Park', authorAvatar: '', content: 'Interesting analysis but I disagree with the conclusion about market trends.', sentiment: 'negative', timestamp: new Date(Date.now() - 28800000), postId: 'p3' },
  { id: '5', platform: Platform.FACEBOOK, authorName: 'James Wilson', authorAvatar: '', content: 'Shared this with my network. Really valuable insights!', sentiment: 'positive', timestamp: new Date(Date.now() - 43200000), postId: 'p4' },
];

const sentimentIcons = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
};

const sentimentColors = {
  positive: 'text-green-600',
  neutral: 'text-yellow-600',
  negative: 'text-red-600',
};

export default function EngagementPage() {
  const [search, setSearch] = useState('');
  const [selectedEngagement, setSelectedEngagement] = useState<EngagementItem | null>(null);
  const [reply, setReply] = useState('');

  const filtered = sampleEngagements.filter((e) =>
    e.content.toLowerCase().includes(search.toLowerCase()) ||
    e.authorName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSendReply = () => {
    if (!reply.trim()) return;
    setReply('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Engagement Inbox</h1>
          <p className="text-sm text-muted-foreground">Manage comments, mentions, and messages across all platforms</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border-0 p-0 focus-visible:ring-0"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((item) => {
                  const SentimentIcon = sentimentIcons[item.sentiment];
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEngagement(item)}
                      className={`w-full p-4 text-left transition-colors hover:bg-muted/50 ${
                        selectedEngagement?.id === item.id ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar src={null} alt={item.authorName} fallback={item.authorName.charAt(0)} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{item.authorName}</span>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[item.platform] }} />
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.content}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(item.timestamp)}</span>
                            <SentimentIcon className={`h-3 w-3 ${sentimentColors[item.sentiment]}`} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedEngagement ? (
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar src={null} alt={selectedEngagement.authorName} fallback={selectedEngagement.authorName.charAt(0)} />
                  <div>
                    <p className="font-medium">{selectedEngagement.authorName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>via {PLATFORM_LABELS[selectedEngagement.platform]}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(selectedEngagement.timestamp)}</span>
                    </div>
                  </div>
                  <Badge
                    variant={selectedEngagement.sentiment === 'positive' ? 'success' : selectedEngagement.sentiment === 'negative' ? 'destructive' : 'warning'}
                    className="ml-auto capitalize"
                  >
                    {selectedEngagement.sentiment}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="rounded-lg bg-muted p-4 mb-4">
                  <p className="text-sm">{selectedEngagement.content}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reply</label>
                  <Textarea
                    placeholder="Write your reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendReply} disabled={!reply.trim()}>
                      <Send className="h-4 w-4 mr-2" />
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-full min-h-[400px]">
              <CardContent className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Select a message</h3>
                <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the inbox to reply</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

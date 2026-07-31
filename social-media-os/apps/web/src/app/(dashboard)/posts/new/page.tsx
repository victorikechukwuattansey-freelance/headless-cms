'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Platform, PostType, ContentFormat, AIAction } from '@social-media-os/shared';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PlatformSelector } from '@/components/platform-selector';
import { AIPromptInput } from '@/components/ai-prompt-input';
import { AISuggestionsPanel } from '@/components/ai-suggestions-panel';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { PLATFORM_LABELS, CONTENT_FORMAT_LABELS } from '@/lib/constants';
import { CalendarIcon, Eye, Sparkles, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default function NewPostPage() {
  const router = useRouter();
  const [platforms, setPlatforms] = useState<Platform[]>([Platform.TWITTER]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [postType, setPostType] = useState<PostType>(PostType.TEXT);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleContentChange = (platform: string, value: string) => {
    setContent((prev) => ({ ...prev, [platform]: value }));
  };

  const handleAIGenerate = (params: { prompt: string; platform: string; action: string; format: string }) => {
    const newContent = `[AI Generated] ${params.prompt}`;
    setContent((prev) => ({ ...prev, [params.platform]: newContent }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Post</h1>
          <p className="text-sm text-muted-foreground">Compose and schedule your social media content</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Content</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  <Eye className="h-3 w-3 mr-1" />
                  {showPreview ? 'Edit' : 'Preview'}
                </Button>
              </div>
              <CardDescription>Write or generate content for each platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlatformSelector selected={platforms} onChange={setPlatforms} />

              <div className="space-y-2">
                <Label>Post Type</Label>
                <Select
                  value={postType}
                  onChange={(e) => setPostType(e.target.value as PostType)}
                  options={Object.values(PostType).map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
                />
              </div>

              <Separator />

              {platforms.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select at least one platform to start writing.</p>
              ) : (
                platforms.map((platform) => (
                  <div key={platform} className="space-y-2">
                    <Label>{PLATFORM_LABELS[platform]}</Label>
                    {postType === PostType.TEXT ? (
                      <Textarea
                        placeholder={`Write your ${PLATFORM_LABELS[platform]} post...`}
                        value={content[platform] || ''}
                        onChange={(e) => handleContentChange(platform, e.target.value)}
                        rows={5}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        Media upload area for {postType} posts
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schedule</CardTitle>
              <CardDescription>Choose when to publish your post</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                <Label>Schedule for later</Label>
              </div>
              {scheduleEnabled && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduleDate ? format(scheduleDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar month={scheduleDate || new Date()} onMonthChange={() => {}} selected={scheduleDate} onSelect={setScheduleDate} />
                  </PopoverContent>
                </Popover>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => router.back()}>Save as Draft</Button>
            <Button>Schedule Post</Button>
          </div>
        </div>

        <div className="space-y-6">
          <AIPromptInput onGenerate={handleAIGenerate} />
          <AISuggestionsPanel
            suggestions={[
              { id: '1', type: 'content', title: 'Industry insights', description: 'Your audience loves data-driven posts', content: 'Share a statistic about your industry' },
              { id: '2', type: 'hashtag', title: 'Trending hashtags', description: '#SocialMediaAI, #ContentStrategy, #DigitalMarketing', content: 'Use these trending tags' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

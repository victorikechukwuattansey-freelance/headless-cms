'use client';

import { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { AIAction, ContentFormat, Platform } from '@social-media-os/shared';
import { AI_ACTION_LABELS, CONTENT_FORMAT_LABELS, PLATFORM_LABELS } from '@/lib/constants';

interface AIPromptInputProps {
  onGenerate: (params: {
    prompt: string;
    platform: string;
    action: string;
    format: string;
  }) => void;
  isLoading?: boolean;
  className?: string;
}

export function AIPromptInput({ onGenerate, isLoading, className }: AIPromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [platform, setPlatform] = useState(Platform.TWITTER);
  const [action, setAction] = useState(AIAction.GENERATE);
  const [format, setFormat] = useState(ContentFormat.SHORT_CAPTION);

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onGenerate({ prompt: prompt.trim(), platform, action, format });
  };

  return (
    <div className={cn('rounded-xl border bg-card p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-brand-terracotta" />
        <h3 className="font-semibold">AI Content Studio</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Platform</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {Object.values(Platform).map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as AIAction)}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {Object.values(AIAction).map((a) => (
              <option key={a} value={a}>{AI_ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ContentFormat)}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {Object.values(ContentFormat).map((f) => (
              <option key={f} value={f}>{CONTENT_FORMAT_LABELS[f]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <Textarea
          placeholder="Describe what you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="pr-12 resize-none"
        />
        <Button
          size="icon"
          className="absolute bottom-2 right-2"
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-2 flex gap-2">
        {['Write a thread about...', 'Create a caption for...', 'Repurpose this blog post...'].map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => setPrompt(hint)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted rounded-full px-2 py-1"
          >
            {hint}
          </button>
        ))}
      </div>
    </div>
  );
}

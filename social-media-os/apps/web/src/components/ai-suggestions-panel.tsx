'use client';

import { Lightbulb, TrendingUp, Hash, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Suggestion {
  id: string;
  type: 'content' | 'hashtag' | 'caption' | 'timing';
  title: string;
  description: string;
  content: string;
}

interface AISuggestionsPanelProps {
  suggestions?: Suggestion[];
  onApply?: (suggestion: Suggestion) => void;
  isLoading?: boolean;
  className?: string;
}

const suggestionIcons = {
  content: Lightbulb,
  hashtag: Hash,
  caption: TrendingUp,
  timing: Clock,
};

export function AISuggestionsPanel({ suggestions, onApply, isLoading, className }: AISuggestionsPanelProps) {
  if (isLoading) {
    return (
      <Card className={cn('w-80', className)}>
        <CardHeader>
          <CardTitle className="text-sm">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-1">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <Card className={cn('w-80', className)}>
        <CardHeader>
          <CardTitle className="text-sm">AI Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No suggestions yet. Create a post or use AI Studio to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-80', className)}>
      <CardHeader>
        <CardTitle className="text-sm">AI Suggestions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => {
          const Icon = suggestionIcons[suggestion.type];
          return (
            <div key={suggestion.id} className="rounded-lg border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Icon className="h-3 w-3 text-brand-terracotta" />
                <span className="text-xs font-medium capitalize">{suggestion.type}</span>
              </div>
              <p className="text-sm font-medium">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground">{suggestion.description}</p>
              {onApply && (
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => onApply(suggestion)}>
                  Apply
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

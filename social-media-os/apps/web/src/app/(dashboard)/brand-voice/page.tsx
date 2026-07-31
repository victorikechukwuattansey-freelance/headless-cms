'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Palette, Plus, X, Save, Sparkles } from 'lucide-react';

const personalityTags = ['Professional', 'Friendly', 'Innovative', 'Authoritative', 'Playful', 'Minimalist', 'Bold', 'Educational', 'Inspirational', 'Witty'];

export default function BrandVoicePage() {
  const [selectedTags, setSelectedTags] = useState<string[]>(['Professional', 'Innovative', 'Friendly']);
  const [writingStyle, setWritingStyle] = useState('We write with clarity and confidence. Our tone is professional yet approachable. We use industry terminology but explain concepts thoroughly. We prefer active voice and concise sentences.');
  const [forbiddenWords, setForbiddenWords] = useState<string[]>(['synergy', 'leverage', 'disrupt', 'game-changer']);
  const [newForbidden, setNewForbidden] = useState('');

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const addForbiddenWord = () => {
    if (newForbidden.trim() && !forbiddenWords.includes(newForbidden.trim())) {
      setForbiddenWords([...forbiddenWords, newForbidden.trim()]);
      setNewForbidden('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-brand-terracotta" />
          <div>
            <h1 className="text-2xl font-bold">Brand Voice</h1>
            <p className="text-sm text-muted-foreground">Define your brand&apos;s personality and writing style</p>
          </div>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="personality">
        <TabsList>
          <TabsTrigger value="personality">Personality</TabsTrigger>
          <TabsTrigger value="writing">Writing Style</TabsTrigger>
          <TabsTrigger value="visual">Visual Identity</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="personality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personality Tags</CardTitle>
              <CardDescription>Select tags that describe your brand&apos;s personality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {personalityTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                        isSelected
                          ? 'bg-brand-terracotta text-white border-brand-terracotta'
                          : 'bg-background text-muted-foreground border-input hover:border-brand-terracotta'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Audience</CardTitle>
              <CardDescription>Describe your ideal audience</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Describe your target audience..."
                defaultValue="Social media managers, content creators, and marketing professionals at small to medium businesses. Aged 25-45, tech-savvy, looking to streamline their workflow."
                rows={4}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Forbidden Words</CardTitle>
              <CardDescription>Words and phrases to avoid in your content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {forbiddenWords.map((word) => (
                  <Badge key={word} variant="destructive" className="gap-1">
                    {word}
                    <button onClick={() => setForbiddenWords(forbiddenWords.filter((w) => w !== word))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a word or phrase..."
                  value={newForbidden}
                  onChange={(e) => setNewForbidden(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addForbiddenWord()}
                />
                <Button variant="outline" onClick={addForbiddenWord}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="writing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Writing Style Guide</CardTitle>
              <CardDescription>Define how your brand writes and communicates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Style Description</Label>
                <Textarea
                  value={writingStyle}
                  onChange={(e) => setWritingStyle(e.target.value)}
                  rows={6}
                />
              </div>
              <Button variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approved Terms</CardTitle>
              <CardDescription>Terms and phrases that should always be used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {['Social Media OS', 'SMO Platform', 'AI-powered', 'smart scheduling'].map((term) => (
                  <Badge key={term} variant="secondary" className="gap-1">
                    {term}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visual" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brand Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Primary', color: '#C87A5A' },
                  { label: 'Secondary', color: '#7B8D6F' },
                  { label: 'Accent', color: '#D4A843' },
                  { label: 'Dark', color: '#2D2D2D' },
                  { label: 'Light', color: '#F5F0E8' },
                ].map((c) => (
                  <div key={c.label} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md border" style={{ backgroundColor: c.color }} />
                    <span className="text-sm font-medium flex-1">{c.label}</span>
                    <span className="text-xs text-muted-foreground">{c.color}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fonts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Heading Font', value: 'Inter' },
                  { label: 'Body Font', value: 'System UI' },
                  { label: 'Display Font', value: 'Playfair Display' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between">
                    <span className="text-sm">{f.label}</span>
                    <span className="text-sm font-medium">{f.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg bg-brand-terracotta flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">S</span>
                </div>
                <Button variant="outline">Upload New Logo</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand Voice Preview</CardTitle>
              <CardDescription>See how your brand voice sounds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm leading-relaxed">
                  We&apos;re excited to announce our latest update! The Social Media OS platform
                  now includes AI-powered smart scheduling that learns your audience&apos;s
                  behavior and posts at optimal times. This isn&apos;t just a calendar — it&apos;s
                  your content intelligence engine.
                </p>
              </div>
              <Button variant="outline">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Preview
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

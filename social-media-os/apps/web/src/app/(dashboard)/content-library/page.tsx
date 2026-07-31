'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/empty-state';
import { Image, Video, FileText, Search, Upload, Folder, Grid3X3, List } from 'lucide-react';

const mediaItems = [
  { id: '1', name: 'hero-banner.jpg', type: 'image' as const, url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400', size: 245000, createdAt: new Date() },
  { id: '2', name: 'product-demo.mp4', type: 'video' as const, url: '', size: 12500000, createdAt: new Date() },
  { id: '3', name: 'team-photo.jpg', type: 'image' as const, url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400', size: 312000, createdAt: new Date() },
  { id: '4', name: 'logo-final.svg', type: 'image' as const, url: '', size: 45000, createdAt: new Date() },
  { id: '5', name: 'Q3-report.pdf', type: 'document' as const, url: '', size: 2100000, createdAt: new Date() },
];

const folders = [
  { id: 'f1', name: 'Brand Assets' },
  { id: 'f2', name: 'Product Shots' },
  { id: 'f3', name: 'Team Photos' },
  { id: 'f4', name: 'Campaigns' },
  { id: 'f5', name: 'Social Templates' },
];

export default function ContentLibraryPage() {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Library</h1>
          <p className="text-sm text-muted-foreground">Manage your images, videos, and documents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setView('grid')}>
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setView('list')}>
            <List className="h-4 w-4" />
          </Button>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Folders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <button className="w-full text-left px-3 py-2 rounded-md text-sm font-medium bg-muted">
                  All Files
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    className="w-full text-left px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2"
                  >
                    <Folder className="h-3 w-3" />
                    {folder.name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Storage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">2.4 GB / 10 GB</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-1/4 rounded-full bg-brand-terracotta" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search files..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Tabs defaultValue="all" className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {mediaItems.map((item) => (
                <Card key={item.id} className="group cursor-pointer overflow-hidden">
                  <div className="aspect-square bg-muted relative">
                    {item.type === 'image' && item.url ? (
                      <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        {item.type === 'video' ? (
                          <Video className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {(item.size / 1024).toFixed(1)} KB
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {mediaItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        {item.type === 'image' ? <Image className="h-4 w-4" /> : item.type === 'video' ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(item.size / 1024).toFixed(1)} KB • {item.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

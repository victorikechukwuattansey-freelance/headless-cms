'use client';

import { useState } from 'react';
import { Mail, Share2, BarChart3, Users, Plus, Search, Eye, MousePointerClick, Send, Calendar, TrendingUp, TrendingDown, Instagram, Facebook, Twitter, CheckCircle2, Clock, Pause, AlertCircle, PenTool, Megaphone } from 'lucide-react';

type CampaignType = 'email' | 'social' | 'sms';
type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
  audience: string;
  audienceCount: number;
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
  revenue: number;
  openRate: number;
  clickRate: number;
  scheduledFor?: string;
  sentAt?: string;
  tags: string[];
  channel?: string;
}

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  image: string;
  scheduledFor: string;
  status: 'scheduled' | 'published' | 'draft';
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagement: number;
  campaign?: string;
}

interface Segment {
  id: string;
  name: string;
  count: number;
  criteria: string;
  growth: number;
  avgSpend: number;
}

const campaigns: Campaign[] = [
  { id: 'c1', name: 'Summer Luxury Drop — New Arrivals', type: 'email', status: 'sent', subject: 'Exclusive: The Summer Collection Has Arrived', audience: 'VIP Customers', audienceCount: 1240, sent: 1240, opens: 448, clicks: 156, conversions: 34, revenue: 47600, openRate: 36.1, clickRate: 12.6, sentAt: '2026-07-15 10:00', tags: ['VIP', 'New Arrivals', 'Summer'] },
  { id: 'c2', name: 'Hermès Restock Alert', type: 'email', status: 'sent', subject: 'Back in Stock: Hermès Birkin & Kelly', audience: 'Hermès Watchlist', audienceCount: 380, sent: 380, opens: 213, clicks: 89, conversions: 22, revenue: 118000, openRate: 56.1, clickRate: 23.4, sentAt: '2026-07-18 14:30', tags: ['Hermès', 'Restock', 'High-Value'] },
  { id: 'c3', name: 'Instagram — Rolex Feature Series', type: 'social', status: 'scheduled', audience: 'Instagram Followers', audienceCount: 12400, sent: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, openRate: 0, clickRate: 0, scheduledFor: '2026-07-22 12:00', tags: ['Rolex', 'Instagram', 'Feature'], channel: 'Instagram' },
  { id: 'c4', name: 'Flash Sale — 48h Exclusive', type: 'email', status: 'draft', subject: '48 Hours Only: Up to 20% Off Selected Styles', audience: 'All Subscribers', audienceCount: 3200, sent: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, openRate: 0, clickRate: 0, scheduledFor: '2026-07-25 09:00', tags: ['Flash Sale', 'Discount', 'All'] },
  { id: 'c5', name: 'TikTok — Behind the Auth', type: 'social', status: 'sent', audience: 'TikTok Followers', audienceCount: 8700, sent: 1, opens: 0, clicks: 0, conversions: 0, revenue: 0, openRate: 0, clickRate: 0, sentAt: '2026-07-16 18:00', tags: ['TikTok', 'Content', 'Auth'], channel: 'TikTok' },
  { id: 'c6', name: 'Win-Back — 90 Day Dormant', type: 'email', status: 'sending', subject: 'We Miss You — Here\'s 15% Off', audience: 'Dormant 90d', audienceCount: 640, sent: 420, opens: 89, clicks: 21, conversions: 4, revenue: 3200, openRate: 21.2, clickRate: 5.0, tags: ['Win-Back', 'Dormant'] },
  { id: 'c7', name: 'Facebook — Lifestyle Carousel', type: 'social', status: 'paused', audience: 'Facebook Lookalike', audienceCount: 25000, sent: 0, opens: 0, clicks: 0, conversions: 0, revenue: 0, openRate: 0, clickRate: 0, tags: ['Facebook', 'Carousel', 'Prospecting'], channel: 'Facebook' },
];

const socialPosts: SocialPost[] = [
  { id: 's1', platform: 'Instagram', content: 'The art of authentication. Every Hermès piece tells a story — and we verify every chapter. #LuxuryResale #Hermès #Authenticated', image: 'hero-birkin.jpg', scheduledFor: '2026-07-22 12:00', status: 'scheduled', likes: 0, comments: 0, shares: 0, reach: 0, engagement: 0, campaign: 'Instagram — Rolex Feature Series' },
  { id: 's2', platform: 'Instagram', content: 'New in: Rolex Submariner Date 126610LN. The icon, reimagined. Link in bio.', image: 'rolex-sub.jpg', scheduledFor: '2026-07-23 10:00', status: 'scheduled', likes: 0, comments: 0, shares: 0, reach: 0, engagement: 0 },
  { id: 's3', platform: 'TikTok', content: 'POV: You bring your vintage Chanel to us for authentication ✨ Watch the full process...', image: 'auth-process.mp4', scheduledFor: '2026-07-16 18:00', status: 'published', likes: 2340, comments: 187, shares: 412, reach: 34200, engagement: 8.6, campaign: 'TikTok — Behind the Auth' },
  { id: 's4', platform: 'Instagram', content: 'Summer essentials: The Louis Vuitton Neverfull in Monogram. Still the one. #LVNeverfull #SummerStyle', image: 'lv-neverfull.jpg', scheduledFor: '2026-07-24 11:00', status: 'scheduled', likes: 0, comments: 0, shares: 0, reach: 0, engagement: 0 },
  { id: 's5', platform: 'Facebook', content: 'Why invest in pre-owned luxury? Quality, value, and sustainability — the smart way to shop high-end.', image: 'lifestyle-car.jpg', scheduledFor: '2026-07-21 09:00', status: 'draft', likes: 0, comments: 0, shares: 0, reach: 0, engagement: 0, campaign: 'Facebook — Lifestyle Carousel' },
  { id: 's6', platform: 'Twitter', content: 'The Hermès Birkin has appreciated 14% year-over-year. Pre-owned luxury isn\'t just fashion — it\'s an asset class.', image: '', scheduledFor: '2026-07-20 14:00', status: 'published', likes: 156, comments: 23, shares: 89, reach: 8900, engagement: 2.9 },
];

const segments: Segment[] = [
  { id: 'seg1', name: 'VIP Customers', count: 1240, criteria: 'Lifetime spend > $5,000', growth: 8.2, avgSpend: 14200 },
  { id: 'seg2', name: 'Hermès Watchlist', count: 380, criteria: 'Saved or inquired about Hermès items', growth: 12.5, avgSpend: 8900 },
  { id: 'seg3', name: 'Dormant 90d', count: 640, criteria: 'No purchase or email open in 90+ days', growth: -4.1, avgSpend: 2100 },
  { id: 'seg4', name: 'Watch Collectors', count: 890, criteria: 'Purchased or inquired about watches', growth: 15.3, avgSpend: 11500 },
  { id: 'seg5', name: 'All Subscribers', count: 3200, criteria: 'Opted-in email subscribers', growth: 6.7, avgSpend: 4800 },
];

const platformIcons: Record<string, any> = { Instagram, Facebook, Twitter, TikTok: Share2 };
const platformColors: Record<string, string> = {
  Instagram: 'bg-pink-500/10 text-pink-500', Facebook: 'bg-blue-500/10 text-blue-500',
  Twitter: 'bg-sky-500/10 text-sky-500', TikTok: 'bg-foreground/10 text-foreground',
};
const statusStyles: Record<string, string> = {
  draft: 'text-muted-foreground bg-muted', scheduled: 'text-blue-500 bg-blue-500/10',
  sending: 'text-yellow-500 bg-yellow-500/10', sent: 'text-green-500 bg-green-500/10',
  published: 'text-green-500 bg-green-500/10', paused: 'text-orange-500 bg-orange-500/10',
};

export default function MarketingPage() {
  const [tab, setTab] = useState<'campaigns' | 'social' | 'segments'>('campaigns');
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredCampaigns = campaigns.filter(c => {
    const match = c.name.toLowerCase().includes(search.toLowerCase());
    if (statusFilter === 'all') return match;
    return match && c.status === statusFilter;
  });

  const filteredPosts = socialPosts.filter(p => p.content.toLowerCase().includes(search.toLowerCase()));

  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
  const avgOpen = campaigns.filter(c => c.sent > 0).reduce((s, c, _, a) => s + c.openRate / a.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Marketing</h2><p className="text-muted-foreground">Campaigns, social media, and audience segmentation</p></div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border bg-card">
            <button onClick={() => setTab('campaigns')} className={`px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors ${tab === 'campaigns' ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>
              <Mail className="inline h-3.5 w-3.5 mr-1" />Campaigns
            </button>
            <button onClick={() => setTab('social')} className={`px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'social' ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>
              <Share2 className="inline h-3.5 w-3.5 mr-1" />Social
            </button>
            <button onClick={() => setTab('segments')} className={`px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors ${tab === 'segments' ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>
              <Users className="inline h-3.5 w-3.5 mr-1" />Segments
            </button>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
            <Plus className="h-4 w-4" /> New {tab === 'social' ? 'Post' : 'Campaign'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Total Sent</p><Send className="h-4 w-4 text-luxury-gold" /></div>
          <p className="mt-1 text-2xl font-bold">{totalSent.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{campaigns.length} campaigns</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Avg Open Rate</p><Eye className="h-4 w-4 text-blue-500" /></div>
          <p className="mt-1 text-2xl font-bold">{avgOpen.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">across sent campaigns</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Revenue Attributed</p><TrendingUp className="h-4 w-4 text-green-500" /></div>
          <p className="mt-1 text-2xl font-bold">{(totalRevenue / 1000).toFixed(0)}k</p>
          <p className="text-xs text-green-500">+18% vs last month</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Audience Size</p><Users className="h-4 w-4 text-purple-500" /></div>
          <p className="mt-1 text-2xl font-bold">{segments.find(s => s.name === 'All Subscribers')?.count.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">active subscribers</p>
        </div>
      </div>

      {tab === 'campaigns' && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-luxury-gold" />
            </div>
            <div className="flex gap-1 rounded-md border bg-card p-0.5">
              {['all', 'draft', 'scheduled', 'sending', 'sent', 'paused'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors ${statusFilter === s ? 'bg-foreground text-background' : 'hover:bg-muted'}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3">
              {filteredCampaigns.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  className={`rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${selected?.id === c.id ? 'ring-1 ring-luxury-gold' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {c.type === 'email' ? <Mail className="h-4 w-4 text-purple-500" /> : <Share2 className="h-4 w-4 text-pink-500" />}
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[c.status]}`}>{c.status}</span>
                  </div>
                  {c.subject && <p className="text-xs text-muted-foreground mb-2 italic">&ldquo;{c.subject}&rdquo;</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{c.audience}</span>
                    <span>{c.audienceCount.toLocaleString()} recipients</span>
                  </div>
                  {c.sent > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div className="text-center"><p className="text-xs text-muted-foreground">Opens</p><p className="text-sm font-bold">{c.openRate}%</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Clicks</p><p className="text-sm font-bold">{c.clickRate}%</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Conv.</p><p className="text-sm font-bold text-green-500">{c.conversions}</p></div>
                      <div className="text-center"><p className="text-xs text-muted-foreground">Rev.</p><p className="text-sm font-bold">{(c.revenue / 1000).toFixed(1)}k</p></div>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {c.tags.map(t => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>)}
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {selected ? (
                <div className="rounded-lg border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{selected.name}</h3>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[selected.status]}`}>{selected.status}</span>
                      </div>
                      {selected.subject && <p className="text-sm text-muted-foreground mt-0.5 italic">&ldquo;{selected.subject}&rdquo;</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {selected.status === 'draft' && (
                        <button className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                          <Send className="h-3.5 w-3.5" /> Send Now
                        </button>
                      )}
                      {selected.status === 'sending' && (
                        <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-orange-500 hover:bg-orange-500/10 transition-colors">
                          <Pause className="h-3.5 w-3.5" /> Pause
                        </button>
                      )}
                      <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                        <PenTool className="h-3.5 w-3.5" /> Edit
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Audience</p>
                      <p className="text-lg font-bold">{selected.audienceCount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{selected.audience}</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Sent</p>
                      <p className="text-lg font-bold">{selected.sent.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">of {selected.audienceCount.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Conversions</p>
                      <p className="text-lg font-bold text-green-500">{selected.conversions}</p>
                      <p className="text-xs text-muted-foreground">{selected.sent > 0 ? ((selected.conversions / selected.sent) * 100).toFixed(1) : 0}% rate</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-lg font-bold">{formatCurrency(selected.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{selected.sent > 0 ? formatCurrency(selected.revenue / selected.sent) : '—'} / sent</p>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold mb-3">Funnel</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Delivered', value: selected.sent, pct: selected.audienceCount > 0 ? 100 : 0, color: 'bg-foreground' },
                      { label: 'Opened', value: selected.opens, pct: selected.sent > 0 ? (selected.opens / selected.sent) * 100 : 0, color: 'bg-blue-500' },
                      { label: 'Clicked', value: selected.clicks, pct: selected.sent > 0 ? (selected.clicks / selected.sent) * 100 : 0, color: 'bg-purple-500' },
                      { label: 'Converted', value: selected.conversions, pct: selected.sent > 0 ? (selected.conversions / selected.sent) * 100 : 0, color: 'bg-green-500' },
                    ].map(f => (
                      <div key={f.label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-20">{f.label}</span>
                        <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
                          <div className={`h-full rounded ${f.color} transition-all`} style={{ width: `${Math.max(f.pct, 2)}%` }} />
                        </div>
                        <span className="text-xs font-medium w-16 text-right">{f.value.toLocaleString()} ({f.pct.toFixed(1)}%)</span>
                      </div>
                    ))}
                  </div>

                  <hr className="my-4" />

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {selected.sentAt ? `Sent ${selected.sentAt}` : selected.scheduledFor ? `Scheduled ${selected.scheduledFor}` : 'Not scheduled'}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {selected.audience}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-card flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Megaphone className="h-8 w-8 mb-2" />
                  <p className="text-sm">Select a campaign to view performance</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'social' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Posts</h3>
            {filteredPosts.map(post => {
              const Icon = platformIcons[post.platform] || Share2;
              return (
                <div key={post.id} onClick={() => setSelectedPost(post)}
                  className={`rounded-lg border bg-card p-4 cursor-pointer transition-all hover:shadow-md ${selectedPost?.id === post.id ? 'ring-1 ring-luxury-gold' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center ${platformColors[post.platform]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{post.platform}</p>
                        <p className="text-xs text-muted-foreground">{post.scheduledFor}</p>
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[post.status]}`}>{post.status}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-2">{post.content}</p>
                  {post.status === 'published' && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{post.likes.toLocaleString()} likes</span>
                      <span>{post.comments} comments</span>
                      <span>{post.shares} shares</span>
                      <span>{post.reach.toLocaleString()} reach</span>
                    </div>
                  )}
                  {post.campaign && <span className="inline-block mt-2 rounded-full bg-muted px-2 py-0.5 text-xs">{post.campaign}</span>}
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedPost ? (
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-10 w-10 rounded-full flex items-center justify-center ${platformColors[selectedPost.platform]}`}>
                      {(() => { const Icon = platformIcons[selectedPost.platform] || Share2; return <Icon className="h-5 w-5" />; })()}
                    </span>
                    <div>
                      <h3 className="font-semibold">{selectedPost.platform} Post</h3>
                      <p className="text-sm text-muted-foreground">{selectedPost.status === 'scheduled' ? `Scheduled for ${selectedPost.scheduledFor}` : selectedPost.status === 'published' ? `Published ${selectedPost.scheduledFor}` : 'Draft'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPost.status === 'draft' && (
                      <button className="flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">
                        <Send className="h-3.5 w-3.5" /> Publish
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                      <PenTool className="h-3.5 w-3.5" /> Edit
                    </button>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 p-4 mb-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                  {selectedPost.image && <p className="text-xs text-muted-foreground mt-2 italic">📎 {selectedPost.image}</p>}
                </div>

                {selectedPost.status === 'published' && (
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Reach</p>
                      <p className="text-lg font-bold">{selectedPost.reach.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Likes</p>
                      <p className="text-lg font-bold">{selectedPost.likes.toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Comments</p>
                      <p className="text-lg font-bold">{selectedPost.comments}</p>
                    </div>
                    <div className="rounded-md bg-muted p-3 text-center">
                      <p className="text-xs text-muted-foreground">Engagement</p>
                      <p className="text-lg font-bold text-green-500">{selectedPost.engagement}%</p>
                    </div>
                  </div>
                )}

                {selectedPost.campaign && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Megaphone className="h-3.5 w-3.5" /> Part of campaign: <span className="font-medium text-foreground">{selectedPost.campaign}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border bg-card flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Share2 className="h-8 w-8 mb-2" />
                <p className="text-sm">Select a post to view details</p>
              </div>
            )}

            <div className="rounded-lg border bg-card p-5">
              <h3 className="font-semibold mb-3">Content Calendar</h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="p-1 font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 1;
                  const date = new Date(2026, 6, day + 1);
                  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
                  const postsOnDay = socialPosts.filter(p => p.scheduledFor.startsWith(dateStr));
                  const isToday = dateStr === '2026-07-20';
                  const isCurrentMonth = date.getMonth() === 6;
                  return (
                    <div key={i} className={`rounded p-1.5 min-h-[48px] ${isToday ? 'bg-luxury-gold/10 ring-1 ring-luxury-gold' : 'hover:bg-muted/50'} ${!isCurrentMonth ? 'opacity-30' : ''}`}>
                      <span className={`text-xs ${isToday ? 'font-bold text-luxury-gold' : 'text-muted-foreground'}`}>{date.getDate()}</span>
                      {postsOnDay.map(p => (
                        <div key={p.id} className={`mt-0.5 rounded px-1 py-0.5 text-[10px] font-medium truncate ${platformColors[p.platform]}`}>
                          {p.platform.slice(0, 2)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'segments' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map(seg => (
            <div key={seg.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{seg.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{seg.criteria}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${seg.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {seg.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {seg.growth >= 0 ? '+' : ''}{seg.growth}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted p-2 text-center">
                  <p className="text-xs text-muted-foreground">Contacts</p>
                  <p className="text-lg font-bold">{seg.count.toLocaleString()}</p>
                </div>
                <div className="rounded-md bg-muted p-2 text-center">
                  <p className="text-xs text-muted-foreground">Avg Spend</p>
                  <p className="text-lg font-bold">{formatCurrency(seg.avgSpend)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">New {tab === 'social' ? 'Social Post' : 'Campaign'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{tab === 'social' ? 'Platform' : 'Campaign Name'}</label>
                {tab === 'social' ? (
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                    <option>Instagram</option><option>Facebook</option><option>Twitter</option><option>TikTok</option>
                  </select>
                ) : (
                  <input type="text" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" placeholder="Campaign name" />
                )}
              </div>
              {tab !== 'social' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                      <option>Email</option><option>SMS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Audience</label>
                    <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold">
                      {segments.map(s => <option key={s.id}>{s.name} ({s.count})</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{tab === 'social' ? 'Content' : 'Subject / Content'}</label>
                <textarea className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold h-24 resize-none" placeholder={tab === 'social' ? 'Write your post...' : 'Subject line or content'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Schedule</label>
                <input type="datetime-local" className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-luxury-gold" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button className="rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80 transition-colors">Save Draft</button>
              <button onClick={() => setShowCreate(false)} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors">Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);
}

import { Platform, PostStatus, PostType } from '@social-media-os/shared';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
}

export interface StatsCard {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
}

export interface PostFormData {
  content: Record<string, string>;
  platforms: Platform[];
  postType: PostType;
  mediaUrls: string[];
  scheduledAt?: Date | null;
}

export interface CalendarPost {
  id: string;
  title: string;
  platforms: Platform[];
  status: PostStatus;
  scheduledAt: Date;
}

export interface AIGenerationForm {
  prompt: string;
  platform: Platform;
  action: string;
  format: string;
  brandVoiceId?: string;
}

export interface EngagementItem {
  id: string;
  platform: Platform;
  authorName: string;
  authorAvatar: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
  postId: string;
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

export interface ContentLibraryItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'document';
  size: number;
  folderId?: string;
  createdAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

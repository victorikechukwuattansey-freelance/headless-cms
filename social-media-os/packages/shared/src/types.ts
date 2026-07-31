import { Platform, PostStatus, PostType, WorkspaceRole, SubscriptionTier } from './enums';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  brandVoiceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface SocialAccount {
  id: string;
  workspaceId: string;
  platform: Platform;
  accountName: string;
  accountId: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  workspaceId: string;
  authorId: string;
  content: Record<string, string>;
  mediaUrls: string[];
  postType: PostType;
  status: PostStatus;
  platforms: Platform[];
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostVersion {
  id: string;
  postId: string;
  platform: Platform;
  content: string;
  mediaUrls: string[];
  status: PostStatus;
  platformPostId: string | null;
  platformPostUrl: string | null;
  errorMessage: string | null;
  publishedAt: Date | null;
}

export interface BrandVoice {
  id: string;
  workspaceId: string;
  name: string;
  personality: string[];
  audience: string;
  writingStyle: string;
  forbiddenWords: string[];
  approvedTerms: string[];
  brandColors: Record<string, string>;
  fonts: Record<string, string>;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIGeneration {
  id: string;
  workspaceId: string;
  userId: string;
  provider: string;
  model: string;
  action: string;
  prompt: string;
  result: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  createdAt: Date;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  isActive: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTrigger {
  type: 'schedule' | 'webhook' | 'event';
  config: Record<string, unknown>;
}

export interface WorkflowAction {
  type: string;
  config: Record<string, unknown>;
  order: number;
}

export interface MCPServer {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  url: string;
  apiKey: string | null;
  isConnected: boolean;
  tools: MCPTool[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AnalyticsEvent {
  id: string;
  workspaceId: string;
  platform: Platform;
  eventType: string;
  postId: string | null;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface AnalyticsMetric {
  id: string;
  workspaceId: string;
  platform: Platform;
  date: Date;
  followers: number;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  platforms: Platform[];
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

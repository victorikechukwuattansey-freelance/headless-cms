import { Platform, PostStatus, PostType, AIAction, ContentFormat, WorkspaceRole, SubscriptionTier } from '@social-media-os/shared';

export const APP_NAME = 'Social Media OS';
export const APP_DESCRIPTION = 'AI-powered social media management platform';

export const PLATFORM_LABELS: Record<Platform, string> = {
  [Platform.FACEBOOK]: 'Facebook',
  [Platform.INSTAGRAM]: 'Instagram',
  [Platform.THREADS]: 'Threads',
  [Platform.TWITTER]: 'X (Twitter)',
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.TIKTOK]: 'TikTok',
  [Platform.PINTEREST]: 'Pinterest',
  [Platform.YOUTUBE]: 'YouTube',
  [Platform.GOOGLE_BUSINESS]: 'Google Business',
  [Platform.REDDIT]: 'Reddit',
  [Platform.BLUESKY]: 'Bluesky',
  [Platform.TELEGRAM]: 'Telegram',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  [Platform.FACEBOOK]: '#1877F2',
  [Platform.INSTAGRAM]: '#E4405F',
  [Platform.THREADS]: '#000000',
  [Platform.TWITTER]: '#1DA1F2',
  [Platform.LINKEDIN]: '#0A66C2',
  [Platform.TIKTOK]: '#000000',
  [Platform.PINTEREST]: '#BD081C',
  [Platform.YOUTUBE]: '#FF0000',
  [Platform.GOOGLE_BUSINESS]: '#4285F4',
  [Platform.REDDIT]: '#FF4500',
  [Platform.BLUESKY]: '#0085FF',
  [Platform.TELEGRAM]: '#26A5E4',
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  [PostStatus.DRAFT]: 'Draft',
  [PostStatus.SCHEDULED]: 'Scheduled',
  [PostStatus.PUBLISHING]: 'Publishing',
  [PostStatus.PUBLISHED]: 'Published',
  [PostStatus.FAILED]: 'Failed',
  [PostStatus.CANCELLED]: 'Cancelled',
};

export const POST_STATUS_COLORS: Record<PostStatus, string> = {
  [PostStatus.DRAFT]: 'bg-gray-500',
  [PostStatus.SCHEDULED]: 'bg-blue-500',
  [PostStatus.PUBLISHING]: 'bg-yellow-500',
  [PostStatus.PUBLISHED]: 'bg-green-500',
  [PostStatus.FAILED]: 'bg-red-500',
  [PostStatus.CANCELLED]: 'bg-gray-400',
};

export const POST_TYPE_LABELS: Record<PostType, string> = {
  [PostType.TEXT]: 'Text',
  [PostType.IMAGE]: 'Image',
  [PostType.VIDEO]: 'Video',
  [PostType.CAROUSEL]: 'Carousel',
  [PostType.STORY]: 'Story',
  [PostType.THREAD]: 'Thread',
  [PostType.ARTICLE]: 'Article',
};

export const AI_ACTION_LABELS: Record<AIAction, string> = {
  [AIAction.GENERATE]: 'Generate',
  [AIAction.REPURPOSE]: 'Repurpose',
  [AIAction.IMPROVE]: 'Improve',
  [AIAction.REWRITE]: 'Rewrite',
  [AIAction.EXPAND]: 'Expand',
  [AIAction.SUMMARIZE]: 'Summarize',
  [AIAction.TRANSLATE]: 'Translate',
  [AIAction.ANALYZE]: 'Analyze',
};

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  [ContentFormat.SHORT_CAPTION]: 'Short Caption',
  [ContentFormat.LONG_POST]: 'Long Post',
  [ContentFormat.THREAD]: 'Thread',
  [ContentFormat.CAROUSEL]: 'Carousel',
  [ContentFormat.VIDEO_SCRIPT]: 'Video Script',
  [ContentFormat.ARTICLE]: 'Article',
  [ContentFormat.NEWSLETTER]: 'Newsletter',
  [ContentFormat.STORY]: 'Story',
  [ContentFormat.PIN]: 'Pin',
};

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  [WorkspaceRole.OWNER]: 'Owner',
  [WorkspaceRole.ADMIN]: 'Admin',
  [WorkspaceRole.EDITOR]: 'Editor',
  [WorkspaceRole.VIEWER]: 'Viewer',
};

export const SUBSCRIPTION_TIER_LABELS: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: 'Free',
  [SubscriptionTier.STARTER]: 'Starter',
  [SubscriptionTier.PRO]: 'Pro',
  [SubscriptionTier.AGENCY]: 'Agency',
  [SubscriptionTier.ENTERPRISE]: 'Enterprise',
};

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Posts', href: '/posts', icon: 'FileText' },
  { label: 'Calendar', href: '/calendar', icon: 'Calendar' },
  { label: 'AI Studio', href: '/ai-studio', icon: 'Sparkles' },
  { label: 'Analytics', href: '/analytics', icon: 'BarChart3' },
  { label: 'Engagement', href: '/engagement', icon: 'MessageCircle' },
  { label: 'Content Library', href: '/content-library', icon: 'Image' },
  { label: 'Brand Voice', href: '/brand-voice', icon: 'Palette' },
  { label: 'Workflows', href: '/workflows', icon: 'GitBranch' },
  { label: 'Campaigns', href: '/campaigns', icon: 'Flag' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
];

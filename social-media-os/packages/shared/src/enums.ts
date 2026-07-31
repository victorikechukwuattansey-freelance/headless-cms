export enum Platform {
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  THREADS = 'threads',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  TIKTOK = 'tiktok',
  PINTEREST = 'pinterest',
  YOUTUBE = 'youtube',
  GOOGLE_BUSINESS = 'google_business',
  REDDIT = 'reddit',
  BLUESKY = 'bluesky',
  TELEGRAM = 'telegram',
}

export enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  CAROUSEL = 'carousel',
  STORY = 'story',
  THREAD = 'thread',
  ARTICLE = 'article',
}

export enum ContentFormat {
  SHORT_CAPTION = 'short_caption',
  LONG_POST = 'long_post',
  THREAD = 'thread',
  CAROUSEL = 'carousel',
  VIDEO_SCRIPT = 'video_script',
  ARTICLE = 'article',
  NEWSLETTER = 'newsletter',
  STORY = 'story',
  PIN = 'pin',
}

export enum AIServiceProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  OLLAMA = 'ollama',
}

export enum AIAction {
  GENERATE = 'generate',
  REPURPOSE = 'repurpose',
  IMPROVE = 'improve',
  REWRITE = 'rewrite',
  EXPAND = 'expand',
  SUMMARIZE = 'summarize',
  TRANSLATE = 'translate',
  ANALYZE = 'analyze',
}

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  AGENCY = 'agency',
  ENTERPRISE = 'enterprise',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum AnalyticsEventType {
  POST_PUBLISHED = 'post_published',
  POST_SCHEDULED = 'post_scheduled',
  POST_FAILED = 'post_failed',
  AI_GENERATION = 'ai_generation',
  ENGAGEMENT_RECEIVED = 'engagement_received',
  ACCOUNT_CONNECTED = 'account_connected',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
}

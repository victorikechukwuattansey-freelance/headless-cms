import { Platform, PostType } from './enums';

export interface PlatformConfig {
  id: Platform;
  name: string;
  icon: string;
  color: string;
  supports: PostType[];
  maxChars: number;
  maxImages: number;
  maxVideoSeconds: number;
  oauthVersion: '2.0' | '1.0a';
  baseUrl: string;
}

export const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  [Platform.FACEBOOK]: {
    id: Platform.FACEBOOK,
    name: 'Facebook',
    icon: 'facebook',
    color: '#1877F2',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO],
    maxChars: 63206,
    maxImages: 10,
    maxVideoSeconds: 14400,
    oauthVersion: '2.0',
    baseUrl: 'https://graph.facebook.com/v19.0',
  },
  [Platform.INSTAGRAM]: {
    id: Platform.INSTAGRAM,
    name: 'Instagram',
    icon: 'instagram',
    color: '#E4405F',
    supports: [PostType.IMAGE, PostType.VIDEO, PostType.CAROUSEL, PostType.STORY],
    maxChars: 2200,
    maxImages: 10,
    maxVideoSeconds: 600,
    oauthVersion: '2.0',
    baseUrl: 'https://graph.facebook.com/v19.0',
  },
  [Platform.THREADS]: {
    id: Platform.THREADS,
    name: 'Threads',
    icon: 'threads',
    color: '#000000',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO],
    maxChars: 500,
    maxImages: 10,
    maxVideoSeconds: 300,
    oauthVersion: '2.0',
    baseUrl: 'https://graph.threads.net/v1.0',
  },
  [Platform.TWITTER]: {
    id: Platform.TWITTER,
    name: 'X (Twitter)',
    icon: 'twitter',
    color: '#1DA1F2',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO, PostType.THREAD],
    maxChars: 25000,
    maxImages: 4,
    maxVideoSeconds: 140,
    oauthVersion: '2.0',
    baseUrl: 'https://api.twitter.com/2',
  },
  [Platform.LINKEDIN]: {
    id: Platform.LINKEDIN,
    name: 'LinkedIn',
    icon: 'linkedin',
    color: '#0A66C2',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO, PostType.ARTICLE],
    maxChars: 3000,
    maxImages: 9,
    maxVideoSeconds: 600,
    oauthVersion: '2.0',
    baseUrl: 'https://api.linkedin.com/v2',
  },
  [Platform.TIKTOK]: {
    id: Platform.TIKTOK,
    name: 'TikTok',
    icon: 'tiktok',
    color: '#000000',
    supports: [PostType.VIDEO],
    maxChars: 2200,
    maxImages: 0,
    maxVideoSeconds: 600,
    oauthVersion: '2.0',
    baseUrl: 'https://open-api.tiktok.com',
  },
  [Platform.PINTEREST]: {
    id: Platform.PINTEREST,
    name: 'Pinterest',
    icon: 'pinterest',
    color: '#BD081C',
    supports: [PostType.IMAGE, PostType.VIDEO],
    maxChars: 500,
    maxImages: 1,
    maxVideoSeconds: 600,
    oauthVersion: '2.0',
    baseUrl: 'https://api.pinterest.com/v5',
  },
  [Platform.YOUTUBE]: {
    id: Platform.YOUTUBE,
    name: 'YouTube',
    icon: 'youtube',
    color: '#FF0000',
    supports: [PostType.VIDEO],
    maxChars: 5000,
    maxImages: 0,
    maxVideoSeconds: 43200,
    oauthVersion: '2.0',
    baseUrl: 'https://www.googleapis.com/youtube/v3',
  },
  [Platform.GOOGLE_BUSINESS]: {
    id: Platform.GOOGLE_BUSINESS,
    name: 'Google Business Profile',
    icon: 'google',
    color: '#4285F4',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO],
    maxChars: 1500,
    maxImages: 10,
    maxVideoSeconds: 30,
    oauthVersion: '2.0',
    baseUrl: 'https://mybusiness.googleapis.com/v4',
  },
  [Platform.REDDIT]: {
    id: Platform.REDDIT,
    name: 'Reddit',
    icon: 'reddit',
    color: '#FF4500',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO],
    maxChars: 40000,
    maxImages: 1,
    maxVideoSeconds: 60,
    oauthVersion: '2.0',
    baseUrl: 'https://oauth.reddit.com',
  },
  [Platform.BLUESKY]: {
    id: Platform.BLUESKY,
    name: 'Bluesky',
    icon: 'bluesky',
    color: '#0085FF',
    supports: [PostType.TEXT, PostType.IMAGE],
    maxChars: 300,
    maxImages: 4,
    maxVideoSeconds: 0,
    oauthVersion: '2.0',
    baseUrl: 'https://bsky.social/xrpc',
  },
  [Platform.TELEGRAM]: {
    id: Platform.TELEGRAM,
    name: 'Telegram',
    icon: 'telegram',
    color: '#26A5E4',
    supports: [PostType.TEXT, PostType.IMAGE, PostType.VIDEO],
    maxChars: 4096,
    maxImages: 10,
    maxVideoSeconds: 600,
    oauthVersion: '2.0',
    baseUrl: 'https://api.telegram.org/bot',
  },
};

export function getPlatform(id: Platform): PlatformConfig {
  return PLATFORM_CONFIGS[id];
}

export function listPlatforms(): PlatformConfig[] {
  return Object.values(PLATFORM_CONFIGS);
}

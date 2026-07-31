import { Platform } from './enums';

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getPlatformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    [Platform.FACEBOOK]: 'Facebook',
    [Platform.INSTAGRAM]: 'Instagram',
    [Platform.THREADS]: 'Threads',
    [Platform.TWITTER]: 'X (Twitter)',
    [Platform.LINKEDIN]: 'LinkedIn',
    [Platform.TIKTOK]: 'TikTok',
    [Platform.PINTEREST]: 'Pinterest',
    [Platform.YOUTUBE]: 'YouTube',
    [Platform.GOOGLE_BUSINESS]: 'Google Business Profile',
    [Platform.REDDIT]: 'Reddit',
    [Platform.BLUESKY]: 'Bluesky',
    [Platform.TELEGRAM]: 'Telegram',
  };
  return labels[platform];
}

export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of array) {
    if (predicate(item)) pass.push(item);
    else fail.push(item);
  }
  return [pass, fail];
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

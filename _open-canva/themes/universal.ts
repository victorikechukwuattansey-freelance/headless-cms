import type { DesignSystem } from '@opencanva/core';

export const universal: DesignSystem = {
  palette: {
    bg: '#ffffff',
    fg: '#0f1419',
    muted: '#536471',
    accent: '#1d9bf0',
    accent2: '#ff6b35',
    surface: '#f7f9f9',
  },
  fonts: {
    display: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 12,
  vibe: 'Universal design system — clean, modern, professional.',
  tags: ['light', 'universal', 'modern', 'social-media'],
};

export const universalDark: DesignSystem = {
  palette: {
    bg: '#0f1419',
    fg: '#e7e9ea',
    muted: '#71767b',
    accent: '#1d9bf0',
    accent2: '#ff6b35',
    surface: '#1a1f24',
  },
  fonts: {
    display: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 12,
  vibe: 'Universal design system dark — dark mode social media.',
  tags: ['dark', 'universal', 'modern'],
};

/* Industry-specific theme variants */

export const universalRestaurant: DesignSystem = {
  palette: {
    bg: '#faf6f0',
    fg: '#1a1a1a',
    muted: '#8a7a6a',
    accent: '#c8553d',
    accent2: '#e8b84b',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 16,
  vibe: 'Restaurant social — warm cream, terracotta, gold.',
  tags: ['light', 'restaurant', 'food', 'warm'],
};

export const universalFashion: DesignSystem = {
  palette: {
    bg: '#faf5f0',
    fg: '#1a1a1a',
    muted: '#8a7a6a',
    accent: '#6b1a2a',
    accent2: '#c9a84c',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 4,
  vibe: 'Fashion social — ivory, burgundy, gold, luxury.',
  tags: ['light', 'fashion', 'luxury', 'elegant'],
};

export const universalRealEstate: DesignSystem = {
  palette: {
    bg: '#f8f9fa',
    fg: '#1a2332',
    muted: '#6c7a89',
    accent: '#1a5276',
    accent2: '#e8a838',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Inter', -apple-system, sans-serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 8,
  vibe: 'Real estate social — navy, gold, clean professional.',
  tags: ['light', 'real-estate', 'professional'],
};

export const universalFitness: DesignSystem = {
  palette: {
    bg: '#0a0a0a',
    fg: '#ffffff',
    muted: '#6b7280',
    accent: '#ef4444',
    accent2: '#f97316',
    surface: '#1a1a1a',
  },
  fonts: {
    display: "'Inter', -apple-system, sans-serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 8,
  vibe: 'Fitness social — dark, red-orange, high energy.',
  tags: ['dark', 'fitness', 'energy', 'bold'],
};

export const universalBeauty: DesignSystem = {
  palette: {
    bg: '#fdf2f8',
    fg: '#1a1a2e',
    muted: '#a78ba0',
    accent: '#d9468b',
    accent2: '#e8a8c8',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 16,
  vibe: 'Beauty social — blush pink, mauve, elegant.',
  tags: ['light', 'beauty', 'feminine', 'elegant'],
};

export const universalTech: DesignSystem = {
  palette: {
    bg: '#ffffff',
    fg: '#0f172a',
    muted: '#64748b',
    accent: '#2563eb',
    accent2: '#06b6d4',
    surface: '#f8fafc',
  },
  fonts: {
    display: "'Inter', -apple-system, sans-serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 8,
  vibe: 'Tech social — white, blue, cyan, modern.',
  tags: ['light', 'tech', 'modern', 'corporate'],
};

export const universalFinance: DesignSystem = {
  palette: {
    bg: '#f8fafc',
    fg: '#0f172a',
    muted: '#64748b',
    accent: '#059669',
    accent2: '#0ea5e9',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Inter', -apple-system, sans-serif",
    body: "'Inter', -apple-system, sans-serif",
  },
  radius: 4,
  vibe: 'Finance social — white, green, blue, trusted.',
  tags: ['light', 'finance', 'professional', 'corporate'],
};

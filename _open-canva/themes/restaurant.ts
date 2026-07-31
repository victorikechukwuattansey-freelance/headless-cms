import type { DesignSystem } from '@opencanva/core';

export const restaurant: DesignSystem = {
  palette: {
    bg: '#faf6f0',
    fg: '#1a1a1a',
    muted: '#6b8f5e',
    accent: '#c8553d',
    accent2: '#e8b84b',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  },
  radius: 16,
  vibe: 'Warm restaurant palette — charcoal, cream, terracotta, olive, gold.',
  tags: ['light', 'warm', 'elegant', 'restaurant'],
};

export const restaurantDark: DesignSystem = {
  palette: {
    bg: '#1a1a1a',
    fg: '#faf6f0',
    muted: '#a09080',
    accent: '#c8553d',
    accent2: '#e8b84b',
    surface: '#2a2a2a',
  },
  fonts: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  },
  radius: 16,
  vibe: 'Dark restaurant — charcoal base, terracotta and gold accents.',
  tags: ['dark', 'elegant', 'restaurant'],
};

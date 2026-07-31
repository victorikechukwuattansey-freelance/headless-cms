import type { DesignSystem } from '@opencanva/core';

export const luxecafe: DesignSystem = {
  palette: {
    bg: '#fff8f0',
    fg: '#2c1810',
    muted: '#a0846a',
    accent: '#3c2415',
    accent2: '#c68e4e',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 16,
  vibe: 'Premium café — cream, espresso, caramel, warm taupe.',
  tags: ['light', 'cafe', 'warm', 'premium', 'restaurant'],
};

export const luxecafeDark: DesignSystem = {
  palette: {
    bg: '#2c1810',
    fg: '#fff8f0',
    muted: '#a0846a',
    accent: '#c68e4e',
    accent2: '#6d4c41',
    surface: '#3c2415',
  },
  fonts: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 16,
  vibe: 'Premium café dark — espresso base, gold accents.',
  tags: ['dark', 'cafe', 'warm', 'premium'],
};

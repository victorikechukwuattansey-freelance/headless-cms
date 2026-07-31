import type { DesignSystem } from '@opencanva/core';

export const orelis: DesignSystem = {
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
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 4,
  vibe: 'Luxury fashion — ivory, deep burgundy, gold, charcoal.',
  tags: ['light', 'luxury', 'elegant', 'fashion'],
};

export const orelisDark: DesignSystem = {
  palette: {
    bg: '#1a1a1a',
    fg: '#faf5f0',
    muted: '#a09080',
    accent: '#c9a84c',
    accent2: '#6b1a2a',
    surface: '#2a2a2a',
  },
  fonts: {
    display: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 4,
  vibe: 'Luxury fashion dark — charcoal base, gold and burgundy accents.',
  tags: ['dark', 'luxury', 'elegant', 'fashion'],
};

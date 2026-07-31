import type { DesignSystem } from '@opencanva/core';

export const luxe: DesignSystem = {
  palette: {
    bg: '#fdfbf7',
    fg: '#1c1c1a',
    muted: '#8a8280',
    accent: '#3c3028',
    accent2: '#c9a86c',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  },
  radius: 8,
  vibe: 'Premium café — warm ivory, espresso brown, champagne gold.',
  tags: ['light', 'elegant', 'premium', 'cafe', 'luxury'],
};

export const luxeDark: DesignSystem = {
  palette: {
    bg: '#1c1c1a',
    fg: '#fdfbf7',
    muted: '#9a9290',
    accent: '#c9a86c',
    accent2: '#3c3028',
    surface: '#2a2826',
  },
  fonts: {
    display: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  },
  radius: 8,
  vibe: 'Dark premium café — charcoal base, champagne gold, espresso.',
  tags: ['dark', 'elegant', 'premium', 'cafe', 'luxury'],
};

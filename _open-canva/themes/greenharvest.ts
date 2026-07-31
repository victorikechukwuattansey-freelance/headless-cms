import type { DesignSystem } from '@opencanva/core';

export const greenharvest: DesignSystem = {
  palette: {
    bg: '#f5f0e8',
    fg: '#2d2a24',
    muted: '#7a8a70',
    accent: '#2d5a27',
    accent2: '#4caf50',
    surface: '#ffffff',
  },
  fonts: {
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 12,
  vibe: 'Organic food — cream, forest green, sage, fresh green.',
  tags: ['light', 'organic', 'natural', 'earthy', 'food'],
};

export const greenharvestDark: DesignSystem = {
  palette: {
    bg: '#2d2a24',
    fg: '#f5f0e8',
    muted: '#8a9a80',
    accent: '#4a8a3e',
    accent2: '#66bb6a',
    surface: '#3a3730',
  },
  fonts: {
    display: "'Fraunces', Georgia, 'Times New Roman', serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif',
  },
  radius: 12,
  vibe: 'Organic food dark — charcoal, forest green, fresh green.',
  tags: ['dark', 'organic', 'natural', 'earthy', 'food'],
};

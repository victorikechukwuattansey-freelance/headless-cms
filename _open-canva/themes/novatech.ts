import type { DesignSystem } from '@opencanva/core';

export const novatech: DesignSystem = {
  palette: {
    bg: '#ffffff',
    fg: '#0f172a',
    muted: '#64748b',
    accent: '#2563eb',
    accent2: '#06b6d4',
    surface: '#f8fafc',
  },
  fonts: {
    display: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 8,
  vibe: 'Modern tech startup — white, navy, blue, cyan.',
  tags: ['light', 'tech', 'modern', 'corporate'],
};

export const novatechDark: DesignSystem = {
  palette: {
    bg: '#0f172a',
    fg: '#f1f5f9',
    muted: '#94a3b8',
    accent: '#3b82f6',
    accent2: '#06b6d4',
    surface: '#1e293b',
  },
  fonts: {
    display: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
    body: "'Inter', -apple-system, 'Helvetica Neue', sans-serif",
  },
  radius: 8,
  vibe: 'Tech startup dark — navy base, blue and cyan accents.',
  tags: ['dark', 'tech', 'modern', 'corporate'],
};

// Re-registers the restaurant + restaurantDark themes in designPresets
// after `npm install` (which clobbers node_modules edits).
// Also fixes Windows @fs path bug.
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function applyThemePatch() {
  const target = join(__dirname, '..', 'node_modules', '@opencanva', 'core', 'src', 'design.ts');
  let src = readFileSync(target, 'utf8');

  const restaurant = {
    palette: { bg: '#faf6f0', fg: '#1a1a1a', muted: '#6b8f5e', accent: '#c8553d', accent2: '#e8b84b', surface: '#ffffff' },
    fonts: { display: "'Playfair Display', Georgia, 'Times New Roman', serif", body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif" },
    radius: 16, vibe: 'Warm restaurant palette — charcoal, cream, terracotta, olive, gold.',
    tags: ['light', 'warm', 'elegant', 'restaurant'],
  };
  const restaurantDark = {
    palette: { bg: '#1a1a1a', fg: '#faf6f0', muted: '#a09080', accent: '#c8553d', accent2: '#e8b84b', surface: '#2a2a2a' },
    fonts: { display: "'Playfair Display', Georgia, 'Times New Roman', serif", body: "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif" },
    radius: 16, vibe: 'Dark restaurant — charcoal base, terracotta and gold accents.',
    tags: ['dark', 'elegant', 'restaurant'],
  };

  function tsLit(o) {
    if (typeof o === 'string') return JSON.stringify(o);
    if (Array.isArray(o)) return `[${o.map(tsLit).join(', ')}]`;
    if (typeof o === 'number') return String(o);
    const entries = Object.entries(o).map(([k, v]) => `${k}: ${tsLit(v)}`);
    return `{ ${entries.join(', ')} }`;
  }

  const patch = `\ndesignPresets.restaurant = ${tsLit(restaurant)};\ndesignPresets.restaurantDark = ${tsLit(restaurantDark)};\n`;

  if (src.includes('designPresets.restaurant')) {
    console.log('restaurant theme already patched');
  } else {
    src = src.replace('/** Resolve the effective design', `${patch}\n/** Resolve the effective design`);
    writeFileSync(target, src, 'utf8');
    console.log('Patched restaurant theme into designPresets');
  }
}

function fixFsPathBug() {
  const target = join(__dirname, '..', 'node_modules', '@opencanva', 'core', 'src', 'vite', 'opencanva-plugin.ts');
  let src = readFileSync(target, 'utf8');
  // Fix Windows @fs path: `/@fs${path}` → `/@fs/${path}`
  if (src.includes("`/@fs${normalizePath(e.abs)}`")) {
    src = src.replace("`/@fs${normalizePath(e.abs)}`", "`/@fs/${normalizePath(e.abs)}`");
    writeFileSync(target, src, 'utf8');
    console.log('Fixed Windows @fs path bug in opencanva-plugin.ts');
  } else {
    console.log('@fs path already fixed or not found');
  }
}

applyThemePatch();
fixFsPathBug();

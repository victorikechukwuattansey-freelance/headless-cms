import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = join(process.cwd(), 'kaya-renovations');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const PAGES = {
  'index.html': {
    active: 'home',
    title: 'Home',
    description: 'Family-run home renovation contractor in Lagos — kitchens, bathrooms, roofing, tiling, painting and extensions with a 2-year warranty.',
  },
  'about.html': {
    active: 'about',
    title: 'About Us',
    description: 'Meet the family behind Kaya Renovations — 10+ years of experience, licensed and insured, 300+ projects delivered.',
  },
  'services.html': {
    active: 'services',
    title: 'Services & Pricing',
    description: 'Renovation services with clear scope of work and starting prices — kitchen, bathroom, roofing, tiling, painting and extensions.',
  },
  'gallery.html': {
    active: 'gallery',
    title: 'Project Gallery',
    description: 'Before and after photos of real Kaya Renovations projects across Lagos.',
  },
  'process.html': {
    active: 'process',
    title: 'How We Work',
    description: 'A 5-step renovation process — consult, quote, plan, build, handover. No surprises.',
  },
  'tips.html': {
    active: 'tips',
    title: 'Renovation Tips',
    description: 'Practical guides on roofing, kitchen budgets and tiling from the Kaya Renovations team.',
  },
  'contact.html': {
    active: 'contact',
    title: 'Contact',
    description: 'Get a free quote — call, WhatsApp or send a message. We reply within one business day.',
  },
};

const header = readFileSync(join(SRC, 'partials', 'header.html'), 'utf8');
const footer = readFileSync(join(SRC, 'partials', 'footer.html'), 'utf8');

function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const srcPath = join(from, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, join(to, entry));
    } else {
      copyFileSync(srcPath, join(to, entry));
    }
  }
}

mkdirSync(join(DIST, 'assets'), { recursive: true });

for (const [file, meta] of Object.entries(PAGES)) {
  const source = readFileSync(join(SRC, 'pages', file), 'utf8');
  const html = source
    .replace('{{header}}', header)
    .replace('{{footer}}', footer)
    .replace('{{page-title}}', meta.title)
    .replace('{{page-description}}', meta.description)
    .replace(/\{\{active-(\w+)\}\}/g, (_, page) => (page === meta.active ? ' aria-current="page"' : ''));
  writeFileSync(join(DIST, file), html);
  console.log(`built ${file}`);
}

copyDir(join(SRC, 'assets'), join(DIST, 'assets'));

console.log('compiling CSS...');
execSync(`npx @tailwindcss/cli -i "${join(SRC, 'input.css')}" -o "${join(DIST, 'assets', 'styles.css')}" --minify`, {
  cwd: ROOT,
  stdio: 'inherit',
});

console.log('done ->', DIST);

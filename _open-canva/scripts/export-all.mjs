// Batch-export all restaurant kit designs from open-canva to PNG.
// Usage: node scripts/export-all.mjs [output-dir]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = process.argv[2] || join(projectRoot, 'exports');
mkdirSync(outDir, { recursive: true });

const DESIGNS = [
  // Menu & Dishes (10)
  'dish-spotlight', 'daily-special', 'chefs-pick', 'platter-closeup',
  'new-menu-item', 'ingredient-hero', 'combo-deal', 'drink-special',
  'dessert-feature', 'our-menu-carousel',
  // Promotions (8)
  'happy-hour', 'limited-offer', 'bogo', 'loyalty-promo',
  'student-discount', 'family-meal-deal', 'free-delivery', 'first-visit-offer',
  // Events & Seasonal (6)
  'live-music-night', 'holiday-special', 'weekend-brunch', 'new-year-party',
  'valentines-dinner', 'seasonal-menu-launch',
  // Behind the Scenes (4)
  'meet-the-chef', 'kitchen-prep', 'ingredient-source', 'staff-spotlight',
  // Testimonials (4)
  'customer-review', 'most-loved-dish', 'media-feature', 'rating-promo',
  // Hours & Info (4)
  'open-hours', 'location', 'delivery-info', 'contact',
  // Stories (4)
  'promo-story', 'poll-story', 'menu-story', 'hours-story',
];

function pad2(n) { return String(n).padStart(2, '0'); }

async function waitForServer(url, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetch(url);
      if (resp.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} not ready after ${retries}s`);
}

async function main() {
  // Start dev server
  const server = spawn('npx', ['opencanva', 'dev', '--host', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  const baseUrl = 'http://localhost:5173';

  console.log('Waiting for dev server...');
  await waitForServer(baseUrl);
  console.log('Dev server ready.');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
  });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  let i = 0;
  for (const id of DESIGNS) {
    i++;
    const url = `${baseUrl}/d/${id}`;
    const filename = `${pad2(i)}-${id}.png`;
    const filepath = join(outDir, filename);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);

      // Find the artboard element and screenshot it
      const artboard = page.locator('[data-ox-board]');
      await artboard.screenshot({ path: filepath });
      console.log(`  [${pad2(i)}/${DESIGNS.length}] ${id} → ${filename}`);
    } catch (err) {
      console.error(`  [${pad2(i)}/${DESIGNS.length}] ${id} FAILED: ${err.message}`);
    }
  }

  await browser.close();
  server.kill();
  console.log(`\nDone. ${DESIGNS.length} designs exported to ${outDir}`);
}

main().catch(err => { console.error(err); process.exit(1); });

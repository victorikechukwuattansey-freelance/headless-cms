import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'restaurant-kit-output');
mkdirSync(OUTPUT, { recursive: true });

async function main() {
  console.log('Creating laptop mockup...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-preview.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const section = await page.locator('.section').first();
  const sectionShot = await section.screenshot({ type: 'png' });
  await browser.close();

  const screenW = 1200;
  const screenH = 800;
  const lidH = 820;
  // Laptop SVG
  const svg = `
    <svg width="1400" height="1000" viewBox="0 0 1400 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lap-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f0ebe4"/>
          <stop offset="100%" stop-color="#e8e0d8"/>
        </linearGradient>
        <linearGradient id="screen-bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#1a1a1a"/>
        </linearGradient>
      </defs>
      <!-- Lid -->
      <rect x="60" y="40" width="1280" height="${lidH}" rx="16" fill="url(#screen-bezel)"/>
      <!-- Screen area -->
      <rect x="100" y="70" width="${screenW}" height="${screenH}" rx="4" fill="#fff"/>
      <!-- Bottom base -->
      <path d="M0 ${lidH + 40} L1400 ${lidH + 40} L1350 ${lidH + 120} L50 ${lidH + 120} Z" fill="#d0c8c0" stroke="#c0b8b0" stroke-width="1"/>
      <!-- Hinge -->
      <rect x="600" y="${lidH + 30}" width="200" height="14" rx="4" fill="#999"/>
    </svg>
  `;

  const screenImg = await sharp(sectionShot)
    .resize(screenW, screenH, { fit: 'contain', background: '#fff' })
    .png()
    .toBuffer();

  const outPath = resolve(OUTPUT, 'restaurant-kit-laptop-mockup.png');
  await sharp(Buffer.from(svg))
    .composite([{ input: screenImg, top: 70, left: 100 }])
    .png()
    .toFile(outPath);
  console.log(`  OK  ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FLYER_DIR = resolve(__dirname, '..', '..', 'Brain', '02 - Projects', 'African Real Estate Agent Growth Kit', '01. Canva Marketing Assets', 'Property Flyers');
const OUTPUT_DIR = resolve(FLYER_DIR, 'rendered-pngs');

const FILES = [
  'luxury-flyer-abuja.html',
  'apartment-flyer-abuja.html',
  'land-flyer-abuja.html',
  'commercial-flyer-abuja.html',
  'rental-flyer-abuja.html',
  'just-listed-flyer-abuja.html',
  'sold-flyer-abuja.html',
  'open-house-flyer-abuja.html',
];

const VIEWPORT = { width: 1654, height: 2339 };

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'en-GB',
    colorScheme: 'light',
  });
  const page = await context.newPage();

  for (const file of FILES) {
    const htmlPath = resolve(FLYER_DIR, file);
    const outName = file.replace('.html', '.png');
    const outPath = resolve(OUTPUT_DIR, outName);
    const label = file.replace('-flyer-abuja.html', '');

    try {
      const html = readFileSync(htmlPath, 'utf-8');
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`  OK  ${label.padEnd(14)} ${outPath}`);
    } catch (err) {
      console.log(`  FAIL ${label.padEnd(14)} ${err.message}`);
    }
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });

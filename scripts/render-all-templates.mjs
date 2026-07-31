import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'restaurant-kit-output', 'template-pngs');
mkdirSync(OUTPUT, { recursive: true });

async function main() {
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-preview.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const frames = await page.locator('.frame').all();
  console.log(`Found ${frames.length} templates\n`);

  for (const frame of frames) {
    const label = await frame.locator('.label .name').textContent();
    const num = await frame.locator('.label .num').textContent();
    const section = await frame.getAttribute('data-section');
    const n = num?.replace('#', '').padStart(2, '0') || '00';
    const safeName = (label || 'template').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const outPath = resolve(OUTPUT, `${n}-${safeName}.png`);

    await frame.screenshot({ path: outPath });
    console.log(`  [${section}] #${n} ${label}`);
  }

  await browser.close();
  console.log(`\nDone — ${frames.length} templates saved to ${OUTPUT}`);
}

main().catch(err => { console.error(err); process.exit(1); });

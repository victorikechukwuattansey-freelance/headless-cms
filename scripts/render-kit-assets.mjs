import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'restaurant-kit-output');

mkdirSync(OUTPUT, { recursive: true });

async function renderInstructionPage() {
  console.log('Rendering instruction page...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-instruction-page.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const outPath = resolve(OUTPUT, 'restaurant-kit-instruction.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`  OK  ${outPath}`);
  return outPath;
}

async function captureTemplateGrid() {
  console.log('Capturing template preview grid...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-preview.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  const outPath = resolve(OUTPUT, 'restaurant-kit-preview-full.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`  OK  ${outPath}`);
  return outPath;
}

async function captureEtsyPreview() {
  console.log('Capturing Etsy listing preview...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-etsy-listing.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const outPath = resolve(OUTPUT, 'restaurant-kit-etsy-preview.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`  OK  ${outPath}`);
  return outPath;
}

async function createInstagramGrid() {
  console.log('Creating Instagram 3x3 feed preview...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-preview.html'), 'utf-8');
  const browser = await chromium.launch();

  const templateNumbers = [1, 2, 3, 11, 12, 13, 19, 20, 21];
  const cells = [];

  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  for (const num of templateNumbers) {
    const selector = `.frame .label:has(.num:text-is("#${String(num).padStart(2, '0')}"))`;
    const frame = await page.locator(selector).first()?.locator('..');
    if (frame) {
      const screenshot = await frame.screenshot({ type: 'png' });
      cells.push(screenshot);
    } else {
      console.log(`  WARN  Could not find template #${num}`);
    }
  }

  await browser.close();

  if (cells.length < 9) {
    console.log(`  WARN  Only found ${cells.length}/9 templates for grid`);
    return;
  }

  const cellSize = 360;
  const gridImg = sharp({
    create: {
      width: cellSize * 3,
      height: cellSize * 3,
      channels: 4,
      background: { r: 250, g: 246, b: 240, alpha: 1 }
    }
  });

  const composites = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    composites.push({
      input: await sharp(cells[i]).resize(cellSize, cellSize, { fit: 'cover' }).toBuffer(),
      top: row * cellSize,
      left: col * cellSize,
    });
  }

  const outPath = resolve(OUTPUT, 'restaurant-kit-instagram-grid.png');
  await gridImg.png().toFile(outPath);
  console.log(`  OK  ${outPath}`);
}

async function createPhoneMockup() {
  console.log('Creating phone mockup...');
  const html = readFileSync(resolve(ROOT, 'restaurant-kit-preview.html'), 'utf-8');
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  const frame = await page.locator('.frame').first();
  const templateScreenshot = await frame.screenshot({ type: 'png' });

  await browser.close();

  const phoneWidth = 600;
  const phoneHeight = 1200;
  const bezel = 24;
  const innerW = phoneWidth - bezel * 2;
  const innerH = phoneHeight - bezel * 2;

  const templateResized = await sharp(templateScreenshot)
    .resize(innerW, innerH, { fit: 'contain', background: { r: 250, g: 246, b: 240, alpha: 1 } })
    .png()
    .toBuffer();

  const phoneSvg = `
    <svg width="${phoneWidth}" height="${phoneHeight}" viewBox="0 0 ${phoneWidth} ${phoneHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="phone-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#1a1a1a"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${phoneWidth}" height="${phoneHeight}" rx="50" fill="url(#phone-bg)" stroke="#444" stroke-width="2"/>
      <rect x="${bezel}" y="${bezel + 60}" width="${innerW}" height="${innerH - 120}" rx="8" fill="#fff"/>
      <!-- notch -->
      <rect x="${phoneWidth/2 - 40}" y="18" width="80" height="12" rx="6" fill="#333"/>
    </svg>
  `;

  const outPath = resolve(OUTPUT, 'restaurant-kit-phone-mockup.png');
  await sharp(Buffer.from(phoneSvg))
    .composite([{ input: templateResized, top: bezel + 60, left: bezel }])
    .png()
    .toFile(outPath);
  console.log(`  OK  ${outPath}`);
}

async function main() {
  await renderInstructionPage();
  await captureTemplateGrid();
  await captureEtsyPreview();
  await createInstagramGrid();
  await createPhoneMockup();
  console.log('\nAll assets rendered.');
}

main().catch(err => { console.error(err); process.exit(1); });

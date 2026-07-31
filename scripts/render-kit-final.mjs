// Render final restaurant kit assets: instruction PDF + listing previews.
// Usage: node scripts/render-kit-final.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'restaurant-kit-output');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
});

async function renderPage(htmlFile, pngName, pdfName) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + htmlFile, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  if (pngName) {
    await page.screenshot({ path: join(outDir, pngName), fullPage: true });
    console.log(`  ✓ ${pngName}`);
  }
  if (pdfName) {
    await page.pdf({ path: join(outDir, pdfName), width: '1080px', height: '1920px', printBackground: true });
    console.log(`  ✓ ${pdfName}`);
  }
  await page.close();
}

console.log('Rendering instruction page...');
await renderPage(
  join(root, 'restaurant-kit-instruction-page.html'),
  'restaurant-kit-instruction.png',
  'restaurant-kit-instruction.pdf',
);

console.log('Rendering Etsy listing preview...');
const page3 = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page3.goto('file://' + join(root, 'restaurant-kit-etsy-listing.html'), { waitUntil: 'networkidle', timeout: 15000 });
await page3.waitForTimeout(1000);
await page3.screenshot({ path: join(outDir, 'restaurant-kit-etsy-preview.png'), fullPage: true });
console.log('  ✓ restaurant-kit-etsy-preview.png');
await page3.close();

await browser.close();
console.log('\nDone. Files in:', outDir);

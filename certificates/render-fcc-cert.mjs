import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CERT_DIR = resolve(__dirname, '..', 'certificates', 'fcc-responsive-web-design');
const OUTPUT_DIR = resolve(CERT_DIR, 'rendered-pngs');

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const page = await context.newPage();

  const htmlPath = resolve(CERT_DIR, 'index.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/').replace(/ /g, '%20'), {
    waitUntil: 'load',
    timeout: 15000,
  });
  await page.waitForTimeout(1500);

  const body = await page.evaluate(() => {
    const pageEl = document.querySelector('.page');
    const cert = document.querySelector('.certificate-wrapper');
    const bc = cert.getBoundingClientRect();
    const pageRect = pageEl.getBoundingClientRect();
    return {
      page: { w: pageRect.width, h: pageRect.height },
      cert: { x: bc.x, y: bc.y, w: bc.width, h: bc.height },
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
    };
  });
  console.log('layout:', JSON.stringify(body, null, 2));

  const outPath = resolve(OUTPUT_DIR, 'certificate-attansey-victor-ikechukwu.png');
  await page.screenshot({ path: outPath, fullPage: false });
  console.log('  OK  ' + outPath);

  await browser.close();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });

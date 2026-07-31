import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('requestfailed', req => {
  console.log('FAILED:', req.url().substring(0, 120), '-', req.failure()?.errorText);
});

page.on('response', resp => {
  if (resp.status() === 404) {
    console.log('404:', resp.url().substring(0, 120));
  }
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

// Try clicking on the dish-spotlight link
const links = await page.$$('a');
console.log('Links found:', links.length);
for (const link of links) {
  const href = await link.getAttribute('href');
  if (href && href.includes('dish')) console.log('Dish link:', href);
}

await page.screenshot({ path: 'exports/homepage.png', fullPage: true });
await browser.close();

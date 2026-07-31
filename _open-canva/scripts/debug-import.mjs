import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('request', req => {
  const url = req.url();
  if (url.includes('design') || url.includes('@fs')) {
    console.log('REQ:', url.substring(0, 150));
  }
});

page.on('response', resp => {
  const url = resp.url();
  if ((url.includes('design') || url.includes('@fs')) && resp.status() === 404) {
    console.log('404:', url.substring(0, 150));
  }
});

// First load the homepage to get the fresh virtual module
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

// Now navigate to a design
await page.goto('http://localhost:5173/d/dish-spotlight', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);
const errText = await page.evaluate(() => document.body.innerText);
console.log('Page text:', errText.substring(0, 500));

await browser.close();

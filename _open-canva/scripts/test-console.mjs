import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);

// Check if designs are listed
const html = await page.content();
console.log('Homepage HTML snippet:', html.substring(3000, 5000));
await page.screenshot({ path: 'exports/homepage.png', fullPage: true });
console.log('Done');
await browser.close();

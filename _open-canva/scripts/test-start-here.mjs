import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Users\\1040 G8\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://localhost:5173/d/start-here', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
console.log('Title:', await page.title());
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('Body text (first 500):', bodyText.substring(0, 500));
await page.screenshot({ path: 'exports/start-here.png', fullPage: true });
console.log('Done');
await browser.close();

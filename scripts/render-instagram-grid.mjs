import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUTPUT = resolve(ROOT, 'restaurant-kit-output');
mkdirSync(OUTPUT, { recursive: true });

async function main() {
  console.log('Creating Instagram feed grid preview...');

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2, locale: 'en-GB', colorScheme: 'light' })).newPage();

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#faf6f0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Inter',sans-serif;padding:20px;}
h2{font-family:'Playfair Display',serif;font-size:20px;color:#1a1a1a;margin-bottom:16px;}
.grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:4px;width:1020px;height:1020px;background:#fff;padding:4px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08);}
.cell{background:#f0ebe4;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;}
.cell .mock{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#a09080;font-weight:600;gap:4px;}
.cell .mock .icon{font-size:32px;}
.cell .label{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(0deg,rgba(0,0,0,0.5),transparent);padding:6px 8px;font-size:10px;color:#fff;font-weight:600;}
.c1{background:linear-gradient(135deg,#faf6f0,#e8ddd0);}
.c2{background:#fff;}
.c3{background:linear-gradient(135deg,#c8553d,#a9442f);}
.c4{background:#1a1a1a;}
.c5{background:linear-gradient(135deg,#6b8f5e,#4d6b42);}
.c6{background:linear-gradient(135deg,#e8b84b,#d4a43a);}

/* Row 1: Menu & Dishes */
.cell-1 .icon{content:"🍽️"}
.cell-2 .icon{content:"🌿"}
.cell-3 .icon{content:"⭐"}

/* Row 2: Promotions */
.cell-4 .icon{content:"🏷️"}
.cell-5 .icon{content:"🎉"}
.cell-6 .icon{content:"🚚"}

/* Row 3: Mixed */
.cell-7 .icon{content:"👨‍🍳"}
.cell-8 .icon{content:"⭐"}
.cell-9 .icon{content:"📍"}
</style>
</head><body>
<h2>Instagram Feed Preview</h2>
<div class="grid">
  <div class="cell c1"><div class="mock"><span class="icon">🍽️</span>Dish Spotlight</div><div class="label">#1 Dish Spotlight</div></div>
  <div class="cell c2"><div class="mock"><span class="icon">🌿</span>Daily Special</div><div class="label">#2 Daily Special</div></div>
  <div class="cell c3"><div class="mock" style="color:#fff;"><span class="icon">⭐</span>Chef's Pick</div><div class="label">#3 Chef's Pick</div></div>
  <div class="cell c4"><div class="mock" style="color:#fff;"><span class="icon">🏷️</span>Happy Hour</div><div class="label">#11 Happy Hour</div></div>
  <div class="cell c5"><div class="mock" style="color:#fff;"><span class="icon">🎉</span>Limited Offer</div><div class="label">#12 Limited Offer</div></div>
  <div class="cell c6"><div class="mock" style="color:#1a1a1a;"><span class="icon">🚚</span>Free Delivery</div><div class="label">#17 Free Delivery</div></div>
  <div class="cell c1"><div class="mock"><span class="icon">👨‍🍳</span>Meet the Chef</div><div class="label">#25 Meet the Chef</div></div>
  <div class="cell c2"><div class="mock"><span class="icon">⭐</span>Customer Review</div><div class="label">#29 Customer Review</div></div>
  <div class="cell c3"><div class="mock" style="color:#fff;"><span class="icon">📍</span>Location</div><div class="label">#34 Location</div></div>
</div>
<p style="margin-top:16px;font-size:12px;color:#64748b;">Mix of square posts showing the variety in this kit</p>
</body></html>`;

  await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  const outPath = resolve(OUTPUT, 'restaurant-kit-instagram-grid.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();
  console.log(`  OK  ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });

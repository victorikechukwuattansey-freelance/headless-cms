import sharp from 'sharp';
import { mkdir, readdir } from 'fs/promises';
import { resolve, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FLYER_DIR = resolve(__dirname, '..', '..', 'Brain', '02 - Projects', 'African Real Estate Agent Growth Kit', '01. Canva Marketing Assets', 'Property Flyers', 'rendered-pngs');
const MOCKUP_DIR = resolve(FLYER_DIR, '..', 'mockups');

/* ── Phone frame SVG (9:16 ratio, clean flat mockup) ───── */
function phoneFrameSVG(screenW, screenH, canvasW, canvasH) {
  const bezel = Math.round(screenW * 0.045);
  const bodyW = screenW + bezel * 2;
  const bodyH = screenH + bezel * 2;
  const radius = Math.round(bodyW * 0.08);
  const bodyX = Math.round((canvasW - bodyW) / 2);
  const bodyY = Math.round((canvasH - bodyH) / 2);
  const screenX = bodyX + bezel;
  const screenY = bodyY + bezel;

  return {
    svg: `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000" flood-opacity="0.35"/>
        </filter>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#1a1a1a"/>
        </linearGradient>
      </defs>
      <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${radius}"
            fill="url(#bodyGrad)" filter="url(#shadow)"/>
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${Math.round(radius * 0.4)}" fill="#fff"/>
    </svg>`,
    screenX,
    screenY,
    screenW,
    screenH,
  };
}

/* ── Laptop frame SVG (16:9 screen, flat mockup) ──────── */
function laptopFrameSVG(screenW, screenH, canvasW, canvasH) {
  const bezel = Math.round(screenW * 0.04);
  const lidW = screenW + bezel * 2;
  const lidH = screenH + bezel * 2;
  const lidRadius = Math.round(lidW * 0.015);

  const hingeGap = Math.round(lidW * 0.005);
  const baseH = Math.round(screenH * 0.28);
  const baseW = Math.round(lidW * 1.12);
  const baseRadius = Math.round(baseW * 0.01);

  const totalH = lidH + hingeGap + baseH;
  const totalW = baseW;

  const offsetX = Math.round((canvasW - totalW) / 2);
  const offsetY = Math.round((canvasH - totalH) / 2);

  const lidX = offsetX + Math.round((totalW - lidW) / 2);
  const lidY = offsetY;
  const screenX = lidX + bezel;
  const screenY = lidY + bezel;

  const baseX = offsetX;
  const baseY = lidY + lidH + hingeGap;

  return {
    svg: `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="10" stdDeviation="20" flood-color="#000" flood-opacity="0.30"/>
        </filter>
        <linearGradient id="lidGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3a3a3a"/>
          <stop offset="100%" stop-color="#222"/>
        </linearGradient>
        <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#1a1a1a"/>
        </linearGradient>
        <linearGradient id="keyboard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a1a1a"/>
          <stop offset="100%" stop-color="#111"/>
        </linearGradient>
      </defs>
      <!-- lid -->
      <rect x="${lidX}" y="${lidY}" width="${lidW}" height="${lidH}" rx="${lidRadius}"
            fill="url(#lidGrad)"/>
      <!-- screen -->
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${Math.round(lidRadius * 0.5)}" fill="#fff"/>
      <!-- hinge -->
      <rect x="${baseX + Math.round(baseW * 0.35)}" y="${baseY}" width="${Math.round(baseW * 0.3)}" height="${hingeGap + 2}" rx="1" fill="#111"/>
      <!-- base deck -->
      <rect x="${baseX}" y="${baseY + hingeGap}" width="${baseW}" height="${baseH - hingeGap}" rx="${baseRadius}"
            fill="url(#baseGrad)" filter="url(#shadow)"/>
      <!-- keyboard area -->
      <rect x="${baseX + Math.round(baseW * 0.06)}" y="${baseY + hingeGap + Math.round(baseH * 0.08)}"
            width="${Math.round(baseW * 0.88)}" height="${Math.round(baseH * 0.5)}" rx="3" fill="url(#keyboard)"/>
      <!-- trackpad -->
      <rect x="${baseX + Math.round(baseW * 0.38)}" y="${baseY + hingeGap + Math.round(baseH * 0.68)}"
            width="${Math.round(baseW * 0.24)}" height="${Math.round(baseH * 0.14)}" rx="2" fill="#2a2a2a" stroke="#333" stroke-width="0.5"/>
    </svg>`,
    screenX,
    screenY,
    screenW,
    screenH,
  };
}

/* ── Generate a mockup from a flyer image ─────────────── */
async function generateMockup(inputPath, name) {
  const types = [];

  // ── Phone mockup ──────────────────────────────────────
  {
    const canvasW = 1600;
    const canvasH = 3000;
    const screenW = 1200;
    const screenH = Math.round(screenW * (1920 / 1080));

    const frame = phoneFrameSVG(screenW, screenH, canvasW, canvasH);

    const resized = await sharp(inputPath)
      .resize(screenW, screenH, { fit: 'cover', position: 'centre' })
      .toBuffer();

    const composited = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 245, g: 240, b: 232, alpha: 1 } },
    })
      .composite([
        { input: Buffer.from(frame.svg), top: 0, left: 0 },
        { input: resized, top: frame.screenY, left: frame.screenX },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    const outPath = resolve(MOCKUP_DIR, `${name}-phone-mockup.png`);
    await sharp(composited).toFile(outPath);
    types.push(`phone`);
  }

  // ── Laptop mockup ─────────────────────────────────────
  {
    const canvasW = 2400;
    const canvasH = 1800;
    const screenW = 1400;
    const screenH = Math.round(screenW * (9 / 16));

    const frame = laptopFrameSVG(screenW, screenH, canvasW, canvasH);

    const resized = await sharp(inputPath)
      .resize(screenW, screenH, { fit: 'cover', position: 'centre' })
      .toBuffer();

    const composited = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 245, g: 240, b: 232, alpha: 1 } },
    })
      .composite([
        { input: Buffer.from(frame.svg), top: 0, left: 0 },
        { input: resized, top: frame.screenY, left: frame.screenX },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    const outPath = resolve(MOCKUP_DIR, `${name}-laptop-mockup.png`);
    await sharp(composited).toFile(outPath);
    types.push('laptop');
  }

  return types;
}

/* ── Main ─────────────────────────────────────────────── */
async function main() {
  await mkdir(MOCKUP_DIR, { recursive: true });

  const files = (await readdir(FLYER_DIR)).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} flyer PNGs\n`);

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    const name = file.replace('.png', '');
    const inputPath = resolve(FLYER_DIR, file);
    const label = name.replace('-flyer-abuja', '').padEnd(14);

    process.stdout.write(`  ${label} ... `);
    try {
      const types = await generateMockup(inputPath, name);
      console.log(`OK  (${types.join(', ')})`);
      ok++;
    } catch (err) {
      console.log(`FAIL  ${err.message}`);
      fail++;
    }
  }

  console.log(`\nDone.  OK: ${ok}  Failed: ${fail}`);
  console.log(`Output: ${MOCKUP_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });

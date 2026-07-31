import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';

const VAULT = 'C:/Users/1040 G8/Documents/Brain/02 - Projects/African Real Estate Agent Growth Kit/01. Canva Marketing Assets/Property Flyers';
const OUT = 'product-images';

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const C = {
  charcoal: '#2D2D2D',
  cream: '#F5F0E8',
  terracotta: '#C26A4A',
  olive: '#7B8D5D',
  gold: '#C9A84C',
  white: '#FFFFFF',
};

function fmtSVG(w, h, body) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

function bgGradSVG(w, h) {
  return fmtSVG(w, h, `
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a1a1a"/><stop offset="100%" stop-color="${C.charcoal}"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <rect x="0" y="${h - 6}" width="${w}" height="6" fill="${C.gold}"/>`);
}

// ── 1. Gumroad cover (2048×1152) — text left, laptop right, no overlap ──
async function coverGumroad() {
  const W = 2048, H = 1152;
  const pad = 80;

  const laptopW = 860, laptopH = 645;
  const laptopBuf = await sharp(`${VAULT}/mockups/luxury-flyer-abuja-laptop-mockup.png`).resize(laptopW, laptopH).toBuffer();

  const textX = pad;
  const headingSize = 54, subSize = 24, priceSize = 30, badgeSize = 16;

  const textBlockH = 40 + 54 * 2.2 + 24 * 2 + 30 + 40;
  const textTop = Math.round((H - textBlockH) / 2);

  const body = `
    <rect x="${textX - 12}" y="${textTop - 4}" width="178" height="34" rx="6" fill="${C.gold}"/>
    <text x="${textX}" y="${textTop + 20}" font-family="sans-serif" font-size="${badgeSize}" font-weight="700" fill="${C.charcoal}">DIGITAL PRODUCT</text>
    <text x="${textX}" y="${textTop + 90}" font-family="serif" font-size="${headingSize}" font-weight="900" fill="${C.white}">African Real Estate</text>
    <text x="${textX}" y="${textTop + 90 + headingSize * 1.15}" font-family="serif" font-size="${headingSize}" font-weight="900" fill="${C.white}">Agent Growth Kit</text>
    <text x="${textX}" y="${textTop + 90 + headingSize * 2.5}" font-family="sans-serif" font-size="${subSize}" font-weight="400" fill="rgba(255,255,255,0.7)">300+ Canva Templates · Ad Scripts · 30-Day Content Calendar</text>
    <text x="${textX}" y="${textTop + 90 + headingSize * 2.5 + subSize * 2.2}" font-family="sans-serif" font-size="${priceSize}" font-weight="700" fill="${C.gold}">Basic $19  |  Standard $29  |  Premium $39</text>`;

  await sharp(bgGradSVG(W, H))
    .composite([
      { input: laptopBuf, top: Math.round((H - laptopH) / 2), left: W - laptopW - pad },
      { input: fmtSVG(W, H, body), top: 0, left: 0 },
    ])
    .png().toFile(`${OUT}/cover-gumroad.png`);
  console.log('  cover-gumroad.png');
}

// ── 2. Square cover (1080×1080) — text top, mockups bottom, no overlap ──
async function coverSquare() {
  const W = 1080, H = 1080;
  const pad = 40;

  const textBlockH = 30 + 44 * 2.4 + 20 * 2 + 28 + 40;
  const textTop = pad;

  const mockupAreaTop = Math.round(textTop + textBlockH + 20);
  const mockupAreaH = Math.round(H - mockupAreaTop - pad);

  const phoneW = 280, phoneH = 525;
  const laptopW = 380, laptopH = 285;

  const [phoneBuf, laptopBuf] = await Promise.all([
    sharp(`${VAULT}/mockups/luxury-flyer-abuja-phone-mockup.png`).resize(phoneW, phoneH).toBuffer(),
    sharp(`${VAULT}/mockups/luxury-flyer-abuja-laptop-mockup.png`).resize(laptopW, laptopH).toBuffer(),
  ]);

  const totalMockupW = phoneW + 30 + laptopW;
  const mockupsLeft = Math.round((W - totalMockupW) / 2);
  const phoneTop = mockupAreaTop + Math.round((mockupAreaH - phoneH) / 2);
  const laptopTop = mockupAreaTop + Math.round((mockupAreaH - laptopH) / 2);

  const cx = W / 2;
  const body = `
    <rect x="${cx - 115}" y="${textTop}" width="230" height="28" rx="6" fill="${C.gold}"/>
    <text x="${cx}" y="${textTop + 19}" font-family="sans-serif" font-size="13" font-weight="700" fill="${C.charcoal}" text-anchor="middle">AFRICAN REAL ESTATE KIT</text>
    <text x="${cx}" y="${textTop + 85}" font-family="serif" font-size="42" font-weight="900" fill="${C.white}" text-anchor="middle">Stop Losing Property</text>
    <text x="${cx}" y="${textTop + 85 + 48}" font-family="serif" font-size="42" font-weight="900" fill="${C.white}" text-anchor="middle">Buyers on Social Media</text>
    <text x="${cx}" y="${textTop + 85 + 120}" font-family="sans-serif" font-size="18" font-weight="400" fill="rgba(255,255,255,0.7)" text-anchor="middle">300+ Templates · Ads · Content Calendar · Lead Magnets</text>
    <text x="${cx}" y="${textTop + 85 + 158}" font-family="sans-serif" font-size="26" font-weight="700" fill="${C.gold}" text-anchor="middle">$19  |  $29  |  $39</text>`;

  await sharp(bgGradSVG(W, H))
    .composite([
      { input: phoneBuf, top: phoneTop, left: mockupsLeft },
      { input: laptopBuf, top: laptopTop, left: mockupsLeft + phoneW + 30 },
      { input: fmtSVG(W, H, body), top: 0, left: 0 },
    ])
    .png().toFile(`${OUT}/cover-square.png`);
  console.log('  cover-square.png');
}

// ── 3. Flyer grid (1080×1080) ──
async function flyerGrid() {
  const W = 1080, H = 1080;
  const pad = 16, titleH = 60;
  const cols = 4, rows = 2;
  const gap = 12;

  const cellW = Math.floor((W - pad * 2 - gap * (cols - 1)) / cols);
  const cellH = Math.floor((H - pad - titleH - gap * (rows - 1)) / rows);

  const flyers = ['luxury', 'apartment', 'land', 'commercial', 'rental', 'just-listed', 'sold', 'open-house'];

  const composites = [];
  for (let i = 0; i < flyers.length; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (cellW + gap);
    const y = pad + titleH + row * (cellH + gap);
    const buf = await sharp(`${VAULT}/rendered-pngs/${flyers[i]}-flyer-abuja.png`)
      .resize(cellW, cellH, { fit: 'inside' }).toBuffer();
    composites.push({ input: buf, top: y, left: x + Math.round((cellW - cellW) / 2) });
  }

  const bg = fmtSVG(W, H, `
    <rect width="${W}" height="${H}" fill="${C.cream}"/>
    <text x="${W / 2}" y="${pad + 22}" font-family="serif" font-size="22" font-weight="700" fill="${C.charcoal}" text-anchor="middle">All 8 Property Flyer Designs</text>
    <rect x="${W / 2 - 60}" y="${pad + 35}" width="120" height="3" rx="1.5" fill="${C.terracotta}"/>`);

  await sharp(bg).composite(composites).png().toFile(`${OUT}/preview-flyer-grid.png`);
  console.log('  preview-flyer-grid.png');
}

// ── 4. Mockup showcase (1080×1080) ──
async function mockupShowcase() {
  const W = 1080, H = 1080;
  const pad = 20;

  const mockups = [
    'luxury-flyer-abuja-phone-mockup.png',
    'just-listed-flyer-abuja-phone-mockup.png',
    'sold-flyer-abuja-phone-mockup.png',
  ];
  const count = mockups.length;
  const gap = 24;
  const mockW = Math.floor((W - pad * 2 - gap * (count - 1)) / count);
  const mockH = Math.round(mockW * 1.875);

  const composites = [];
  for (let i = 0; i < count; i++) {
    const x = pad + i * (mockW + gap);
    const buf = await sharp(`${VAULT}/mockups/${mockups[i]}`).resize(mockW, mockH).toBuffer();
    composites.push({ input: buf, top: pad, left: x });
  }

  const textY = pad + mockH + 30;
  const body = `
    <rect width="${W}" height="${H}" fill="#1a1a1a"/>
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${C.gold}"/>
    <text x="${W / 2}" y="${textY}" font-family="sans-serif" font-size="18" font-weight="400" fill="rgba(255,255,255,0.6)" text-anchor="middle">Instagram Posts · Stories · Reels · Carousels</text>
    <text x="${W / 2}" y="${textY + 34}" font-family="serif" font-size="28" font-weight="700" fill="${C.gold}" text-anchor="middle">120+ Social Media Templates</text>`;

  await sharp(fmtSVG(W, H, body)).composite(composites).png().toFile(`${OUT}/preview-mockups.png`);
  console.log('  preview-mockups.png');
}

// ── 5. Modules showcase (1080×1080) ──
async function modulesShowcase() {
  const W = 1080, H = 1080;
  const pad = 20, titleH = 60;
  const cols = 3, rows = 4;
  const gap = 14;

  const cardW = Math.floor((W - pad * 2 - gap * (cols - 1)) / cols);
  const cardH = Math.floor((H - pad - titleH - gap * (rows - 1)) / rows);

  const modules = [
    { name: 'Brand Kit', icon: '01' },
    { name: 'Listing Flyers', icon: '02' },
    { name: 'Social Templates', icon: '03' },
    { name: 'FB &amp; IG Ads', icon: '04' },
    { name: 'TikTok Ads', icon: '05' },
    { name: 'WhatsApp Suite', icon: '06' },
    { name: '30-Day Calendar', icon: '07' },
    { name: 'Email Marketing', icon: '08' },
    { name: 'Lead Magnets', icon: '09' },
    { name: 'Training Videos', icon: '10' },
    { name: 'Ad Scripts', icon: '11' },
    { name: 'Launch Checklist', icon: '12' },
  ];

  const moduleColors = [C.terracotta, C.gold, C.olive, C.terracotta, C.gold, C.olive, C.terracotta, C.gold, C.olive, C.terracotta, C.gold, C.olive];
  let cards = '';
  modules.forEach((m, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (cardW + gap);
    const y = pad + titleH + row * (cardH + gap);
    const cx = x + cardW / 2, cy = y + cardH * 0.38;
    cards += `
      <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="10" fill="${C.white}" stroke="#E5E0D8" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="18" fill="${moduleColors[i]}"/>
      <text x="${cx}" y="${cy + 6}" font-family="sans-serif" font-size="16" font-weight="700" fill="${C.white}" text-anchor="middle">${m.icon}</text>
      <text x="${cx}" y="${y + cardH * 0.72}" font-family="sans-serif" font-size="13" font-weight="600" fill="${C.charcoal}" text-anchor="middle">${m.name}</text>`;
  });

  const body = `
    <rect width="${W}" height="${H}" fill="${C.cream}"/>
    <text x="${W / 2}" y="${pad + 24}" font-family="serif" font-size="24" font-weight="700" fill="${C.charcoal}" text-anchor="middle">10 Complete Modules Included</text>
    <rect x="${W / 2 - 50}" y="${pad + 38}" width="100" height="3" rx="1.5" fill="${C.terracotta}"/>
    ${cards}`;

  await sharp(fmtSVG(W, H, body)).png().toFile(`${OUT}/preview-modules.png`);
  console.log('  preview-modules.png');
}

async function main() {
  console.log('Generating product images...');
  await coverGumroad();
  await coverSquare();
  await flyerGrid();
  await mockupShowcase();
  await modulesShowcase();
  console.log('Done. Files in', OUT);
}

main().catch(console.error);

#!/usr/bin/env node
import { writeFile, mkdir, stat } from 'fs/promises';
import { basename, extname, join, resolve } from 'path';
import { Command } from 'commander';
import sharp from 'sharp';
import { glob } from 'glob';

/* ── Ratios ─────────────────────────────────────────────────── */
const RATIOS = [
  { key: '9x16',  label: '9:16',  width: 1080, height: 1920, crop: 'cover' },
  { key: '1x1',   label: '1:1',   width: 2160, height: 2160, crop: 'cover' },
  { key: '4x5',   label: '4:5',   width: 1080, height: 1350, crop: 'cover' },
  { key: '16x9',  label: '16:9',  width: 1920, height: 1080, crop: 'cover' },
];

const INPUT_EXT = ['.png', '.jpg', '.jpeg', '.tiff', '.psd'];

/* ── Utilities ──────────────────────────────────────────────── */
function elapsed(start) {
  const s = ((Date.now() - start) / 1000).toFixed(1);
  return `${s}s`;
}

/* ── Safe‑zone overlay buffer (9:16 only) ─────────────────── */
function safeZoneOverlay(width, height) {
  const topH = Math.round(height * 0.14);
  const botH = Math.round(height * 0.20);
  const rgba = Buffer.alloc(width * 4);
  for (let i = 0; i < width; i++) {
    rgba[i * 4]     = 255;       // R
    rgba[i * 4 + 1] = 255;       // G
    rgba[i * 4 + 2] = 0;         // B
    rgba[i * 4 + 3] = 38;        // A  (15% opacity)
  }
  const overlay = { input: { raw: { width, height: 1, channels: 4 }, rgba }, top: 0, left: 0 };
  // top band
  const topBand = sharp(rgba, { raw: { width, height: 1, channels: 4 } })
    .resize(width, topH)
    .png();
  // bottom band
  const botY = height - botH;
  const botBand = sharp(rgba, { raw: { width, height: 1, channels: 4 } })
    .resize(width, botH)
    .png();
  return { topBand, botY, botBand };
}

/* ── Process a single master file ──────────────────────────── */
async function processFile(filePath, outputDir, quality, safeZones) {
  const base = basename(filePath, extname(filePath));
  const results = [];

  let img;
  try {
    img = sharp(filePath);
    const meta = await img.metadata();
    if (!meta) throw new Error('Could not read metadata');
  } catch (err) {
    return { base, error: `Not a valid image — ${err.message}` };
  }

  for (const ratio of RATIOS) {
    const outDir = join(outputDir, ratio.key);
    const outName = `${base}_${ratio.width}x${ratio.height}.png`;
    const outPath = join(outDir, outName);

    try {
      await mkdir(outDir, { recursive: true });

      // sharp strips metadata by default; explicitly convert to sRGB
      let pipeline = sharp(filePath).toColorspace('srgb');

      if (ratio.crop === 'cover') {
        pipeline = pipeline.resize({
          width: ratio.width,
          height: ratio.height,
          fit: 'cover',
          position: 'centre',
          withoutEnlargement: false,
        });
      }

      // safe‑zone overlay for 9:16
      if (safeZones && ratio.key === '9x16') {
        const { topBand, botY, botBand } = safeZoneOverlay(ratio.width, ratio.height);

        const topBuf = await topBand.toBuffer();
        const botBuf = await botBand.toBuffer();

        pipeline = pipeline.png({ quality, compressionLevel: 9, palette: true });
        const baseBuf = await pipeline.toBuffer();

        const composited = await sharp(baseBuf)
          .composite([
            { input: topBuf, top: 0, left: 0 },
            { input: botBuf, top: botY, left: 0 },
          ])
          .png({ quality, compressionLevel: 9, palette: true })
          .toBuffer();

        await writeFile(outPath, composited);
      } else {
        await pipeline
          .png({ quality, compressionLevel: 9, palette: true })
          .toFile(outPath);
      }

      const outStat = await stat(outPath);
      const sizeMB = (outStat.size / (1024 * 1024)).toFixed(1);
      results.push({ ratio: ratio.key, dims: `${ratio.width}x${ratio.height}`, size: `${sizeMB}MB`, outPath, ok: true });
    } catch (err) {
      results.push({ ratio: ratio.key, dims: `${ratio.width}x${ratio.height}`, error: err.message, ok: false });
    }
  }
  return { base, results };
}

/* ── CLI ────────────────────────────────────────────────────── */
const program = new Command();

program
  .name('batch-social-processor')
  .description('Batch convert master images into platform-ready social ad PNGs')
  .requiredOption('-i, --input <path>', 'Source folder containing master assets', './masters')
  .option('-o, --output <path>', 'Output destination directory', './build/social-ads')
  .option('-q, --quality <number>', 'PNG quality (1-100)', (v) => parseInt(v, 10), 85)
  .option('--safe-zones', 'Overlay 14%/20% safe-zone guides on 9:16 outputs')
  .parse(process.argv);

const opts = program.opts();

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  const start = Date.now();
  const inputDir = resolve(opts.input);
  const outputDir = resolve(opts.output);
  const quality = Math.max(1, Math.min(100, opts.quality));

  console.log(`\n  Batch Social Ad Processor\n`);
  console.log(`  Input     : ${inputDir}`);
  console.log(`  Output    : ${outputDir}`);
  console.log(`  Quality   : ${quality}`);
  console.log(`  Safe zones: ${opts.safeZones ? 'ON' : 'OFF'}`);
  console.log(`  Ratios    : ${RATIOS.map(r => r.label).join(', ')}`);
  console.log('');

  // discover masters (use forward-slash pattern for cross-platform glob)
  let files = [];
  for (const ext of INPUT_EXT) {
    const pattern = `${inputDir.replace(/\\/g, '/')}/**/*${ext}`;
    const found = await glob(pattern, { nocase: true });
    for (const f of found) {
      files.push(resolve(f));
    }
  }
  files = [...new Set(files)];

  if (files.length === 0) {
    console.log('  No master images found. Exiting.\n');
    process.exit(0);
  }

  console.log(`  Found ${files.length} master file(s)\n`);

  let totalOk = 0;
  let totalFail = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pct = `[${i + 1}/${files.length}]`.padStart(8);
    process.stdout.write(`  ${pct} ${basename(file)} ... `);

    const { base, results, error } = await processFile(file, outputDir, quality, opts.safeZones);

    if (error) {
      console.log(`FAILED  (${error})`);
      totalFail++;
      continue;
    }

    console.log('OK');
    for (const r of results) {
      if (r.ok) {
        console.log(`           -> ${r.ratio} (${r.dims}) [${r.size}]`);
        totalOk++;
      } else {
        console.log(`           -> ${r.ratio} FAILED (${r.error})`);
        totalFail++;
      }
    }
  }

  const duration = elapsed(start);
  console.log(`\n  ─────────────────────────────────────`);
  console.log(`  Total : ${totalOk + totalFail}  |  OK: ${totalOk}  |  Failed: ${totalFail}  |  Time: ${duration}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const VIEWPORT = { width: 1425, height: 800 };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};

async function serveStatic(projectDir) {
  const root = join(ROOT, projectDir);
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filePath = join(root, urlPath === '/' ? 'index.html' : urlPath);
    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

async function startNext() {
  const port = 3100;
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: join(ROOT, 'mc-danfo'),
    shell: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const url = `http://127.0.0.1:${port}/`;
  const maxWait = 60000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, close: () => child.kill() };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error('mc-danfo next start timed out');
}

const TARGETS = [
  { name: 'blaise-crest-enterprises', project: 'blaise-crest-enterprises', outFile: 'blaise-crest-enterprises-thumbnail.png', static: true },
  { name: 'kaya-renovations', project: 'kaya-renovations', outFile: 'kaya-renovations-thumbnail.png', static: true },
  { name: 'mc-danfo', project: 'mc-danfo', outFile: 'mc-danfo-thumbnail.png', static: false },
];

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'en-GB',
    colorScheme: 'light',
  });
  const page = await context.newPage();

  for (const target of TARGETS) {
    let server = null;
    let url;
    try {
      if (target.static) {
        server = await serveStatic(target.project);
        url = server.url;
      } else {
        server = await startNext();
        url = server.url;
      }
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1200);
      const outPath = join(ROOT, target.project, target.outFile);
      await page.screenshot({ path: outPath });
      console.log(`OK   ${target.name.padEnd(26)} ${outPath}`);
    } catch (err) {
      console.log(`FAIL ${target.name.padEnd(26)} ${err.message}`);
    } finally {
      if (server && server.close) {
        try { server.close(); } catch {}
      }
    }
  }

  await browser.close();
}

main();

#!/usr/bin/env node
/**
 * Bundle size gate. Run AFTER `pnpm build`.
 *
 * Fails when the total gzipped JavaScript of the web app exceeds the limit.
 * Default limit: 450 KB (override with BUNDLE_LIMIT_KB). Baseline measured at
 * 426.5 KB after the React 19 + auth alignment; raise only when intentional.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(repoRoot, "apps/web/.next/static");
const limitKb = Number(process.env.BUNDLE_LIMIT_KB ?? 450);
const limitBytes = limitKb * 1024;

if (!existsSync(staticDir)) {
  console.error("apps/web/.next/static not found — run `pnpm build` before bundle:check");
  process.exit(1);
}

const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}
walk(staticDir);

let total = 0;
const sizes = files
  .map((f) => {
    const gz = gzipSync(readFileSync(f)).length;
    total += gz;
    return { file: path.relative(repoRoot, f), gz };
  })
  .sort((a, b) => b.gz - a.gz);

console.log(`Total gzipped JS: ${(total / 1024).toFixed(1)} KB (limit ${limitKb} KB)`);
for (const { file, gz } of sizes.slice(0, 5)) {
  console.log(`  ${(gz / 1024).toFixed(1)} KB  ${file}`);
}

if (total > limitBytes) {
  console.error(`Bundle size gate FAILED: ${(total / 1024).toFixed(1)} KB exceeds ${limitKb} KB`);
  process.exit(1);
}
console.log("Bundle size gate passed");

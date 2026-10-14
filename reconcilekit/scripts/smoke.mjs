#!/usr/bin/env node
// Consumer install smoke test for the reconcilekit package.
//
// Packs the current tree, installs the tarball into a fresh consumer
// project under the OS temp directory, and verifies the CLI runs end to end.
//
// Ported from PowerShell: PS 5.1 on Windows converts spaced paths to their
// 8.3 short form during internal path validation, and short-form names are
// disabled on modern Windows. Any PS cmdlet that accepts a path (Set-Location,
// Push-Location, Remove-Item) fails on paths under a user profile containing
// a space. Node has none of that and this script runs identically on
// Windows, macOS, and Linux.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(here, "..");
const isWindows = process.platform === "win32";

function quoteArg(value) {
  const s = String(value);
  if (isWindows) {
    return /[\s"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  return /[\s"'$`\\]/.test(s) ? `'${s.replace(/'/g, "'\\''")}'` : s;
}

function run(cmd, args, options = {}) {
  const line = [cmd, ...args].map(quoteArg).join(" ");
  const result = spawnSync(line, { shell: true, encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = new Error(`Command failed (exit ${result.status}): ${line}`);
    err.status = result.status;
    err.stdout = result.stdout;
    err.stderr = result.stderr;
    throw err;
  }
  return result.stdout ?? "";
}

function log(message) {
  process.stdout.write(message + "\n");
}

function fail(message) {
  process.stderr.write(`\n==> SMOKE TEST FAILED\n${message}\n`);
  process.exit(1);
}

const smokeDir = join(tmpdir(), "reconcilekit-smoke");

log("==> Cleaning smoke directory");
rmSync(smokeDir, { recursive: true, force: true });
mkdirSync(smokeDir, { recursive: true });

log("==> Packing the current tree");
try {
  run("npm", ["pack", "--pack-destination", smokeDir], { cwd: repoDir });
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  fail(`npm pack failed: ${error.message}`);
}

const tarballs = readdirSync(smokeDir).filter(
  (f) => f.startsWith("reconcilekit-") && f.endsWith(".tgz"),
);
if (tarballs.length === 0) fail("npm pack produced no tarball");
const tarball = join(smokeDir, tarballs[0]);
log(`    ${tarball}`);

const consumer = join(smokeDir, "consumer");
mkdirSync(consumer, { recursive: true });

log("==> Creating fresh consumer project");
writeFileSync(
  join(consumer, "package.json"),
  JSON.stringify({ name: "consumer", version: "1.0.0", private: true }) + "\n",
);

log("==> Installing the tarball");
try {
  run("npm", ["install", tarball], {
    cwd: consumer,
    stdio: ["ignore", "inherit", "inherit"],
  });
} catch (error) {
  fail(`npm install failed: ${error.message}`);
}

if (!existsSync(join(consumer, "node_modules", "reconcilekit"))) {
  fail("package not present in node_modules");
}
const binDir = join(consumer, "node_modules", ".bin");
const binShims = existsSync(binDir) ? readdirSync(binDir) : [];
const hasBin = binShims.some(
  (f) => f === "reconcilekit" || f === "reconcilekit.cmd",
);
if (!hasBin) {
  fail(
    `bin shim not created. Contents of ${binDir}: ${binShims.join(", ") || "(empty)"}`,
  );
}
log("    package installed, bin shim present");

const merchantCsv =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id\n" +
  "TEST-001,1000,NGN,SUCCESS,1700000000000,rec_001\n";
writeFileSync(join(consumer, "merchant.csv"), merchantCsv);

const providerJson =
  JSON.stringify(
    {
      status: true,
      message: "Verification successful",
      data: {
        id: 123456789,
        reference: "TEST-001",
        amount: 1000,
        currency: "NGN",
        status: "success",
        created_at: "2023-11-14T22:13:20.000Z",
        paid_at: "2023-11-14T22:13:20.000Z",
        transaction_date: "2023-11-14T22:13:20.000Z",
      },
    },
    null,
    2,
  ) + "\n";
writeFileSync(join(consumer, "provider.json"), providerJson);

log("==> npx reconcilekit --help");
let helpOut;
try {
  helpOut = run("npx", ["reconcilekit", "--help"], { cwd: consumer });
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  fail(`--help failed: ${error.message}`);
}
process.stdout.write(helpOut);
if (!/ReconcileKit/.test(helpOut))
  fail("--help output does not mention ReconcileKit");

log("==> npx reconcilekit (real reconciliation)");
let runOut;
try {
  runOut = run(
    "npx",
    [
      "reconcilekit",
      "--merchant",
      join(consumer, "merchant.csv"),
      "--provider",
      join(consumer, "provider.json"),
      "--timestamp-field",
      "paid_at",
      "--currencies",
      "NGN",
    ],
    { cwd: consumer },
  );
} catch (error) {
  if (error.stdout) process.stdout.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  fail(`reconciliation failed: ${error.message}`);
}
process.stdout.write(runOut);

if (!/MATCH/.test(runOut)) fail("expected MATCH in output");
if (!/Matched\s+1/.test(runOut)) fail("expected 'Matched 1' in summary");

log("");
log("==> SMOKE TEST PASSED");
log("");
log(`Artifacts: ${smokeDir}`);
log(`Tarball:   ${tarballs[0]}`);
log("");
log("Clean up with:");
log(
  `  node -e "require('node:fs').rmSync(${JSON.stringify(smokeDir)}, {recursive:true,force:true})"`,
);

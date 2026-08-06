// Dev runner: tsc --watch for decorator metadata + node --watch for reload.
// (tsx/esbuild drops design:paramtypes, silently breaking Nest DI — the API
// must run from tsc-compiled output.)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distMain = resolve(apiDir, "dist/main.js");
const tscBin = resolve(apiDir, "node_modules/typescript/bin/tsc");

const tsc = spawn(process.execPath, [tscBin, "-p", "tsconfig.json", "--watch"], {
  cwd: apiDir,
  stdio: "inherit",
});

function startNode() {
  return spawn(process.execPath, ["--watch", distMain], { cwd: apiDir, stdio: "inherit" });
}

let node = null;
async function waitForBuild() {
  const deadline = Date.now() + 45_000;
  while (!existsSync(distMain)) {
    if (Date.now() > deadline) {
      console.error("[dev] dist/main.js not built in time — is tsc failing?");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  node = startNode();
}

waitForBuild();

for (const proc of [tsc]) {
  proc.on("exit", (code) => {
    if (node) node.kill();
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  if (node) node.kill();
  tsc.kill();
  process.exit(0);
});

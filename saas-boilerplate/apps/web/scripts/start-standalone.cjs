"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const webRoot = path.join(__dirname, "..");

const candidates = [
  path.join(webRoot, ".next", "standalone", "apps", "web", "server.js"),
  path.join(webRoot, ".next", "standalone", "saas-boilerplate", "apps", "web", "server.js"),
];

const serverEntry = candidates.find((entry) => fs.existsSync(entry));

if (!serverEntry) {
  console.error(
    "[start] standalone build not found. Run `pnpm build` (or `pnpm --filter @saas/web build`) first."
  );
  process.exit(1);
}

const staticSource = path.join(webRoot, ".next", "static");
const staticTarget = path.join(path.dirname(serverEntry), ".next", "static");

if (fs.existsSync(staticSource) && !fs.existsSync(staticTarget)) {
  fs.cpSync(staticSource, staticTarget, { recursive: true });
}

const envFile = path.join(webRoot, ".env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envFile);
  } catch (error) {
    console.warn(`[start] failed to load ${envFile}: ${error.message}`);
  }
}

const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "-p" || arg === "--port") {
    process.env.PORT = args[index + 1];
  }
}

const server = spawn(process.execPath, [serverEntry], { stdio: "inherit" });

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

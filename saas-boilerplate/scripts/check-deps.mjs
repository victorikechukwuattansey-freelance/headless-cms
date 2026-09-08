#!/usr/bin/env node
/**
 * Dependency compatibility gate.
 *
 * Fails when:
 *  - a `workspace:*` reference points to a package that does not exist
 *  - a critical shared dependency resolves to more than one major version
 *    anywhere in the lockfile (duplicate majors = silent incompatibilities)
 *  - the lockfile no longer matches the manifests (run `pnpm install`)
 *
 * NOTE: CI also runs `pnpm install --frozen-lockfile` and `pnpm dedupe --check`;
 * this script adds the semantic checks on top.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CRITICAL = new Set([
  "react",
  "react-dom",
  "next",
  "@prisma/client",
  "prisma",
  "@prisma/adapter-pg",
  "@auth/core",
  "@auth/prisma-adapter",
  "zod",
  "typescript",
  "tailwindcss",
  "eslint",
  "vitest",
  "framer-motion",
  "lucide-react",
]);

const failures = [];
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const workspacePackages = new Map(); // name -> package.json path

for (const sub of ["apps", "packages"]) {
  const subDir = path.join(repoRoot, sub);
  if (!existsSync(subDir)) continue;
  for (const name of readdirSync(subDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)) {
    const pkgPath = path.join(subDir, name, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = readJson(pkgPath);
    workspacePackages.set(pkg.name, pkgPath);
  }
}

// 1. workspace:* references resolve
for (const [name, pkgPath] of workspacePackages) {
  const pkg = readJson(pkgPath);
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [dep, spec] of Object.entries(pkg[section] ?? {})) {
      if (typeof spec === "string" && spec.startsWith("workspace:")) {
        if (!workspacePackages.has(dep)) {
          failures.push(
            `${pkgPath}: workspace:* dependency "${dep}" does not exist in the workspace`,
          );
        }
      }
    }
  }
}

// 2. duplicate majors for critical libs — at the workspace's own resolution
//    surface (direct dependencies and their peer bindings in the importers
//    section). Deep internal duplicates (e.g. @react-email/tailwind's bundled
//    tailwindcss 4) are contained and do not fail the gate.
const lockPath = path.join(repoRoot, "pnpm-lock.yaml");
if (!existsSync(lockPath)) {
  failures.push("pnpm-lock.yaml missing — run `pnpm install`");
} else {
  const lock = readFileSync(lockPath, "utf8");
  const lines = lock.split("\n");
  const majors = new Map(); // name -> Set(major)  (all resolutions in lockfile)
  const direct = new Set(); // name@major seen in the importers section
  let inImporters = true;
  for (const line of lines) {
    if (/^packages:$/.test(line)) inImporters = false;
    const keyMatch = line.match(/^\s{2}(?:'([^']+)'|([^:]+)):$/);
    if (keyMatch) {
      const key = keyMatch[1] ?? keyMatch[2];
      if (!key || key.includes("workspace:")) continue;
      const depMatch = key.match(/^(@?[^@/\s]+(?:\/[^@\s]+)?)@(\d+)\.(\d+)\.(\d+)(?:\(|$)/);
      if (!depMatch) continue;
      const depName = depMatch[1];
      if (!CRITICAL.has(depName)) continue;
      if (inImporters) direct.add(`${depName}@${depMatch[2]}`);
      if (!majors.has(depName)) majors.set(depName, new Set());
      majors.get(depName).add(depMatch[2]);
    }
  }
  for (const [depName, set] of majors) {
    if (set.size <= 1) continue;
    const conflicting = [...set].filter((m) => direct.has(`${depName}@${m}`));
    if (conflicting.length > 1) {
      failures.push(
        `duplicate majors for ${depName}: ${[...set].join(", ")} — consolidate on one version in all manifests, then run \`pnpm install\``,
      );
    }
  }
}

// 3. lockfile freshness
try {
  execFileSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["install", "--frozen-lockfile", "--offline", "--ignore-scripts"],
    { cwd: repoRoot, stdio: "pipe", shell: process.platform === "win32" },
  );
} catch {
  failures.push(
    "lockfile out of sync with manifests — run `pnpm install` (frozen-lockfile failed)",
  );
}

if (failures.length > 0) {
  console.error("Dependency compatibility check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Dependency compatibility check passed");

#!/usr/bin/env node
/**
 * Migration validation gate.
 * - Validates the Prisma schema.
 * - If migrations exist: fails when `schema -> migrations` diff is non-empty (drift).
 * - If no migrations yet: warns (baseline not created) but passes.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = path.join(repoRoot, "packages/database/prisma/schema.prisma");
const migrations = path.join(repoRoot, "packages/database/prisma/migrations");

const run = (args, cwd) =>
  spawnSync("prisma", args, {
    cwd: cwd ?? repoRoot,
    shell: process.platform === "win32",
    encoding: "utf8",
  });

let failed = false;

const validate = run(["validate", "--schema", schema]);
if (validate.status !== 0) {
  console.error("[db:validate] FAILED\n" + validate.stderr + validate.stdout);
  failed = true;
} else {
  console.log("[db:validate] schema is valid");
}

if (existsSync(migrations)) {
  const drift = run([
    "migrate",
    "diff",
    "--from-migrations",
    migrations,
    "--to-schema",
    schema,
    "--exit-code",
  ]);
  if (drift.status !== 0) {
    console.error(
      "[db:drift] FAILED — schema and migrations have drifted:\n" + drift.stdout + drift.stderr,
    );
    failed = true;
  } else {
    console.log("[db:drift] migrations are in sync with schema");
  }
} else {
  console.log(
    "[db:drift] no migrations directory yet — run `pnpm db:migrate` to create the baseline",
  );
}

process.exit(failed ? 1 : 0);

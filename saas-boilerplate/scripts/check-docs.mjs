#!/usr/bin/env node
/**
 * Documentation gate. Run on PRs (BASE_SHA = PR base).
 *
 * Fails when the PR changes source code (apps/, packages/, prisma/) but does
 * NOT touch docs/ or ADR/, unless a commit message contains "[skip-docs]".
 *
 * Usage: BASE_SHA=<base-ref-or-sha> pnpm docs:check
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", shell: process.platform === "win32" });
}

const base = process.env.BASE_SHA || "origin/main";
const head = "HEAD";

const SOURCE = /^(apps|packages|prisma)\//;
const SOURCE_IGNORE = /\.(test|spec)\.[jt]sx?$|^apps\/web\/(playwright\.config|next\.config|vitest\.config|postcss\.config|tailwind\.config)/;
const DOCS = /^(docs|ADR)\//;

const changed = git(["diff", "--name-only", `${base}...${head}`]).split("\n").map((s) => s.trim()).filter(Boolean);
if (changed.length === 0) {
  console.log("docs:check passed — no changes detected");
  process.exit(0);
}

const sourceChanges = changed.filter((f) => SOURCE.test(f) && !SOURCE_IGNORE.test(f));
const docChanges = changed.filter((f) => DOCS.test(f) || f.endsWith(".md"));

if (sourceChanges.length === 0) {
  console.log("docs:check passed — no source changes");
  process.exit(0);
}

const commits = git(["log", "--format=%s", `${base}..${head}`]).split("\n");
if (commits.some((c) => c.includes("[skip-docs]"))) {
  console.log("docs:check passed — [skip-docs] marker found");
  process.exit(0);
}

if (docChanges.length > 0) {
  console.log("docs:check passed — documentation updated");
  process.exit(0);
}

console.error("docs:check FAILED — source changes without documentation updates.");
console.error(`Source changes: ${sourceChanges.length} file(s), docs changes: 0.`);
console.error("Update docs/ (or an ADR) to describe the architectural impact, or add [skip-docs] to a commit message.");
process.exit(1);

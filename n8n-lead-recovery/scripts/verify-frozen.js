'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(REPO_ROOT, 'frozen-artifacts.manifest.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (err) {
  console.error(`verify:frozen — FAIL: cannot read manifest ${MANIFEST}: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
  console.error('verify:frozen — FAIL: manifest has no artifacts array');
  process.exit(1);
}

const failures = [];
for (const artifact of manifest.artifacts) {
  const abs = path.join(REPO_ROOT, artifact.path);
  let actual;
  try {
    actual = sha256(abs);
  } catch (err) {
    failures.push({ path: artifact.path, issue: `unreadable: ${err.message}` });
    continue;
  }
  if (actual !== String(artifact.sha256).toLowerCase()) {
    failures.push({ path: artifact.path, expected: String(artifact.sha256).toLowerCase(), actual });
  }
}

if (failures.length > 0) {
  console.error(`verify:frozen — FAIL: ${failures.length} frozen artifact(s) modified:`);
  for (const f of failures) {
    console.error(`  ${f.path}`);
    if (f.expected) {
      console.error(`    expected sha256 ${f.expected}`);
      console.error(`    actual   sha256 ${f.actual}`);
    } else {
      console.error(`    ${f.issue}`);
    }
  }
  process.exit(1);
}

console.log(`verify:frozen — PASS: ${manifest.artifacts.length} frozen artifact(s) verified (SHA-256 match).`);
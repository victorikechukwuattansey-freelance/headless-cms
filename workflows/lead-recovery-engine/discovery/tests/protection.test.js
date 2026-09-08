'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROTECTED = [
  '01 - Lead Intake.json',
  '02 - Booking Status.json',
  '03 - Manual Callback Log.json',
  '04 - Status Update.json',
  '05 - Follow-up Sweeper.json',
  '06 - Error Handler.json',
  '07 - Customer Response.json',
];

const PROD_DIR = path.join(__dirname, '..', '..', '..', 'production');

function sha1(p) {
  return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

test('all seven production workflow files exist', () => {
  for (const f of PROTECTED) {
    const p = path.join(PROD_DIR, f);
    assert.ok(fs.existsSync(p), `missing production file: ${f}`);
  }
});

test('production workflow files are valid JSON and have expected names', () => {
  for (const f of PROTECTED) {
    const p = path.join(PROD_DIR, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(j.nodes && Array.isArray(j.nodes));
    assert.ok(j.name);
  }
});

test('discovery layer exposes no write path to production workflows or lead schema', () => {
  const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  const pipelineSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'pipeline.js'), 'utf8');
  // The prospect store must not reference the production/ directory or lead tab names.
  assert.ok(!storeSrc.includes('production'));
  assert.ok(!pipelineSrc.includes('production'));
  assert.ok(!storeSrc.includes('business_config'));
  assert.ok(!storeSrc.includes('status_updates'));
});

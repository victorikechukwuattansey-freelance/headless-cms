'use strict';

/*
 * Authors fixtures/overture-places-synthetic.parquet from
 * fixtures/overture-places-synthetic.source.json (Prompt H.1).
 *
 * The generated parquet mirrors the EXACT projected output of
 * scripts/overture-load-places.js (same 15 columns, same types) so offline
 * tests can exercise the full pipeline shape without network access. The real
 * downloader writes to a git-ignored path; this committed synthetic file stays
 * byte-stable across runs (re-running this script is idempotent — same source,
 * same parquet).
 *
 * Usage:  node scripts/make-overture-synthetic.js
 * Requires: @duckdb/node-api (npm install @duckdb/node-api)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

let duckdb;
try {
  duckdb = require('@duckdb/node-api');
} catch (err) {
  console.error('make-overture-synthetic: @duckdb/node-api is not installed. Run `npm install @duckdb/node-api` first.');
  process.exit(1);
}

const SOURCE = path.join(__dirname, '..', 'fixtures', 'overture-places-synthetic.source.json');
const OUTPUT = path.join(__dirname, '..', 'fixtures', 'overture-places-synthetic.parquet');

const PROJECTION_COLUMNS = [
  'id',
  'primary_name',
  'confidence',
  'websites',
  'phones',
  'emails',
  'socials',
  'freeform',
  'locality',
  'region',
  'postcode',
  'country',
  'operating_status',
  'brand',
  'sources',
];

function sqlText(value) {
  return value === null || value === undefined
    ? 'NULL'
    : `'${String(value).replace(/'/g, "''")}'`;
}

function sqlList(value) {
  if (!Array.isArray(value) || value.length === 0) return 'NULL';
  const items = value.map((v) => sqlText(v)).join(', ');
  return `[${items}]`;
}

function sqlTableDdl() {
  const cols = PROJECTION_COLUMNS.map((c) => {
    const type = c === 'confidence' ? 'DOUBLE' : 'VARCHAR';
    return `${c} ${type}`;
  });
  return `CREATE TABLE places_synthetic (${cols.join(', ')});`;
}

function sqlValues(place) {
  return [
    sqlText(place.id),
    sqlText(place.primary_name),
    Number.isFinite(place.confidence) ? place.confidence : 'NULL',
    sqlList(place.websites),
    sqlList(place.phones),
    sqlList(place.emails),
    sqlList(place.socials),
    sqlText(place.freeform),
    sqlText(place.locality),
    sqlText(place.region),
    sqlText(place.postcode),
    sqlText(place.country),
    sqlText(place.operating_status),
    sqlText(place.brand),
    sqlList(place.sources),
  ].join(', ');
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (raw._meta && raw._meta.namespace !== 'TEST-ENRICH-OVERTURE') {
    throw new Error(`synthetic overture source namespace mismatch: ${raw._meta.namespace}`);
  }
  const places = raw.places || [];
  if (places.length === 0) {
    throw new Error('synthetic overture source contains no places');
  }

  const instance = await duckdb.DuckDBInstance.create();
  const conn = await instance.connect();
  await conn.run(sqlTableDdl());
  for (const place of places) {
    await conn.run(`INSERT INTO places_synthetic VALUES (${sqlValues(place)});`);
  }
  const outDir = path.dirname(OUTPUT);
  fs.mkdirSync(outDir, { recursive: true });
  await conn.run(`COPY places_synthetic TO '${OUTPUT.replace(/\\/g, '/')}' (FORMAT PARQUET);`);
  const count = await conn.run('SELECT COUNT(*) AS n FROM places_synthetic;');
  const rows = await count.getRowObjects();
  const n = rows[0].n;
  console.log(`make-overture-synthetic: wrote ${n} place(s) to ${OUTPUT}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`make-overture-synthetic: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { OUTPUT, SOURCE, PROJECTION_COLUMNS };
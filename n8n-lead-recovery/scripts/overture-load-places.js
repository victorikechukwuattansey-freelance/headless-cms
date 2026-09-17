'use strict';

/*
 * Overture Places loader (Prompt H.1) — Contact Enrichment V1 · business half.
 *
 * Downloads Overture Maps PLACES rows for a region into a projected PARQUET
 * file that downstream enrichment nodes convert into the JSON business index
 * consumed by src/enrichment-business.js.
 *
 * OFFLINE NOTE: this script is NOT executed by `npm test` and is a manual,
 * operator-run downloader. It requires network access to the Overture S3
 * bucket and the @duckdb/node-api dependency. See docs/OVERTURE-LOADER.md.
 *
 * Usage:
 *   node scripts/overture-load-places.js --states=TX --output=index/tx.parquet
 *   node scripts/overture-load-places.js --bbox="29.5,-98.5,31.0,-97.0" \
 *       --output=index/san-antonio.parquet --release=2025-10-16.0
 *
 * Options:
 *   --states=<CSV>       US state abbreviations (e.g. TX,NM). Mutually
 *                        exclusive with --bbox.
 *   --bbox=<latMin,lngMin,latMax,lngMax>  Bounding box filter, floats
 *                        (SW lat,lng, NE lat,lng).
 *   --output=<path>      Destination PARQUET path (required).
 *   --release=<version>  Overture release, e.g. 2025-10-16.0. When omitted the
 *                        script tries https://overturemaps.org/release.
 *   --confidence=<float> Minimum place confidence (default 0.5).
 *
 * The query applies (in order): bbox/state filter → HVAC category filter
 * (transport-agnostic ILIKE scan over the serialized categories payload —
 * preferred over fragile taxonomy-name pinning) → confidence gate. The
 * projection is exactly the schema the synthetic fixture mirrors; keep both in
 * sync (fixtures/overture-places-synthetic.source.json).
 */

const fs = require('node:fs');
const path = require('node:path');

let duckdb;
try {
  duckdb = require('@duckdb/node-api');
} catch (err) {
  console.error('overture-load-places: @duckdb/node-api is not installed. Run `npm install @duckdb/node-api` first.');
  process.exit(1);
}

const S3_PREFIX = 's3://overturemaps-us-west-2/release';
const DEFAULT_CONFIDENCE = 0.5;

// US state abbreviation → full name (used to match addresses[1].region).
const STATE_NAMES = {
  AL: 'alabama', AK: 'alaska', AZ: 'arizona', AR: 'arkansas', CA: 'california',
  CO: 'colorado', CT: 'connecticut', DE: 'delaware', FL: 'florida', GA: 'georgia',
  HI: 'hawaii', ID: 'idaho', IL: 'illinois', IN: 'indiana', IA: 'iowa', KS: 'kansas',
  KY: 'kentucky', LA: 'louisiana', ME: 'maine', MD: 'maryland', MA: 'massachusetts',
  MI: 'michigan', MN: 'minnesota', MS: 'mississippi', MO: 'missouri', MT: 'montana',
  NE: 'nebraska', NV: 'nevada', NH: 'new hampshire', NJ: 'new jersey', NM: 'new mexico',
  NY: 'new york', NC: 'north carolina', ND: 'north dakota', OH: 'ohio', OK: 'oklahoma',
  OR: 'oregon', PA: 'pennsylvania', RI: 'rhode island', SC: 'south carolina',
  SD: 'south dakota', TN: 'tennessee', TX: 'texas', UT: 'utah', VT: 'vermont',
  VA: 'virginia', WA: 'washington', WV: 'west virginia', WI: 'wisconsin', WY: 'wyoming',
  DC: 'district of columbia',
};

// HVAC-adjacent filter. Matched via the serialized categories payload (ILIKE)
// instead of a pinned taxonomy so a taxonomy rename in a future release cannot
// silently drop the filter.
const HVAC_FILTER =
  "CAST(categories AS VARCHAR) ILIKE '%heating%' OR " +
  "CAST(categories AS VARCHAR) ILIKE '%air_conditio%' OR " +
  "CAST(categories AS VARCHAR) ILIKE '%ventilation%'";

const PROJECTION = [
  'id',
  'names.primary AS primary_name',
  'confidence',
  'websites AS websites',
  'phones AS phones',
  'emails AS emails',
  'socials AS socials',
  'addresses[1].freeform AS freeform',
  'addresses[1].locality AS locality',
  'addresses[1].region AS region',
  'addresses[1].postcode AS postcode',
  'addresses[1].country AS country',
  'operating_status AS operating_status',
  'brand AS brand',
  'sources AS sources',
];

function fail(message) {
  console.error(`overture-load-places: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (raw.startsWith('--')) {
      const eq = raw.indexOf('=');
      const key = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
      const value = eq === -1 ? true : raw.slice(eq + 1);
      args[key] = value;
    }
  }
  return args;
}

function parseBbox(value) {
  const parts = String(value).split(',').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    fail(`--bbox must be latMin,lngMin,latMax,lngMax (got "${value}")`);
  }
  const [latMin, lngMin, latMax, lngMax] = parts;
  if (latMin >= latMax || lngMin >= lngMax) {
    fail('--bbox must satisfy latMin<latMax and lngMin<lngMax');
  }
  return { latMin, lngMin, latMax, lngMax };
}

function parseStates(value) {
  const codes = String(value)
    .toUpperCase()
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (codes.length === 0) fail('--states must be a non-empty CSV of US state codes (e.g. TX,NM)');
  for (const code of codes) {
    if (!Object.prototype.hasOwnProperty.call(STATE_NAMES, code)) {
      fail(`unknown US state code "${code}"`);
    }
  }
  return codes;
}

async function resolveRelease(args) {
  if (typeof args.release === 'string' && args.release !== '') {
    return args.release;
  }
  const instance = await duckdb.DuckDBInstance.create();
  const conn = await instance.connect();
  try {
    const result = await conn.run(
      "SELECT content FROM read_text('https://overturemaps.org/release') LIMIT 1;",
    );
    const rows = await result.getRowObjects();
    const release = String(rows[0]?.content || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}(\.\d+)?$/.test(release)) {
      throw new Error(`unexpected release payload: ${JSON.stringify(release)}`);
    }
    return release;
  } catch (err) {
    fail(
      `could not resolve the latest Overture release (${err.message}). ` +
        'Pass --release explicitly, e.g. --release=2025-10-16.0',
    );
  }
  return null;
}

function buildWhere(args, confidence) {
  const clauses = [`confidence >= ${confidence}`];
  if (args.bbox) {
    const b = parseBbox(args.bbox);
    clauses.push(`bbox.xmin >= ${b.lngMin}`);
    clauses.push(`bbox.xmax <= ${b.lngMax}`);
    clauses.push(`bbox.ymin >= ${b.latMin}`);
    clauses.push(`bbox.ymax <= ${b.latMax}`);
  }
  if (args.states) {
    const names = parseStates(args.states).map((code) => STATE_NAMES[code]);
    const ors = names
      .map((name) => `lower(CAST(addresses[1].region AS VARCHAR)) ILIKE '%${name}%'`)
      .join(' OR ');
    clauses.push(`(${ors})`);
  }
  return clauses.join(' AND ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.output !== 'string' || args.output === '') {
    fail('--output=<path> is required');
  }
  if (args.states !== undefined && args.states !== true && args.bbox !== undefined && args.bbox !== true) {
    fail('--states and --bbox are mutually exclusive');
  }
  if (args.states === undefined && (args.bbox === undefined || args.bbox === true)) {
    fail('provide either --states=<CSV> or --bbox=...');
  }
  const confidence = args.confidence !== undefined && args.confidence !== true
    ? Number(args.confidence)
    : DEFAULT_CONFIDENCE;
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) {
    fail(`--confidence must be in (0, 1] (got ${args.confidence})`);
  }

  const output = path.resolve(args.output);
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const release = await resolveRelease(args);
  const prefix = `${S3_PREFIX}/${release}/theme=places/type=place/*.parquet`;
  const where = buildWhere(args, confidence);
  const sql =
    `COPY (SELECT ${PROJECTION.join(', ')} FROM read_parquet('${prefix}') ` +
    `WHERE ${where} AND (${HVAC_FILTER})) TO '${output}' (FORMAT PARQUET);`;
  const countSql =
    `SELECT COUNT(*) AS n FROM (SELECT ${PROJECTION.join(', ')} FROM read_parquet('${prefix}') ` +
    `WHERE ${where} AND (${HVAC_FILTER}));`;

  const instance = await duckdb.DuckDBInstance.create();
  const conn = await instance.connect();
  await conn.run(sql);
  const count = await conn.run(countSql);
  const rows = await count.getRowObjects();
  const n = rows[0]?.n || 0;
  console.log(`overture-load-places: wrote ${n} place(s) to ${output}`);
  console.log(`  release=${release} filter=[${where}]`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`overture-load-places: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildWhere,
  parseStates,
  parseBbox,
  resolveRelease,
  STATE_NAMES,
  HVAC_FILTER,
  PROJECTION,
  S3_PREFIX,
  DEFAULT_CONFIDENCE,
};
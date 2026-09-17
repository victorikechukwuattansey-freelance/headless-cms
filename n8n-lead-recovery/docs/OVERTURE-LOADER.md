# Overture Places Loader — Contact Enrichment V1 · Business Half

The business enrichment engine (`src/enrichment-business.js`) matches Raw Leads
against a JSON business index built from Overture Maps PLACES rows. This
document describes how that index is produced.

## Pipeline

1. **Download** — `scripts/overture-load-places.js` reads the Overture S3
   bucket (`s3://overturemaps-us-west-2/release/<release>/theme=places/type=place/*.parquet`)
   and writes a projected PARQUET file for a region.
2. **Convert** — a downstream enrichment node reads the PARQUET and builds the
   JSON `index` object consumed by `enrichBusinessLeads({ leads, index, ... })`
   (one entry per place: gers_id, primary_name, website, phone, city, state_code,
   country, operating_status, confidence).
3. **Match** — see `src/enrichment-business.js` for match priority
   (phone → website → name+city+state) and confidence mapping.

## Downloader usage

```powershell
# By US state (comma-separated)
node scripts/overture-load-places.js --states=TX --output=index/tx.parquet

# By bounding box (latMin,lngMin,latMax,lngMax)
node scripts/overture-load-places.js --bbox="29.5,-98.5,31.0,-97.0" --output=index/san-antonio.parquet --release=2025-10-16.0

# Optional flags
#   --release=<version>   pin a release (default: latest via https://overturemaps.org/release)
#   --confidence=<float>  minimum place confidence (default 0.5)
```

Requires `@duckdb/node-api` (`npm install @duckdb/node-api`) and network access
to the Overture S3 bucket. This is an **operator-run, manual downloader** — it is
**not** executed by `npm test` and performs no writes to the sheet.

## Filters (applied in order)

1. **Region** — `--states` (US abbreviations mapped to full region names, e.g.
   `TX` → lowercase `texas` matched via `ILIKE` on `addresses[1].region`) or
   `--bbox` (exact bounds on the place `bbox`).
2. **HVAC category** — transport-agnostic `ILIKE` scan over the serialized
   `categories` payload for heating / air-conditioning / ventilation. This is
   deliberately not pinned to a single taxonomy name so a future classification
   rename cannot silently drop the filter (see `HVAC_FILTER`).
3. **Confidence** — `confidence >= <min>` (default 0.5).

## Projection

Exactly 15 columns are kept (see `PROJECTION` in the script): `id`
(gers_id), `primary_name`, `confidence`, `websites`, `phones`, `emails`,
`socials`, `freeform`, `locality`, `region`, `postcode`, `country`,
`operating_status`, `brand`, `sources`.

## Offline / synthetic fixture

Real downloaded files are git-ignored (`*.parquet`). For offline tests the repo
commits a synthetic mirror:

- `fixtures/overture-places-synthetic.source.json` — human-readable source.
- `fixtures/overture-places-synthetic.parquet` — the committed parquet,
  regenerated idempotently by `scripts/make-overture-synthetic.js`
  (`node scripts/make-overture-synthetic.js`).

Keep the source JSON's fields in sync with the loader projection so the
synthetic file remains a faithful pipeline-shape mirror.
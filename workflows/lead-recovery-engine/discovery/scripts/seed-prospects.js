'use strict';

const path = require('path');
const { buildProspect, ingestProspect, assessOpportunity } = require('../src/pipeline');
const { loadCsv, saveCsv, asProspectRecord } = require('../src/store');

const STORE = path.join(__dirname, '..', 'data', 'prospects.csv');
const SEED = path.join(__dirname, '..', 'seeds', 'prospects.example.csv');

function main() {
  const existing = loadCsv(STORE).map(asProspectRecord);
  const seedRows = loadCsv(SEED);
  let added = 0;
  let dup = 0;

  for (const row of seedRows) {
    const built = buildProspect(row);
    if (!built.ok) continue;
    const rec = built.value;
    const res = assessOpportunity(
      rec,
      {
        appointment_dependency: true,
        inbound_lead_dependency: true,
        service_ticket_value: true,
        business_scale: false,
        service_area: true,
        manual_inquiry_handling: true,
        followup_operational_difficulty: true,
        model_fit: true,
      },
      { cls: 'OBSERVED', text: 'Business has a public website with an online inquiry form.' }
    );
    const known = existing.concat([]);
    const ingest = ingestProspect(res.value, known);
    if (ingest.duplicate) {
      dup++;
      continue;
    }
    existing.push(ingest.value);
    added++;
  }

  saveCsv(STORE, existing);
  console.log(`Seeded store: ${added} added, ${dup} duplicates skipped. Total=${existing.length}`);
}

main();

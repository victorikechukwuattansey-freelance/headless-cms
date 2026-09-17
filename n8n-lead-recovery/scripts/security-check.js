const fs = require('fs');

const PROSPECT = 'Lead Recovery Engine — Prospect Finder & Validation V1.json';
const ENRICHMENT = 'Enrichment V1.json';

function scan(name, checks) {
  console.log(`--- ${name} ---`);
  for (const [label, fn] of checks) {
    console.log(`${label}: ${fn()}`);
  }
}

scan(PROSPECT, [
  ['Has GOOGLE_PLACES_API_KEY', () => fs.readFileSync(PROSPECT, 'utf8').indexOf('GOOGLE_PLACES_API_KEY') !== -1],
  ['Has Bearer token (Foursquare)', () => fs.readFileSync(PROSPECT, 'utf8').indexOf('Bearer') !== -1],
  ['Has $env pattern', () => fs.readFileSync(PROSPECT, 'utf8').indexOf('$env') !== -1],
  ['Has hardcoded Foursquare key', () => fs.readFileSync(PROSPECT, 'utf8').indexOf('3VHR5VCJBHGFJXGRBMVJKANAGJGUD1EXUELX3R0H2PGJCMG4') !== -1],
]);

const enr = () => fs.readFileSync(ENRICHMENT, 'utf8');

scan(ENRICHMENT, [
  ['Has HUNTER_API_KEY / HUNTER credentials', () => /HUNTER_[A-Z_]*KEY/.test(enr())],
  ['Has AGENTDATA_API_KEY / AGENTDATA credentials', () => /AGENTDATA_[A-Z_]*KEY/.test(enr())],
  ['Has api_key / apiKey expressions', () => /api_?key/i.test(enr())],
  ['Has Authorization header', () => /Authorization/i.test(enr())],
  ['Has $env pattern', () => enr().indexOf('$env') !== -1],
  ['Has process.env access', () => /process\.env/.test(enr())],
  ['Has embedded credential blocks', () => enr().indexOf('credentials') !== -1],
  ['Has bearer-style tokens', () => /Bearer\s+[A-Za-z0-9+/]{20,}/.test(enr())],
  ['Has hardcoded UUID keys', () => /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(enr())],
  ['Has @gmail/@yahoo-style real addresses', () => /@(gmail|yahoo|hotmail|outlook)\.(com|co\.uk)/i.test(enr())],
  ['Has fixture domain material (example.com)', () => /example\.com/.test(enr())],
]);
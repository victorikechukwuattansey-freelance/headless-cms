#!/usr/bin/env node
'use strict';

/* ---------------------------------------------------------------------------
 * SUPERSEDED — historical (Prompt A.5).
 *
 * This script is retired. It is retained ONLY as an audit trail for the GPL
 * integration work: it is the mutation script whose line 132–144 misread
 * n8n's connection model and installed the definitive "Merge feedback cycle /
 * GPL input-index collision" wiring defect (§6.1/§6.2 in
 * reports/PROSPECT-FINDER-GPL-PREFLIGHT.md, fixed by revision R1 and now
 * guarded by tests/gpl-workflow.test.js "Merge wiring integrity").
 *
 * The regenerable path is scripts/build-prospect-finder-workflow.js, which
 * assembles the artifact byte-for-byte from
 *   - src/prospect-finder-workflow-contract.js (topology + non-code params)
 *   - src/prospect-finder-embedded-code.js    (the code-node jsCode bodies)
 * Do NOT use this script for new work; do NOT run it against the artifact.
 * ------------------------------------------------------------------------- */

const fs = require('fs');
const path = require('path');

const workflowPath = path.join(__dirname, '..', 'Lead Recovery Engine — Prospect Finder & Validation V1.json');

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// Find key nodes
const setStatusRunning = workflow.nodes.find(n => n.name === 'Set Status Running');
const mergeNode = workflow.nodes.find(n => n.name === 'Merge');
const buildFSQ = workflow.nodes.find(n => n.name === 'Build FSQ API Query');
const buildOSM = workflow.nodes.find(n => n.name === 'Build OSM API Query');
const processFSQ = workflow.nodes.find(n => n.name === 'Process FSQ');
const processOSM = workflow.nodes.find(n => n.name === 'Process OSM');

if (!setStatusRunning || !mergeNode || !buildFSQ || !buildOSM || !processFSQ || !processOSM) {
  console.error('Could not find required nodes');
  process.exit(1);
}

console.log('Found key nodes:');
console.log('  Set Status Running:', setStatusRunning.id);
console.log('  Merge:', mergeNode.id);
console.log('  Build FSQ:', buildFSQ.id);
console.log('  Build OSM:', buildOSM.id);
console.log('  Process FSQ:', processFSQ.id);
console.log('  Process OSM:', processOSM.id);

// Generate new node IDs
const buildGPLId = generateId();
const gplApiId = generateId();
const processGPLId = generateId();

// Position new nodes between FSQ and OSM branches
const baseX = 1808; // Build FSQ/OSM x position
const baseY = -80;  // Build FSQ y position

// New nodes
const buildGPL = {
  parameters: {
    jsCode: "const input = $json;\n\nreturn [{\n  json: {\n    ...input,\n\n    gpl_query: input.search_query || `${input.niche} in ${input.city}, ${input.state}`,\n    gpl_max_results: Math.min(Number(input.target_count || 1) * 3, 20),\n\n    discovery_source: 'GOOGLE_PLACES'\n  }\n}];"
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [baseX, baseY - 180],
  id: buildGPLId,
  name: 'Build GPL API Query'
};

const gplApi = {
  parameters: {
    method: 'POST',
    url: 'https://places.googleapis.com/v1/places:searchText',
    sendBody: true,
    jsonParameters: true,
    options: {
      response: {
        response: {
          fullResponse: true
        }
      }
    },
    headerParameters: {
      parameters: [
        {
          name: 'X-Goog-Api-Key',
          value: '={{ $env.GOOGLE_PLACES_API_KEY }}'
        },
        {
          name: 'X-Goog-FieldMask',
          value: 'places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.types'
        }
      ]
    },
    bodyParametersJson: "={{ JSON.stringify({ textQuery: $json.gpl_query, maxResultCount: $json.gpl_max_results, languageCode: 'en' }) }}"
  },
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.5,
  position: [baseX + 176, baseY - 180],
  id: gplApiId,
  name: 'Google Places API',
  retryOnFail: true,
  waitBetweenTries: 5000,
  onError: 'continueErrorOutput'
};

const processGPL = {
  parameters: {
    jsCode: "const staticData = $getWorkflowStaticData('global');\nconst response = $input.first().json;\nconst searchInput = $('Build GPL API Query').first().json;\n\nconst statusCode = response.statusCode || 0;\nconst body = response.body || response;\nconst error = body.error || {};\n\nif (statusCode !== 200 || error.code) {\n  const errorMsg = error.message || error.status || 'HTTP error ' + statusCode || 'Unknown API error';\n  staticData.errorsEncountered = (staticData.errorsEncountered || 0) + 1;\n\n  return [{\n    json: {\n      input_id: searchInput.input_id || '',\n      _errorMessage: 'Google Places API error: ' + errorMsg + ' (HTTP ' + statusCode + ')',\n      _rawStatus: error.status || ('HTTP ' + statusCode),\n      _provider: 'google_places'\n    }\n  }];\n}\n\nconst places = body.places || [];\nconst capturedAt = new Date().toISOString();\n\nconst maxResults = Math.min(\n  Number(searchInput.target_count || 1) * 3,\n  20,\n  Number(staticData.MAX_RESULTS_PER_SEARCH) || 20\n);\n\nfunction clean(value) {\n  return String(value ?? '').trim();\n}\n\nfunction normalizeWebsite(value) {\n  const raw = clean(value);\n  if (!raw) return '';\n  return raw\n    .replace(/^https?:\\/\\//i, '')\n    .replace(/^www\\./i, '')\n    .replace(/\\/+$/, '');\n}\n\nfunction normalizePhone(value) {\n  const raw = clean(value);\n  if (!raw) return '';\n  return raw.replace(/[^\\d+]/g, '');\n}\n\nfunction buildDedupeKey(lead) {\n  if (lead.website) {\n    return 'website:' + normalizeWebsite(lead.website).toLowerCase();\n  }\n  if (lead.phone) {\n    return 'phone:' + normalizePhone(lead.phone);\n  }\n  if (lead.business_name && lead.city && lead.state) {\n    return 'ncs:' + [\n      clean(lead.business_name).toLowerCase(),\n      clean(lead.city).toLowerCase(),\n      clean(lead.state).toLowerCase()\n    ].join('|');\n  }\n  return '';\n}\n\nfunction generateLeadId(placeId, index) {\n  const str = String(placeId || '') + ':' + index;\n  let hash = 0;\n  for (let i = 0; i < str.length; i++) {\n    hash = ((hash << 5) - hash) + str.charCodeAt(i);\n    hash |= 0;\n  }\n  const hex = Math.abs(hash).toString(16).padStart(8, '0');\n  return 'GP-' + hex;\n}\n\nconst leads = [];\nfor (let i = 0; i < Math.min(places.length, maxResults); i++) {\n  const place = places[i];\n  const displayName = place?.displayName?.text ?? '';\n  if (!displayName) continue;\n\n  const formattedAddress = clean(place?.formattedAddress);\n  const phone = normalizePhone(place?.internationalPhoneNumber);\n  const website = normalizeWebsite(place?.websiteUri);\n  const rating = place?.rating !== undefined && place?.rating !== null ? String(place.rating) : '';\n  const reviewCount = place?.userRatingCount !== undefined && place?.userRatingCount !== null ? String(place.userRatingCount) : '';\n  const googleMapsUrl = clean(place?.googleMapsUri);\n  const types = place?.types || [];\n  const businessType = types[0] || 'establishment';\n  const placeId = place?.id || '';\n\n  const lead = {\n    lead_id: generateLeadId(placeId, i),\n    business_name: displayName,\n    niche: clean(searchInput.niche),\n    city: clean(searchInput.city),\n    state: clean(searchInput.state),\n    country: clean(searchInput.country),\n    address: formattedAddress,\n    phone,\n    website,\n    rating,\n    review_count: reviewCount,\n    google_maps_url: googleMapsUrl,\n    business_type: businessType,\n    source: 'google_places',\n    search_input_id: clean(searchInput.input_id),\n    dedupe_key: buildDedupeKey({ website, phone, business_name: displayName, city: clean(searchInput.city), state: clean(searchInput.state) }),\n    raw_captured_at: capturedAt,\n    notes: 'Google Places: ' + (searchInput.search_query || (clean(searchInput.niche) + ' in ' + clean(searchInput.city) + ', ' + clean(searchInput.state))) + '; gp_place_id:' + placeId\n  };\n\n  leads.push({ json: lead });\n}\n\nif (leads.length === 0) {\n  return [{ json: { _noResults: true, _message: 'Google Places returned zero results', _provider: 'google_places' } }];\n}\n\nreturn leads;"
  },
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [baseX + 352, baseY - 180],
  id: processGPLId,
  name: 'Process GPL',
  alwaysOutputData: false
};

// Add new nodes to workflow
workflow.nodes.push(buildGPL, gplApi, processGPL);

// Update connections
// 1. Set Status Running -> Build GPL API Query (parallel to FSQ and OSM)
const setStatusConnections = workflow.connections['Set Status Running'].main[0];
setStatusConnections.push({ node: 'Build GPL API Query', type: 'main', index: 0 });

// 2. Build GPL API Query -> Google Places API
workflow.connections['Build GPL API Query'] = {
  main: [[
    { node: 'Google Places API', type: 'main', index: 0 }
  ]]
};

// 3. Google Places API -> Process GPL
workflow.connections['Google Places API'] = {
  main: [[
    { node: 'Process GPL', type: 'main', index: 0 }
  ]]
};

// 4. Process GPL -> Merge (as input 2)
const mergeConnections = workflow.connections['Merge'].main;
if (mergeConnections && mergeConnections[0]) {
  // Merge currently has inputs 0 (FSQ) and 1 (OSM), add input 2 (GPL)
  mergeConnections[0].push({ node: 'Process GPL', type: 'main', index: 0 });
}

// Also need to add connection from Process GPL to Merge
workflow.connections['Process GPL'] = {
  main: [[
    { node: 'Merge', type: 'main', index: 0 }
  ]]
};

// Write back
fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2));
console.log('Workflow updated successfully!');
console.log('Added nodes:');
console.log('  Build GPL API Query:', buildGPLId);
console.log('  Google Places API:', gplApiId);
console.log('  Process GPL:', processGPLId);
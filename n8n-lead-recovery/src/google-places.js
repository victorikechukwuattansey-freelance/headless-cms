'use strict';

/**
 * Google Places (New) API normalization for the Lead Recovery Engine.
 * Pure functions — no n8n dependencies, no side effects.
 * Used by the Process GPL n8n Code node and by tests.
 */

const MAX_RESULTS_PER_SEARCH = 20;

function clean(value) {
  return String(value ?? '').trim();
}

function normalizeWebsite(value) {
  const raw = clean(value);
  if (!raw) return '';
  // Strip protocol, www, trailing slash — matches existing pipeline convention
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
}

function normalizePhone(value) {
  const raw = clean(value);
  if (!raw) return '';
  // Keep international format with + but strip non-digits except leading +
  // Matches existing pipeline: digits only for phone dedupe key
  return raw.replace(/[^\d+]/g, '');
}

function buildDedupeKey(lead) {
  // Matches existing dedupe algorithm exactly:
  // website: → phone: → ncs:name|city|state
  if (lead.website) {
    return 'website:' + normalizeWebsite(lead.website).toLowerCase();
  }
  if (lead.phone) {
    return 'phone:' + normalizePhone(lead.phone);
  }
  if (lead.business_name && lead.city && lead.state) {
    return 'ncs:' + [
      clean(lead.business_name).toLowerCase(),
      clean(lead.city).toLowerCase(),
      clean(lead.state).toLowerCase()
    ].join('|');
  }
  return '';
}

function generateLeadId(placeId, index) {
  // Deterministic lead ID from place ID + index
  // Uses first 8 chars of a simple hash of placeId
  const str = String(placeId || '') + ':' + index;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // 32-bit int
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return 'GP-' + hex;
}

function normalizeGooglePlace(place, searchInput, index, capturedAt) {
  const displayName = place?.displayName?.text ?? '';
  if (!displayName) return null; // Skip malformed places with empty names

  const formattedAddress = clean(place?.formattedAddress);
  const phone = normalizePhone(place?.internationalPhoneNumber);
  const website = normalizeWebsite(place?.websiteUri);
  const rating = place?.rating !== undefined && place?.rating !== null
    ? String(place.rating)
    : '';
  const reviewCount = place?.userRatingCount !== undefined && place?.userRatingCount !== null
    ? String(place.userRatingCount)
    : '';
  const googleMapsUrl = clean(place?.googleMapsUri);
  const types = place?.types || [];
  const businessType = types[0] || 'establishment';
  const placeId = place?.id || '';

  const lead = {
    business_name: displayName,
    niche: clean(searchInput?.niche),
    city: clean(searchInput?.city),
    state: clean(searchInput?.state),
    country: clean(searchInput?.country),
    address: formattedAddress,
    phone,
    website,
    rating,
    review_count: reviewCount,
    google_maps_url: googleMapsUrl,
    business_type: businessType,
    source: 'google_places',
    search_input_id: clean(searchInput?.input_id),
    raw_captured_at: capturedAt
  };

  lead.dedupe_key = buildDedupeKey(lead);
  lead.lead_id = generateLeadId(placeId, index);
  lead.notes = `Google Places: ${clean(searchInput?.search_query || (lead.niche + ' in ' + lead.city + ', ' + lead.state))}; gp_place_id:${placeId}`;

  return lead;
}

/**
 * Normalizes a Google Places API (New) searchText response into Raw Leads rows.
 * @param {Object} gplResponse - The raw JSON response from places:searchText
 * @param {Object} searchInput - The Search Input row that triggered this query
 * @param {Object} staticData - Workflow staticData for MAX_RESULTS_PER_SEARCH
 * @returns {Array} Array of Raw Leads objects (max MAX_RESULTS_PER_SEARCH)
 */
function normalizeGooglePlacesResponse(gplResponse, searchInput, staticData) {
  const capturedAt = new Date().toISOString();
  const places = gplResponse?.places || [];

  // Handle API error responses
  if (gplResponse?.error) {
    return {
      error: true,
      statusCode: gplResponse.error.code || 0,
      errorMessage: gplResponse.error.message || gplResponse.error.status || 'Unknown API error',
      rawResponse: gplResponse
    };
  }

  const maxResults = Math.min(
    Number(searchInput?.target_count || 1) * 3,
    20,
    Number(staticData?.MAX_RESULTS_PER_SEARCH) || 20
  );

  const leads = [];
  for (let i = 0; i < Math.min(places.length, maxResults); i++) {
    const lead = normalizeGooglePlace(places[i], searchInput, i, capturedAt);
    if (lead) leads.push(lead);
  }

  return { leads, error: false };
}

module.exports = {
  clean,
  normalizeWebsite,
  normalizePhone,
  buildDedupeKey,
  generateLeadId,
  normalizeGooglePlace,
  normalizeGooglePlacesResponse,
  MAX_RESULTS_PER_SEARCH
};
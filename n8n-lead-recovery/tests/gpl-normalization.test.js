'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  clean,
  normalizeWebsite,
  normalizePhone,
  buildDedupeKey,
  generateLeadId,
  normalizeGooglePlace,
  normalizeGooglePlacesResponse
} = require('../src/google-places');

const FIXED_NOW = '2026-09-12T00:00:00.000Z';

function stripRuntime(lead) {
  const { raw_captured_at, lead_id, notes, ...rest } = lead;
  return rest;
}

describe('google-places normalization', () => {
  let staticData;

  before(() => {
    staticData = { MAX_RESULTS_PER_SEARCH: 20 };
  });

  describe('clean', () => {
    it('trims whitespace', () => {
      assert.equal(clean('  hello  '), 'hello');
    });
    it('handles null/undefined', () => {
      assert.equal(clean(null), '');
      assert.equal(clean(undefined), '');
    });
  });

  describe('normalizeWebsite', () => {
    it('strips protocol, www, trailing slash', () => {
      assert.equal(normalizeWebsite('https://www.example.com/'), 'example.com');
      assert.equal(normalizeWebsite('http://example.com'), 'example.com');
      assert.equal(normalizeWebsite('www.test.com/path/'), 'test.com/path');
    });
    it('handles empty', () => {
      assert.equal(normalizeWebsite(''), '');
      assert.equal(normalizeWebsite(null), '');
    });
  });

  describe('normalizePhone', () => {
    it('preserves + and digits', () => {
      assert.equal(normalizePhone('+1 214-555-0100'), '+12145550100');
      assert.equal(normalizePhone('(214) 555-0100'), '2145550100');
    });
    it('handles empty', () => {
      assert.equal(normalizePhone(''), '');
    });
  });

  describe('buildDedupeKey', () => {
    it('prefers website', () => {
      const lead = { website: 'example.com', phone: '+12145550100', business_name: 'Test', city: 'Dallas', state: 'Texas' };
      assert.equal(buildDedupeKey(lead), 'website:example.com');
    });
    it('falls back to phone', () => {
      const lead = { website: '', phone: '+12145550100', business_name: 'Test', city: 'Dallas', state: 'Texas' };
      assert.equal(buildDedupeKey(lead), 'phone:+12145550100');
    });
    it('falls back to ncs', () => {
      const lead = { website: '', phone: '', business_name: 'Test Biz', city: 'Dallas', state: 'Texas' };
      assert.equal(buildDedupeKey(lead), 'ncs:test biz|dallas|texas');
    });
    it('returns empty for insufficient data', () => {
      assert.equal(buildDedupeKey({}), '');
    });
  });

  describe('generateLeadId', () => {
    it('is deterministic for same input', () => {
      const id1 = generateLeadId('ChIJ123', 0);
      const id2 = generateLeadId('ChIJ123', 0);
      assert.equal(id1, id2);
      assert.match(id1, /^GP-[a-f0-9]{8}$/);
    });
    it('differs for different place IDs', () => {
      const id1 = generateLeadId('ChIJ123', 0);
      const id2 = generateLeadId('ChIJ456', 0);
      assert.notEqual(id1, id2);
    });
  });

  describe('normalizeGooglePlace', () => {
    const searchInput = {
      input_id: 'S-HVAC-001',
      niche: 'HVAC',
      city: 'Dallas',
      state: 'Texas',
      country: 'USA',
      search_query: 'HVAC repair in Dallas, Texas',
      target_count: 1
    };

    it('normalizes full place', () => {
      const place = {
        id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        displayName: { text: 'Acme HVAC Services', languageCode: 'en' },
        formattedAddress: '123 Main St, Dallas, TX 75201, USA',
        internationalPhoneNumber: '+1 214-555-0100',
        websiteUri: 'https://www.acmehvac.example.com',
        rating: 4.5,
        userRatingCount: 127,
        googleMapsUri: 'https://maps.google.com/?cid=123456789',
        types: ['hvac_contractor', 'point_of_interest', 'establishment']
      };

      const lead = normalizeGooglePlace(place, searchInput, 0, FIXED_NOW);
      assert.ok(lead);
      assert.equal(lead.business_name, 'Acme HVAC Services');
      assert.equal(lead.niche, 'HVAC');
      assert.equal(lead.city, 'Dallas');
      assert.equal(lead.state, 'Texas');
      assert.equal(lead.country, 'USA');
      assert.equal(lead.address, '123 Main St, Dallas, TX 75201, USA');
      assert.equal(lead.phone, '+12145550100');
      assert.equal(lead.website, 'acmehvac.example.com');
      assert.equal(lead.rating, '4.5');
      assert.equal(lead.review_count, '127');
      assert.equal(lead.google_maps_url, 'https://maps.google.com/?cid=123456789');
      assert.equal(lead.business_type, 'hvac_contractor');
      assert.equal(lead.source, 'google_places');
      assert.equal(lead.search_input_id, 'S-HVAC-001');
      assert.equal(lead.dedupe_key, 'website:acmehvac.example.com');
      assert.match(lead.lead_id, /^GP-[a-f0-9]{8}$/);
      assert.ok(lead.notes.includes('gp_place_id:ChIJN1t_tDeuEmsRUsoyG83frY4'));
    });

    it('handles minimal place (only name)', () => {
      const place = {
        id: 'ChIJMinimal123',
        displayName: { text: 'Quick Plumb Co', languageCode: 'en' },
        formattedAddress: '',
        internationalPhoneNumber: '',
        websiteUri: '',
        rating: null,
        userRatingCount: null,
        googleMapsUri: '',
        types: ['plumber']
      };

      const lead = normalizeGooglePlace(place, searchInput, 0, FIXED_NOW);
      assert.ok(lead);
      assert.equal(lead.business_name, 'Quick Plumb Co');
      assert.equal(lead.address, '');
      assert.equal(lead.phone, '');
      assert.equal(lead.website, '');
      assert.equal(lead.rating, '');
      assert.equal(lead.review_count, '');
      assert.equal(lead.google_maps_url, '');
      assert.equal(lead.business_type, 'plumber');
      assert.equal(lead.dedupe_key, 'ncs:quick plumb co|dallas|texas');
    });

    it('handles null/undefined optional fields', () => {
      const place = {
        id: 'ChIJMissing456',
        displayName: { text: 'Spark Electric', languageCode: 'en' },
        formattedAddress: '456 Oak Ave, San Antonio, TX 78201',
        internationalPhoneNumber: null,
        websiteUri: null,
        rating: 4.0,
        userRatingCount: 0,
        googleMapsUri: null,
        types: ['electrician', 'establishment']
      };

      const lead = normalizeGooglePlace(place, searchInput, 0, FIXED_NOW);
      assert.ok(lead);
      assert.equal(lead.phone, '');
      assert.equal(lead.website, '');
      assert.equal(lead.rating, '4');
      assert.equal(lead.review_count, '0');
      assert.equal(lead.google_maps_url, '');
    });

    it('returns null for empty business name', () => {
      const place = {
        id: 'ChIJBad333',
        displayName: { text: '', languageCode: 'en' },
        formattedAddress: '100 Bad St, Austin, TX 78701',
        internationalPhoneNumber: '+1 512-555-0300',
        websiteUri: 'https://bad.example.com',
        rating: 3.0,
        userRatingCount: 10,
        googleMapsUri: 'https://maps.google.com/?cid=777888999',
        types: ['plumber']
      };

      const lead = normalizeGooglePlace(place, searchInput, 0, FIXED_NOW);
      assert.equal(lead, null);
    });
  });

  describe('normalizeGooglePlacesResponse', () => {
    const searchInput = {
      input_id: 'S-HVAC-001',
      niche: 'HVAC',
      city: 'Dallas',
      state: 'Texas',
      country: 'USA',
      search_query: 'HVAC repair in Dallas, Texas',
      target_count: 1
    };

    it('returns leads array on success', () => {
      const response = {
        places: [
          {
            id: 'ChIJ123',
            displayName: { text: 'Test HVAC', languageCode: 'en' },
            formattedAddress: '123 Test St',
            internationalPhoneNumber: '+1 555-0001',
            websiteUri: 'https://test.example.com',
            rating: 4.0,
            userRatingCount: 50,
            googleMapsUri: 'https://maps.google.com/?cid=111',
            types: ['hvac_contractor']
          }
        ]
      };

      const result = normalizeGooglePlacesResponse(response, searchInput, staticData);
      assert.equal(result.error, false);
      assert.ok(Array.isArray(result.leads));
      assert.equal(result.leads.length, 1);
      assert.equal(result.leads[0].source, 'google_places');
    });

    it('respects maxResults cap (target_count * 3, 20, MAX_RESULTS_PER_SEARCH)', () => {
      const places = Array.from({ length: 25 }, (_, i) => ({
        id: `ChIJ${i}`,
        displayName: { text: `Biz ${i}`, languageCode: 'en' },
        types: ['establishment']
      }));
      const response = { places };
      const searchInputHigh = { ...searchInput, target_count: 10 }; // 10 * 3 = 30, capped at 20

      const result = normalizeGooglePlacesResponse(response, searchInputHigh, staticData);
      assert.equal(result.leads.length, 20);
    });

    it('handles empty places array', () => {
      const response = { places: [] };
      const result = normalizeGooglePlacesResponse(response, searchInput, staticData);
      assert.equal(result.error, false);
      assert.equal(result.leads.length, 0);
    });

    it('returns error object for API error response', () => {
      const response = {
        error: { code: 403, message: 'PERMISSION_DENIED', status: 'PERMISSION_DENIED' }
      };

      const result = normalizeGooglePlacesResponse(response, searchInput, staticData);
      assert.equal(result.error, true);
      assert.equal(result.statusCode, 403);
      assert.ok(result.errorMessage.includes('PERMISSION_DENIED'));
    });

    it('handles HTTP error status codes', () => {
      // The normalizeGooglePlacesResponse function checks for gplResponse.error at top level
      const response = {
        error: { code: 429, message: 'RESOURCE_EXHAUSTED', status: 'RESOURCE_EXHAUSTED' }
      };

      const result = normalizeGooglePlacesResponse(response, searchInput, staticData);
      assert.equal(result.error, true);
      assert.equal(result.statusCode, 429);
    });

    it('limits results by target_count', () => {
      const places = Array.from({ length: 10 }, (_, i) => ({
        id: `ChIJ${i}`,
        displayName: { text: `Biz ${i}`, languageCode: 'en' },
        types: ['establishment']
      }));
      const response = { places };
      const searchInputLow = { ...searchInput, target_count: 2 }; // 2 * 3 = 6, but only 10 available

      const result = normalizeGooglePlacesResponse(response, searchInputLow, staticData);
      assert.equal(result.leads.length, 6);
    });
  });
});
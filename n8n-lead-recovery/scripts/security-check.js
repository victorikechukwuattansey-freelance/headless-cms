const fs = require('fs');
const f = fs.readFileSync('Lead Recovery Engine — Prospect Finder & Validation V1.json', 'utf8');

console.log('Has GOOGLE_PLACES_API_KEY:', f.indexOf('GOOGLE_PLACES_API_KEY') !== -1);
console.log('Has Bearer token (Foursquare):', f.indexOf('Bearer') !== -1);
console.log('Has $env pattern:', f.indexOf('$env') !== -1);
console.log('Has hardcoded Foursquare key:', f.indexOf('3VHR5VCJBHGFJXGRBMVJKANAGJGUD1EXUELX3R0H2PGJCMG4') !== -1);
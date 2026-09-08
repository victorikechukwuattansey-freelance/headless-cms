'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDomain,
  normalizePhone,
  normalizeEmail,
  normalizeName,
  normalizeIdentityToken,
} = require('../src/lib/normalize');

test('domain: strips scheme, www, path, query, fragment', () => {
  assert.equal(normalizeDomain('https://www.Example.com/path?x=1#f'), 'example.com');
  assert.equal(normalizeDomain('http://lonestar.example.com'), 'lonestar.example.com');
  assert.equal(normalizeDomain('lonestar.example.com/'), 'lonestar.example.com');
  assert.equal(normalizeDomain(''), '');
});

test('phone: keeps 10 digits, drops US country code 1', () => {
  assert.equal(normalizePhone('+1 (512) 555-0187'), '5125550187');
  assert.equal(normalizePhone('5125550143'), '5125550143');
  assert.equal(normalizePhone('15125550187'), '5125550187');
  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone('12'), '');
});

test('email: lowercases and trims', () => {
  assert.equal(normalizeEmail('  JOHN.CARTER@EXAMPLE.COM  '), 'john.carter@example.com');
  assert.equal(normalizeEmail(''), '');
});

test('name: collapses whitespace and non-alpha, lowercases', () => {
  assert.equal(normalizeName('  Lone  Star  !!  '), 'lone star');
  assert.equal(normalizeName(''), '');
});

test('identity token: joins non-empty parts with pipe', () => {
  assert.equal(normalizeIdentityToken(['State', '', 'TX']), 'state|tx');
});

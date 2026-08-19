import { test } from 'node:test';
import assert from 'node:assert/strict';
import { via } from '../src/index.js';

test('via client metadata is defined', () => {
  assert.equal(via.name, 'via');
  assert.equal(via.description, 'Sales assistant mobile client');
});
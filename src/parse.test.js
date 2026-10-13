import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrip } from './parse.js';

test('parses folder names', () => {
  assert.deepEqual(parseTrip('2024-05-new-york'), { slug: '2024-05-new-york', year: '2024', sortKey: '2024-05', location: 'New York' });
  assert.equal(parseTrip('2023-kyoto').location, 'Kyoto');
  assert.equal(parseTrip('2023-kyoto').sortKey, '2023-00');
  assert.equal(parseTrip('kyoto'), null);
});

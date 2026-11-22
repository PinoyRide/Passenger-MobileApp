import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../ridersNearbyText.js';
const { ridersNearbyText } = mod;

test('the reach comes from the answer', () => {
  assert.equal(
    ridersNearbyText({ count: 3, riders: [], reachKm: 4 }),
    '3 riders within 4 km',
  );
  assert.equal(
    ridersNearbyText({ count: 1, riders: [], reachKm: 4 }),
    '1 rider within 4 km',
  );
  assert.equal(
    ridersNearbyText({ count: 0, riders: [], reachKm: 2.5 }),
    'No riders within 2.5 km',
  );
});

test('an answer without a reach says nearby', () => {
  assert.equal(ridersNearbyText({ count: 2, riders: [] }), '2 riders nearby');
  assert.equal(
    ridersNearbyText({ count: 0, riders: [], reachKm: null }),
    'No riders nearby',
  );
});

test('the other states', () => {
  assert.equal(ridersNearbyText(null), 'Riders nearby');
  assert.equal(ridersNearbyText({ looking: true }), 'Looking for riders…');
  assert.equal(ridersNearbyText({ failed: true }), 'Couldn’t load riders');
  assert.equal(
    ridersNearbyText({ unknown: true }),
    'Your location is not known yet',
  );
});

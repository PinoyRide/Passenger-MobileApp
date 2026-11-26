import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../riderAway.js';

const { riderAwayText } = mod;
const now = 1_000_000;

test('the banner says how many minutes away the rider is', () => {
  assert.equal(
    riderAwayText({ state: 'en_route', eta_minutes: 3 }, now - 1000, now),
    '3 min away',
  );
  assert.equal(
    riderAwayText({ state: 'en_route', minutes: '2.6' }, now, now),
    '3 min away',
  );
  assert.equal(
    riderAwayText({ state: 'en_route', eta_minutes: 0.4 }, now, now),
    'Arriving now',
  );
  assert.equal(
    riderAwayText({ state: 'arriving_now' }, now, now),
    'Arriving now',
  );
});

test('once the rider is there: at the pick-up, however old the ETA', () => {
  assert.equal(riderAwayText({ state: 'arrived' }, 0, now), 'At the pick-up');
});

test('nothing when it is not known', () => {
  assert.equal(riderAwayText(null, now, now), '');
  assert.equal(riderAwayText({ state: 'not_started' }, now, now), '');
  assert.equal(riderAwayText({ state: 'en_route' }, now, now), '');
  // over 90 s old
  assert.equal(
    riderAwayText({ state: 'en_route', eta_minutes: 3 }, now - 91000, now),
    '',
  );
});

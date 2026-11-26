import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../arrivalText.js';

const { arrivalText } = mod;

const noon = new Date(2026, 10, 23, 12, 0, 0, 0).getTime();

test('on the way: the arrival clock, then how long', () => {
  assert.equal(arrivalText('en_route', 15, noon), 'Arriving at 12:15 PM · 15 min');
  assert.equal(arrivalText('en_route', '7', noon), 'Arriving at 12:07 PM · 7 min');
  assert.equal(arrivalText('en_route', 60, noon), 'Arriving at 1:00 PM · 1 hr');
  assert.equal(arrivalText('en_route', 75, noon), 'Arriving at 1:15 PM · 1 hr 15 min');
  const night = new Date(2026, 10, 23, 23, 50, 0, 0);
  assert.equal(arrivalText('en_route', 20, night), 'Arriving at 12:10 AM · 20 min');
});

test('close by: arriving now', () => {
  assert.equal(arrivalText('arriving_now', 0, noon), 'Arriving now');
  assert.equal(arrivalText('en_route', 0.4, noon), 'Arriving now');
});

test('nothing known: nothing said', () => {
  assert.equal(arrivalText('en_route', null, noon), '');
  assert.equal(arrivalText('en_route', '', noon), '');
  assert.equal(arrivalText('not_started', 12, noon), '');
  assert.equal(arrivalText(undefined, undefined, noon), '');
});

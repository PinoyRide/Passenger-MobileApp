import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../navMath.js';
const { distanceMeters, bearingDegrees, pointAhead, nextHeading, navZoom } = mod;

const megamall = { latitude: 14.585, longitude: 121.0567 };
const north = { latitude: 14.586, longitude: 121.0567 };
const east = { latitude: 14.585, longitude: 121.0577 };

test('distance between two nearby points', () => {
  assert.ok(Math.abs(distanceMeters(megamall, north) - 111) < 2);
});

test('bearing: north is 0, east is 90', () => {
  assert.ok(bearingDegrees(megamall, north) < 0.5);
  assert.ok(Math.abs(bearingDegrees(megamall, east) - 90) < 0.5);
});

test('pointAhead goes the given distance along the bearing', () => {
  const p = pointAhead(megamall, 90, 70);
  assert.ok(Math.abs(distanceMeters(megamall, p) - 70) < 0.5);
  assert.ok(Math.abs(bearingDegrees(megamall, p) - 90) < 0.5);
});

test('heading keeps the last value while stopped (no GPS jitter spin)', () => {
  const jitter = { latitude: 14.58501, longitude: 121.0567 };
  assert.equal(nextHeading({ previous: 37, from: megamall, to: jitter }), 37);
});

test('heading follows movement, or GPS heading when moving fast', () => {
  assert.ok(Math.abs(nextHeading({ previous: 0, from: megamall, to: east }) - 90) < 0.5);
  assert.equal(nextHeading({ previous: 0, from: megamall, to: east, gpsHeading: 181, speed: 8 }), 181);
});

test('navigation zoom widens with speed', () => {
  assert.ok(navZoom(2) > navZoom(12));
  assert.ok(navZoom(12) > navZoom(25));
});

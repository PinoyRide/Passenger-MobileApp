import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../passengerCamera.js';
const { framePoints, isUserControlling, MIN_SPAN_DEG, USER_PAUSE_MS } = mod;

const rider = { latitude: 14.62, longitude: 121.03 };
const pickup = { latitude: 14.6, longitude: 121.01 };

test('far apart: frames exactly rider and pickup', () => {
  const pts = framePoints(rider, pickup);
  assert.deepEqual(pts, [rider, pickup]);
});

test('close together: pads to a minimum span so it is not too zoomed in', () => {
  const near = { latitude: 14.6001, longitude: 121.0101 };
  const pts = framePoints(near, pickup);
  const lats = pts.map(p => p.latitude);
  const lngs = pts.map(p => p.longitude);
  assert.ok(Math.max(...lats) - Math.min(...lats) >= MIN_SPAN_DEG - 1e-9);
  assert.ok(Math.max(...lngs) - Math.min(...lngs) >= MIN_SPAN_DEG - 1e-9);
  // both real points are still included
  assert.ok(pts.includes(near) && pts.includes(pickup));
});

test('missing a point: nothing to frame', () => {
  assert.equal(framePoints(null, pickup), null);
  assert.equal(framePoints(rider, null), null);
});

test('auto-framing pauses while the user is touching the map', () => {
  assert.equal(isUserControlling(0, 1000), false);
  assert.equal(isUserControlling(1000, 1000 + USER_PAUSE_MS - 1), true);
  assert.equal(isUserControlling(1000, 1000 + USER_PAUSE_MS), false);
});

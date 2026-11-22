import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../radarPing.js';
const { SWEEP_MS, ringsAt, boundsAround } = mod;

test('a ring starts at the pickup, fully drawn, and fades out at the edge', () => {
  const [first] = ringsAt(0);
  assert.equal(first.share, 0);
  assert.equal(first.alpha, 1);
  const [late] = ringsAt(SWEEP_MS * 0.999);
  assert.ok(late.share > 0.99 && late.alpha < 0.01, JSON.stringify(late));
  // halfway through its time it is three quarters of the way out
  assert.deepEqual(ringsAt(SWEEP_MS / 2)[0], { share: 0.75, alpha: 0.5 });
});

test('two rings, half a sweep apart, again and again', () => {
  const [a, b] = ringsAt(0);
  assert.equal(a.share, 0);
  assert.equal(b.share, 0.75);
  assert.deepEqual(ringsAt(SWEEP_MS * 3), ringsAt(0));
});

test('the framing holds the whole circle', () => {
  const [north, south] = boundsAround(14.5513, 121.0132, 1500);
  // 1.5 km is about 0.0135 degrees of latitude
  assert.ok(Math.abs(north.latitude - 14.5513 - 0.01347) < 0.0001);
  assert.ok(Math.abs(14.5513 - south.latitude - 0.01347) < 0.0001);
  // and a little more of longitude, this far from the equator
  assert.ok(south.longitude - 121.0132 > 0.0135);
  assert.ok(121.0132 - north.longitude > 0.0135);
});

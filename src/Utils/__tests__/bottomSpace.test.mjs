import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../bottomSpace.js';
const { bottomSpace } = mod;

test('three-button navigation bar: the content ends 16 above it', () => {
  assert.equal(bottomSpace(48, 20), 64);
  assert.equal(bottomSpace(48, 30), 64);
});

test('a screen that already leaves more room keeps it', () => {
  assert.equal(bottomSpace(24, 46.5), 46.5);
  assert.equal(bottomSpace(24, 50), 50);
});

test('gesture navigation: a thin bar still gets its clearance', () => {
  assert.equal(bottomSpace(24, 20), 40);
});

test('no bar to clear (the app does not draw behind it): the screen spacing as before', () => {
  assert.equal(bottomSpace(0, 20), 20);
  assert.equal(bottomSpace(undefined, 34), 34);
  assert.equal(bottomSpace(NaN, 38), 38);
});

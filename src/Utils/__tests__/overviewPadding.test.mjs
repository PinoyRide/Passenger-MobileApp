import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../overviewPadding.js';
const { overviewPadding } = mod;

const windowOf = (h, p) => h - p.top - p.bottom;

test('plenty of map: clear of the header buttons and of the sheet', () => {
  const p = overviewPadding(914, 340);
  assert.deepEqual(p, { top: 200, right: 60, bottom: 390, left: 60 });
});

test('a tall sheet: the top padding gives way, the rider stays above the sheet', () => {
  const p = overviewPadding(914, 600);
  assert.equal(p.bottom, 650);
  assert.ok(p.top < 200 && p.top >= 145);
  assert.ok(windowOf(914, p) >= 110);
});

test('almost no map left: there is still a window to fit into', () => {
  const p = overviewPadding(914, 800);
  assert.equal(p.top, 145);
  assert.ok(windowOf(914, p) >= 110);
  assert.ok(p.bottom >= 0);
});

test('before the map is measured it uses the usual paddings', () => {
  assert.deepEqual(overviewPadding(0, 300), { top: 200, right: 60, bottom: 350, left: 60 });
  assert.deepEqual(overviewPadding(undefined, undefined), { top: 200, right: 60, bottom: 50, left: 60 });
});

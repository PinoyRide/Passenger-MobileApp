import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { shouldResumeWatch } = require('../locationResume.js');

const failedNowOn = {
  wanted: true,
  failed: true,
  permission: 'granted',
  servicesEnabled: true,
};

test('ONL-14: a watch that failed while Location was off starts again once it is on', () => {
  assert.equal(shouldResumeWatch(failedNowOn), true);
});

test("Location still off: no new start, so Google's box does not come back", () => {
  assert.equal(
    shouldResumeWatch({ ...failedNowOn, servicesEnabled: false }),
    false,
  );
});

test('the phone could not say whether Location is on: try once more', () => {
  assert.equal(
    shouldResumeWatch({ ...failedNowOn, servicesEnabled: undefined }),
    true,
  );
});

test('a working watch is left alone (no extra work on every return)', () => {
  assert.equal(shouldResumeWatch({ ...failedNowOn, failed: false }), false);
});

test('a watch the screen stopped is not started again', () => {
  assert.equal(shouldResumeWatch({ ...failedNowOn, wanted: false }), false);
});

test('permission not granted: never resumes (and never asks again here)', () => {
  for (const permission of ['denied', 'blocked', 'unavailable', null]) {
    assert.equal(shouldResumeWatch({ ...failedNowOn, permission }), false);
  }
});

test('the watch hook resumes on return to the app and when the shade closes', () => {
  const src = readFileSync(
    new URL('../../Hooks/useLocation.js', import.meta.url),
    'utf8',
  );
  assert.match(src, /shouldResumeWatch/);
  assert.match(src, /AppState\.addEventListener\(\s*'change'/);
  assert.match(src, /AppState\.addEventListener\(\s*'focus'/);
  // checks, never asks: a resume must not pop the permission dialog
  assert.match(src, /checkLocationPermission\(\)/);
  assert.match(src, /hasServicesEnabledAsync\(\)/);
});

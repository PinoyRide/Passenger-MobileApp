import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../searchReach.js';
const { DEFAULT_STEPS, stepsOf, searchEndsMs, reachKmAt, nextWideningIn } = mod;

const MIN = 60000;

test("the owner's widening: 1.5 km for 5 min, 3 km for 10, 5 km for 10", () => {
  const steps = stepsOf(null);
  assert.deepEqual(steps, DEFAULT_STEPS);
  assert.equal(reachKmAt(steps, 0), 1.5);
  assert.equal(reachKmAt(steps, 5 * MIN - 1), 1.5);
  assert.equal(reachKmAt(steps, 5 * MIN), 3);
  assert.equal(reachKmAt(steps, 15 * MIN - 1), 3);
  assert.equal(reachKmAt(steps, 15 * MIN), 5);
  assert.equal(reachKmAt(steps, 60 * MIN), 5);
  // "No riders available" at minute 25
  assert.equal(searchEndsMs(null), 25 * MIN);
});

test('the next widening, until there is none', () => {
  const steps = stepsOf(null);
  assert.equal(nextWideningIn(steps, 0), 5 * MIN);
  assert.equal(nextWideningIn(steps, 6 * MIN), 9 * MIN);
  assert.equal(nextWideningIn(steps, 15 * MIN), null);
});

test("the booking's own steps and end win, as the backend sends them", () => {
  const booking = {
    search_steps: [
      { after_minutes: 10, km: 6 },
      { after_minutes: 0, km: 2 },
      { after_minutes: 'x', km: 9 },
    ],
    search_ends_after_minutes: 12,
  };
  assert.deepEqual(stepsOf(booking), [
    { afterMinutes: 0, km: 2 },
    { afterMinutes: 10, km: 6 },
  ]);
  assert.equal(searchEndsMs(booking), 12 * MIN);
  // steps that do not start at minute 0 are not used
  assert.deepEqual(
    stepsOf({ search_steps: [{ after_minutes: 5, km: 3 }] }),
    DEFAULT_STEPS,
  );
});

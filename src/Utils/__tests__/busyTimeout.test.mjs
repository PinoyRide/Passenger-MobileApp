import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../busyTimeout.js';

// A busy box that gets no answer must not trap anyone: after 15 s it goes to
// its error state (A-184 piece b, design/A-184/SPEC.md section 4). The same
// file in both apps (sharedUi.test.mjs).
const { BUSY_TIMEOUT_MS, BUSY_TIMEOUT_TEXT, busyView, startBusyTimeout } = mod;

// a clock moved by hand
const fakeClock = () => {
  let now = 0;
  let next = 1;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => {
      const id = next++;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    pending: () => timers.size,
  };
};

test('15 seconds', () => {
  assert.equal(BUSY_TIMEOUT_MS, 15 * 1000);
});

test('busy and not yet run out: the spinner, and the caller error line if any', () => {
  assert.deepEqual(busyView({ busy: true }), {
    busy: true,
    errorText: '',
    timedOut: false,
  });
  assert.deepEqual(busyView({}), {
    busy: false,
    errorText: '',
    timedOut: false,
  });
  assert.deepEqual(busyView({ busy: false, errorText: 'Try again.' }), {
    busy: false,
    errorText: 'Try again.',
    timedOut: false,
  });
});

test('run out: the spinner goes and the error line says why', () => {
  assert.deepEqual(busyView({ busy: true, timedOut: true }), {
    busy: false,
    errorText: BUSY_TIMEOUT_TEXT,
    timedOut: true,
  });
  // the caller's own words win
  assert.equal(
    busyView({
      busy: true,
      timedOut: true,
      errorText: "We couldn't check the fee.",
    }).errorText,
    "We couldn't check the fee.",
  );
  // once the caller has answered (busy off), the time-out no longer counts
  assert.deepEqual(busyView({ busy: false, timedOut: true }), {
    busy: false,
    errorText: '',
    timedOut: false,
  });
});

test('the countdown fires once, at 15 s, and not when stopped first', () => {
  const clock = fakeClock();
  let fired = 0;
  startBusyTimeout(() => (fired += 1), BUSY_TIMEOUT_MS, clock);
  clock.advance(BUSY_TIMEOUT_MS - 1);
  assert.equal(fired, 0);
  clock.advance(1);
  assert.equal(fired, 1);
  clock.advance(BUSY_TIMEOUT_MS);
  assert.equal(fired, 1);

  const stopped = fakeClock();
  let late = 0;
  const stop = startBusyTimeout(() => (late += 1), BUSY_TIMEOUT_MS, stopped);
  stopped.advance(5000);
  stop();
  stop();
  stopped.advance(BUSY_TIMEOUT_MS);
  assert.equal(late, 0);
  assert.equal(stopped.pending(), 0);
});

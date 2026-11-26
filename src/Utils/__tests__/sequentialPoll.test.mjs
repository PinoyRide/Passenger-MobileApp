import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../sequentialPoll.js';
const { startSequentialPoll, MIN_GAP_MS, MAX_WAIT_MS } = mod;

// A clock the test moves by hand: each timer fires in order, and the promises
// it starts settle before the next one fires.
const fakeClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const settle = async () => {
    for (let i = 0; i < 20; i += 1) {
      await new Promise(resolve => setImmediate(resolve));
    }
  };
  return {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: id => {
      timers.delete(id);
    },
    async runUntil(until) {
      await settle();
      for (;;) {
        let due = null;
        for (const [id, timer] of timers) {
          if (timer.at <= until && (!due || timer.at < due.timer.at)) {
            due = { id, timer };
          }
        }
        if (!due) {
          break;
        }
        timers.delete(due.id);
        now = due.timer.at;
        due.timer.fn();
        await settle();
      }
      now = until;
    },
  };
};

// A request on a line that takes `ms` to answer, noting when each one ran.
const slowRequest = (clock, ms) => {
  const calls = [];
  let inFlight = 0;
  let mostAtOnce = 0;
  const run = () =>
    new Promise(resolve => {
      const call = { start: clock.now(), end: null };
      calls.push(call);
      inFlight += 1;
      mostAtOnce = Math.max(mostAtOnce, inFlight);
      clock.setTimeout(() => {
        call.end = clock.now();
        inFlight -= 1;
        resolve();
      }, ms);
    });
  return { run, calls, mostAtOnce: () => mostAtOnce };
};

test('on a fast line it asks once an interval', async () => {
  const clock = fakeClock();
  const starts = [];
  const stop = startSequentialPoll(() => starts.push(clock.now()), 1000, {
    clock,
  });
  await clock.runUntil(5000);
  stop();
  assert.deepEqual(starts, [1000, 2000, 3000, 4000, 5000]);
});

test('on a line slower than the interval, one request at a time', async () => {
  const clock = fakeClock();
  const line = slowRequest(clock, 3000);
  const stop = startSequentialPoll(line.run, 1000, { clock });
  await clock.runUntil(20000);
  stop();
  assert.equal(line.mostAtOnce(), 1);
  // each request starts only after the one before has its answer, so every
  // answer is the newest one and none is thrown away
  for (let i = 1; i < line.calls.length; i += 1) {
    assert.ok(line.calls[i].start >= line.calls[i - 1].end);
  }
  assert.deepEqual(
    line.calls.map(call => call.start),
    [1000, 4200, 7400, 10600, 13800, 17000],
  );
  assert.equal(MIN_GAP_MS, 200);
});

test('a request that never answers does not stop the poll', async () => {
  const clock = fakeClock();
  const starts = [];
  const stop = startSequentialPoll(
    () => {
      starts.push(clock.now());
      return new Promise(() => {});
    },
    1000,
    { clock },
  );
  await clock.runUntil(45000);
  stop();
  assert.equal(MAX_WAIT_MS, 20000);
  assert.deepEqual(starts, [1000, 21200, 41400]);
});

test('a failing request is asked again next interval', async () => {
  const clock = fakeClock();
  const starts = [];
  const stop = startSequentialPoll(
    () => {
      starts.push(clock.now());
      throw new Error('offline');
    },
    2000,
    { clock },
  );
  await clock.runUntil(6000);
  stop();
  assert.deepEqual(starts, [2000, 4000, 6000]);
});

test('stopped, it asks nothing more, even with a request on its way', async () => {
  const clock = fakeClock();
  const line = slowRequest(clock, 1500);
  const stop = startSequentialPoll(line.run, 1000, { clock });
  await clock.runUntil(1200); // the first request is on its way
  stop();
  await clock.runUntil(10000);
  assert.equal(line.calls.length, 1);
  assert.equal(line.calls[0].end, 2500);
});

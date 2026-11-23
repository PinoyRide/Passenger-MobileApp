// A poll that asks one question at a time: the next call starts an interval
// after the last one started, or right after it ends when it took longer. A
// timer that fired regardless piled requests up on a slow line and sent them
// all at once when it came back (thousands, after a phone woke), and as only
// the newest request's answer is used (Services/Api.js), a line slower than
// the interval had every answer thrown away. A call that never settles is
// given up on after `maxWaitMs`, so the poll never stops by itself.
const MIN_GAP_MS = 200;
const MAX_WAIT_MS = 20000; // past Api.js's own 15 s timeout

const realClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

const startSequentialPoll = (
  run,
  intervalMs,
  { maxWaitMs = MAX_WAIT_MS, clock = realClock } = {},
) => {
  let stopped = false;
  let timer;
  const tick = async () => {
    const startedAt = clock.now();
    let giveUp;
    try {
      await Promise.race([
        Promise.resolve().then(run),
        new Promise(resolve => {
          giveUp = clock.setTimeout(resolve, maxWaitMs);
        }),
      ]);
    } catch (e) {
      // the next call asks again
    }
    clock.clearTimeout(giveUp);
    if (!stopped) {
      const took = clock.now() - startedAt;
      timer = clock.setTimeout(tick, Math.max(MIN_GAP_MS, intervalMs - took));
    }
  };
  timer = clock.setTimeout(tick, intervalMs);
  return () => {
    stopped = true;
    clock.clearTimeout(timer);
  };
};

module.exports = { startSequentialPoll, MIN_GAP_MS, MAX_WAIT_MS };

// A box that waits on work (an AlertBox drawn `busy`: a fee being checked, a
// reason being sent) must not trap anyone: with no answer after 15 seconds it
// goes to its error state (A-184, design/A-184/SPEC.md section 4: "A check
// with no answer after 15 s ends in its error state, so nobody is trapped").
// Pure (no RN imports) so it runs under `node --test`. The same file in both
// apps (sharedUi.test.mjs).
//
//   busyView          what the box shows: its caller's busy and errorText, or,
//                     once the busy spell has run out, the error state
//   startBusyTimeout  the 15-second countdown of one busy spell

const BUSY_TIMEOUT_MS = 15 * 1000;

// the error line of a box whose caller gave none for the time-out
const BUSY_TIMEOUT_TEXT = 'No answer yet. Check your signal and try again.';

// `timedOut`: this busy spell ran past BUSY_TIMEOUT_MS. Then the spinner goes,
// the filled button can be tapped again, and the error line says why (the
// caller's errorText, if it gave one, or BUSY_TIMEOUT_TEXT). Not busy, the
// time-out no longer counts: the caller has answered.
const busyView = ({ busy, errorText, timedOut } = {}) => {
  if (busy && timedOut) {
    return {
      busy: false,
      errorText: errorText || BUSY_TIMEOUT_TEXT,
      timedOut: true,
    };
  }
  return { busy: Boolean(busy), errorText: errorText || '', timedOut: false };
};

const realClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

// Runs `onTimeout` once, `ms` after the start, unless the returned stop runs
// first (the busy spell ended, or the box closed). Wall-clock time: a check
// hanging while the app was minimized has still had no answer.
const startBusyTimeout = (
  onTimeout,
  ms = BUSY_TIMEOUT_MS,
  clock = realClock,
) => {
  let timer = clock.setTimeout(() => {
    timer = null;
    onTimeout();
  }, ms);
  return () => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
  };
};

module.exports = {
  BUSY_TIMEOUT_MS,
  BUSY_TIMEOUT_TEXT,
  busyView,
  startBusyTimeout,
};

// A box that waits on work (an AlertBox drawn `busy`: a fee being checked, a
// reason being sent) must not trap anyone: with no answer after 15 seconds it
// goes to its error state (A-184, design/A-184/SPEC.md section 4: "A check
// with no answer after 15 s ends in its error state, so nobody is trapped").
// Pure (no RN imports) so it runs under `node --test`. The same file in both
// apps (sharedUi.test.mjs).
//
//   busyView          what the box shows: the spinner while the caller is
//                     busy, the error line once the spell has run out
//   startBusyTimeout  the 15-second countdown of one busy spell
//
// The time-out never lets the filled button be tapped again: it stays held
// while the caller says busy, so its answer cannot run twice with the first
// still on its way (a second cancel, a second "Send"). The caller ends the
// spell by clearing busy, and a new spell, busy turning on again, starts a
// new countdown (Utils/alertShape.js boxState holds the button).

const BUSY_TIMEOUT_MS = 15 * 1000;

// the error line of a box whose caller gave none for the time-out
const BUSY_TIMEOUT_TEXT = 'No answer yet. Check your signal and try again.';

// `timedOut`: the box's last busy spell ran past BUSY_TIMEOUT_MS. The AlertBox
// keeps it until busy turns on again, a button is tapped or the box closes,
// whatever the caller does with busy meanwhile. Then the spinner gives way to
// the error line: the caller's errorText, if it gives one, or
// BUSY_TIMEOUT_TEXT.
const busyView = ({ busy, errorText, timedOut } = {}) => ({
  spinner: Boolean(busy) && !timedOut,
  errorText: errorText || (timedOut ? BUSY_TIMEOUT_TEXT : ''),
});

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

// A countdown that runs only while the app is on screen (Hooks/useAutoClose).
// A box can be raised while the app is minimized: a booking poll or a push
// answered in the background. React Native's timers wait in the background
// and fire at once when the app is back, so such a box used to close the
// moment the person opened the app (QA NTF-10, 2026-11-25: "Booking update"
// with the new reference was never seen). Away, the time stops; back, it
// starts again in full. `fn` runs once. The same file in both apps
// (sharedUi.test.mjs).

const realClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
};

// 'unknown' (iOS, before the first change) counts as on screen; 'inactive'
// (iOS: the app switcher or the notification centre over the app) does not.
const onScreen = state => state !== 'background' && state !== 'inactive';

const startOnScreenTimer = (fn, ms, appState, clock = realClock) => {
  let timer = null;
  let done = false;
  const stop = () => {
    if (timer !== null) {
      clock.clearTimeout(timer);
      timer = null;
    }
  };
  const start = () => {
    if (done || timer !== null) {
      return;
    }
    timer = clock.setTimeout(() => {
      timer = null;
      done = true;
      fn();
    }, ms);
  };
  if (onScreen(appState.currentState)) {
    start();
  }
  const sub = appState.addEventListener('change', state =>
    onScreen(state) ? start() : stop(),
  );
  return () => {
    done = true;
    stop();
    sub?.remove?.();
  };
};

module.exports = { startOnScreenTimer, onScreen };

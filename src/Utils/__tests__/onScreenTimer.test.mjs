import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../onScreenTimer.js';
const { startOnScreenTimer, onScreen } = mod;

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

// A clock moved by hand, and an AppState whose state the test sets.
const fakeClock = () => {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout: (fn, ms) => {
      const id = nextId;
      nextId += 1;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    advance: ms => {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.fn();
        }
      }
    },
    pending: () => timers.size,
  };
};
const fakeAppState = initial => {
  const listeners = new Set();
  const state = {
    currentState: initial,
    addEventListener: (type, fn) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
    set: next => {
      state.currentState = next;
      listeners.forEach(fn => fn(next));
    },
    listeners: () => listeners.size,
  };
  return state;
};

test('on screen: the time runs out once', () => {
  const clock = fakeClock();
  const appState = fakeAppState('active');
  let closed = 0;
  startOnScreenTimer(() => (closed += 1), 10000, appState, clock);
  clock.advance(9999);
  assert.equal(closed, 0);
  clock.advance(1);
  assert.equal(closed, 1);
  appState.set('background');
  appState.set('active');
  clock.advance(20000);
  assert.equal(closed, 1);
});

// QA NTF-10 (2026-11-25): the rider cancelled while the app was minimized;
// the app followed the new booking and raised "Booking update" in the
// background. Its 10 s were over by the time the passenger tapped the push,
// so the box closed at once and was never seen.
test('raised in the background: the time starts when the app is back', () => {
  const clock = fakeClock();
  const appState = fakeAppState('background');
  let closed = 0;
  startOnScreenTimer(() => (closed += 1), 10000, appState, clock);
  clock.advance(60000);
  assert.equal(closed, 0);
  appState.set('active');
  clock.advance(9999);
  assert.equal(closed, 0);
  clock.advance(1);
  assert.equal(closed, 1);
});

test('the time stops while the app is away and starts again in full', () => {
  const clock = fakeClock();
  const appState = fakeAppState('active');
  let closed = 0;
  startOnScreenTimer(() => (closed += 1), 10000, appState, clock);
  clock.advance(8000);
  appState.set('background');
  clock.advance(30000);
  assert.equal(closed, 0);
  appState.set('active');
  clock.advance(9999);
  assert.equal(closed, 0);
  clock.advance(1);
  assert.equal(closed, 1);
});

test('stopping it clears the timer and the listener', () => {
  const clock = fakeClock();
  const appState = fakeAppState('active');
  let closed = 0;
  const stop = startOnScreenTimer(() => (closed += 1), 10000, appState, clock);
  stop();
  assert.equal(clock.pending(), 0);
  assert.equal(appState.listeners(), 0);
  appState.set('active');
  clock.advance(20000);
  assert.equal(closed, 0);
});

test('what counts as on screen', () => {
  assert.equal(onScreen('active'), true);
  // iOS reports "unknown" before the first change
  assert.equal(onScreen('unknown'), true);
  assert.equal(onScreen(null), true);
  assert.equal(onScreen('background'), false);
  // iOS: the app switcher or the notification centre over the app
  assert.equal(onScreen('inactive'), false);
});

test('every box that closes by itself counts only time on screen', () => {
  const hook = read('src/Hooks/useAutoClose.js');
  assert.match(hook, /startOnScreenTimer\(/);
  assert.match(hook, /AppState/);
  assert.doesNotMatch(hook, /setTimeout\(/);
});

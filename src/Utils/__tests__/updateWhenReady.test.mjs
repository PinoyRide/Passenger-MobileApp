import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../updateWhenReady.js';
const { CHECK_EVERY_MS, busyReason, shouldRestart, shouldCheck, afterRestart, mayRestartInto } = mod;

test('a booking under way holds the restart: waiting, accepted, started', () => {
  for (const status of [0, 1, 2]) {
    assert.equal(busyReason({ bookingId: 7, bookingStatus: status }), 'trip');
  }
  // finished, cancelled or scheduled for later: nothing under way
  for (const status of [3, 4, 5]) {
    assert.equal(busyReason({ bookingId: 7, bookingStatus: status }), null);
  }
  assert.equal(busyReason({ bookingId: null, bookingStatus: 1 }), null);
});

test('a booking request on screen and a payment hold it too', () => {
  assert.equal(busyReason({ requestOnScreen: true }), 'request');
  assert.equal(busyReason({ screen: 'QRPHScreen' }), 'payment');
  assert.equal(busyReason({ screen: 'CashOutScreen' }), 'payment');
  assert.equal(busyReason({ screen: 'PaymentOptionScreen' }), 'payment');
  assert.equal(busyReason({ screen: 'HomeScreen' }), null);
});

test('so does something half done: a code already texted, a form, a photo check', () => {
  for (const screen of ['OTPScreen', 'DeleteAccountScreen', 'RegisterFormScreen', 'RiderApplicationScreen', 'LivenessSelfieScreen', 'InputLocation']) {
    assert.equal(busyReason({ screen }), 'unfinished', screen);
  }
  for (const screen of ['WalletScreen', 'SettingsScreen', 'BookingHistoryScreen', undefined]) {
    assert.equal(busyReason({ screen }), null, String(screen));
  }
});

test('it restarts right away once downloaded, on screen and not busy', () => {
  assert.equal(shouldRestart({ ready: true, active: true, busy: null }), true);
  assert.equal(shouldRestart({ ready: true, active: false, busy: null }), false, 'not from the background');
  assert.equal(shouldRestart({ ready: true, active: true, busy: 'trip' }), false);
  assert.equal(shouldRestart({ ready: false, active: true, busy: null }), false);
});

test('the server is asked every two minutes on screen, or when the app comes back', () => {
  const now = 1000000;
  const on = { active: true, ready: false, checking: false };
  assert.equal(shouldCheck({ ...on, lastCheckedAt: now - CHECK_EVERY_MS, now }), true);
  assert.equal(shouldCheck({ ...on, lastCheckedAt: now - 1000, now }), false);
  assert.equal(shouldCheck({ ...on, lastCheckedAt: now - 1000, now, force: true }), true);
  assert.equal(shouldCheck({ ...on, ready: true, lastCheckedAt: 0, now, force: true }), false, 'already downloaded');
  assert.equal(shouldCheck({ ...on, checking: true, lastCheckedAt: 0, now, force: true }), false, 'one at a time');
  assert.equal(shouldCheck({ ...on, active: false, lastCheckedAt: 0, now, force: true }), false, 'not in the background');
});

test('an update the app restarted into but that did not start is never restarted into again', () => {
  // started: nothing to remember
  assert.deepEqual(afterRestart({ pending: 'u2', running: 'u2', refused: [] }), { refused: [], pending: null });
  assert.deepEqual(afterRestart({ pending: 'AB-12', running: 'ab-12', refused: [] }), { refused: [], pending: null });
  // fell back to the one before: refused from now on
  assert.deepEqual(afterRestart({ pending: 'u2', running: 'u1', refused: [] }), { refused: ['u2'], pending: null });
  assert.deepEqual(afterRestart({ pending: 'u2', running: 'u1', refused: ['u2'] }), { refused: ['u2'], pending: null });
  assert.deepEqual(afterRestart({ pending: null, running: 'u1', refused: ['u0'] }), { refused: ['u0'], pending: null });
  assert.equal(mayRestartInto('u2', ['u2']), false);
  assert.equal(mayRestartInto('U2', ['u2']), false);
  assert.equal(mayRestartInto('u3', ['u2']), true);
  assert.equal(mayRestartInto(undefined, []), false);
});

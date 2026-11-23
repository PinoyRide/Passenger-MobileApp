import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import wait from '../paymentWait.js';

const { CHECK_EVERY_MS, paymentOutcome } = wait;

test('only success, failed and expired end the wait', () => {
  assert.equal(paymentOutcome('success'), 'success');
  assert.equal(paymentOutcome('failed'), 'failed');
  assert.equal(paymentOutcome('expired'), 'expired');
});

// 2026-11-23, PayCools UAT: the screen stopped asking on the first `pending`
// and the rider never saw the ₱50 that had been paid.
test('pending, and anything not known yet, keeps the screen asking', () => {
  for (const status of [
    'pending',
    'PENDING',
    'processing',
    '',
    null,
    undefined,
  ]) {
    assert.equal(paymentOutcome(status), 'waiting', String(status));
  }
});

test('a payment is noticed within seconds', () => {
  assert.ok(CHECK_EVERY_MS >= 2000 && CHECK_EVERY_MS <= 10000);
});

// The Rider's QRPH.js and the Passenger's QRPHScreen.js both wait by it.
test('the QR payment screen waits by this rule, and asks again', () => {
  const dir = new URL('../../Screens/QRPH/', import.meta.url);
  const screen = ['QRPH.js', 'QRPHScreen.js']
    .map(name => new URL(name, dir))
    .find(file => existsSync(file));
  assert.ok(screen, 'no QR payment screen in src/Screens/QRPH/');
  const source = readFileSync(screen, 'utf8');
  assert.match(source, /paymentOutcome\(/);
  assert.match(
    source,
    /setInterval\(\s*\(\) => checkNowRef\.current\(\),\s*CHECK_EVERY_MS,?\s*\)/,
  );
  assert.doesNotMatch(
    source,
    /CANCELLED/,
    'closing the page must not end the wait',
  );
});

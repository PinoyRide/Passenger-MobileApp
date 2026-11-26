import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import starting from '../startingPayment.js';

const { startingPayment } = starting;

test('the wallet when its balance covers the fare', () => {
  assert.equal(startingPayment({ balance: 275, fare: 120 }), 'wallet');
  assert.equal(startingPayment({ balance: '120.00', fare: 120 }), 'wallet');
  assert.equal(
    startingPayment({ balance: '275.00', fare: '119.50' }),
    'wallet',
  );
});

test('cash when the balance does not cover the fare', () => {
  assert.equal(startingPayment({ balance: 100, fare: 120 }), 'cash');
  assert.equal(startingPayment({ balance: '119.99', fare: 120 }), 'cash');
  assert.equal(startingPayment({ balance: 0, fare: 50 }), 'cash');
});

test('cash while the balance or the fare is not known', () => {
  for (const [balance, fare] of [
    [null, 120],
    [undefined, 120],
    ['', 120],
    ['n/a', 120],
    [275, null],
    [275, undefined],
    [275, 0],
  ]) {
    assert.equal(
      startingPayment({ balance, fare }),
      'cash',
      `${balance} / ${fare}`,
    );
  }
});

test('advance bookings are paid in cash, whatever the balance', () => {
  assert.equal(
    startingPayment({ balance: 5000, fare: 120, cashOnly: true }),
    'cash',
  );
});

// WALLET-EKYC-LOCK (A-325): until the ID check passes the server refuses a
// ride paid with the wallet, so a locked wallet starts every ride on cash.
test('cash while the wallet is locked, whatever the balance', () => {
  assert.equal(
    startingPayment({ balance: 5000, fare: 120, locked: true }),
    'cash',
  );
  assert.equal(
    startingPayment({ balance: '120.00', fare: 120, locked: true }),
    'cash',
  );
  // an answer without `locked` (an older API) keeps the rule by balance
  assert.equal(
    startingPayment({ balance: 5000, fare: 120, locked: undefined }),
    'wallet',
  );
});

// The booking sheet applies it, and keeps a method the passenger picked.
test('the booking sheet starts each trip by this rule', () => {
  const home = new URL(
    '../../Screens/HomeScreen/HomeScreen.js',
    import.meta.url,
  );
  assert.ok(existsSync(home));
  const source = readFileSync(home, 'utf8');
  assert.match(source, /startingPayment\(\{/);
  assert.match(source, /paymentChosenForRef\.current = fareKeyNow/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import lock from '../walletLock.js';
import ekyc from '../ekycWallet.js';
import starting from '../startingPayment.js';

const {
  LOCKED_REASON,
  LOCKED_MESSAGE,
  LOCKED_BODY,
  VERIFY_LABEL,
  walletLocked,
  isLockedRefusal,
  lockedAlert,
  verifyParams,
} = lock;
const {
  ACTIVATE_NOTE,
  LOCKED_NOTE,
  STAYS_OFF,
  ekycTile,
  ekycRefusal,
  canStartCheck,
} = ekyc;
const { startingPayment } = starting;

// WALLET-EKYC-LOCK (the owner, A-325): until the passenger's ID check has
// passed, the server refuses Cash in, the top-up number, Cash out and paying
// with the wallet (403, reason ekyc_required, never a sign-out). The wallet
// answer says so in `locked`; the app says "Verify your ID to use your
// wallet." with a Verify ID button, and starts rides on cash.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

test('the words and the reason are the contract', () => {
  assert.equal(LOCKED_REASON, 'ekyc_required');
  assert.equal(LOCKED_MESSAGE, 'Verify your ID to use your wallet.');
  assert.equal(VERIFY_LABEL, 'Verify ID');
  // the box's body (Q-UX-WALLET-EKYC-LOCK-WORDS item 1)
  assert.equal(
    LOCKED_BODY,
    'The check takes a few minutes. Until then your rides start on cash. Money already in your wallet stays there.',
  );
});

test('locked only when the wallet answer says locked: true', () => {
  assert.equal(walletLocked({ locked: true }), true);
  for (const wallet of [
    null,
    undefined,
    {},
    { locked: false },
    { locked: 'true' },
    { locked: 1 },
  ]) {
    // an API without `locked` (before the server change) is not locked
    assert.equal(walletLocked(wallet), false, JSON.stringify(wallet));
  }
});

test('a refusal is the lock by its reason, never by its words', () => {
  assert.equal(isLockedRefusal('ekyc_required'), true);
  assert.equal(isLockedRefusal({ reason: 'ekyc_required' }), true);
  for (const other of [
    null,
    undefined,
    '',
    'wallet_off',
    'sign_in_again',
    { reason: 'wallet_off' },
    { error: LOCKED_MESSAGE },
  ]) {
    assert.equal(isLockedRefusal(other), false, JSON.stringify(other));
  }
});

test('the box: the sentence, Cancel quiet, Verify ID starts the check', () => {
  let verified = 0;
  const [title, message, buttons] = lockedAlert(() => {
    verified += 1;
  });
  assert.equal(title, LOCKED_MESSAGE);
  assert.equal(message, LOCKED_BODY);
  assert.equal(buttons.length, 2);
  assert.deepEqual(
    { text: buttons[0].text, style: buttons[0].style },
    { text: 'Cancel', style: 'cancel' },
  );
  assert.equal(buttons[1].text, 'Verify ID');
  buttons[1].onPress();
  assert.equal(verified, 1);
});

test('a check that cannot be started now: one OK, and what is going on', () => {
  const [title, message, buttons, options] = lockedAlert(null, {
    note: 'This takes a few minutes. You can leave this page.',
  });
  assert.equal(title, LOCKED_MESSAGE);
  assert.equal(message, LOCKED_BODY);
  assert.equal(buttons, undefined);
  assert.equal(
    options.note,
    'This takes a few minutes. You can leave this page.',
  );
});

test('Verify ID from another screen opens the Wallet page and starts the check there', () => {
  const [name, params, options] = verifyParams(1234);
  assert.equal(name, 'WalletScreen');
  assert.deepEqual(params, { verifyAt: 1234 });
  // back to the Wallet page already open (Cash in came from it), not a second
  // one on top (React Navigation 7; app code review Low)
  assert.deepEqual(options, { pop: true });
  // every screen goes there only this way
  for (const file of [
    'src/Screens/WalletScreen/CashInScreen.js',
    'src/Screens/HomeScreen/Components/PaymentMethodModal.js',
    'src/Screens/HomeScreen/HomeScreen.js',
    'src/Screens/SettingsScreen/SettingsScreen.js',
    'src/Screens/PaymentOptionScreen/PaymentOptionScreen.js',
  ]) {
    const text = read(file);
    assert.match(text, /navigation\.navigate\(\.\.\.verifyParams\(\)\)/, file);
    assert.doesNotMatch(text, /verifyAt/, file);
  }
});

test('a locked wallet starts every ride on cash, whatever the balance', () => {
  assert.equal(
    startingPayment({ balance: 5000, fare: 120, locked: true }),
    'cash',
  );
  assert.equal(
    startingPayment({ balance: 5000, fare: 120, locked: false }),
    'wallet',
  );
});

test('the Activate tile tells the truth: locked or not', () => {
  const none = { active: false, ekyc: { state: 'none', triesLeftToday: 3 } };
  assert.equal(ekycTile(none).note, ACTIVATE_NOTE);
  assert.equal(LOCKED_NOTE, LOCKED_MESSAGE);
  assert.equal(ekycTile({ ...none, locked: true }).note, LOCKED_MESSAGE);
  // while locked, no tile or refusal says the wallet works as usual
  const locked = state => ({
    active: false,
    locked: true,
    ekyc: { state, reason: 'face', triesLeftToday: state === 'none' ? 0 : 2 },
  });
  for (const state of ['none', 'checking', 'review', 'failed', 'blocked']) {
    const tile = ekycTile(locked(state));
    assert.doesNotMatch(tile.note, /works (as usual|either way)/, state);
  }
  // and the tiles that offer no way on say the wallet stays off
  // (Q-UX-WALLET-EKYC-LOCK-WORDS item 5)
  assert.equal(STAYS_OFF, ' Your wallet stays off until your ID passes.');
  const noTries = {
    active: false,
    locked: true,
    ekyc: { state: 'failed', reason: 'face', triesLeftToday: 0 },
  };
  for (const [name, wallet] of [
    ['failed', locked('failed')],
    ['no_tries', noTries],
    ['blocked', locked('blocked')],
  ]) {
    const tile = ekycTile(wallet);
    assert.equal(tile.kind, name);
    assert.ok(tile.note.endsWith(STAYS_OFF), `${name}: ${tile.note}`);
    // unlocked, no such words
    assert.doesNotMatch(
      ekycTile({ ...wallet, locked: false }).note,
      /stays off/,
      name,
    );
  }
  for (const state of ['none', 'checking', 'review']) {
    const wallet = locked(state);
    wallet.ekyc.triesLeftToday = 3;
    assert.doesNotMatch(ekycTile(wallet).note, /stays off/, state);
  }
  for (const reason of [
    'ekyc_attempts_used',
    'ekyc_unavailable',
    'ekyc_contact_support',
  ]) {
    const [, words] = ekycRefusal(reason, null, true);
    assert.doesNotMatch(words, /works (as usual|either way)/, reason);
    assert.ok(words.length > 0);
    // unlocked, the words are as before
    assert.match(ekycRefusal(reason, null)[1], /works as usual/);
  }
});

// Code review Low 1: a passenger whose wallet is active is never offered a
// new check (a failed retry would lock the wallet again).
test('an active wallet offers no ID check, whatever else the answer says', () => {
  for (const wallet of [
    { active: true, locked: true, ekyc: { state: 'none', canStart: true } },
    { active: true, ekyc: { state: 'failed', triesLeftToday: 2 } },
    { active: false, ekyc: { state: 'passed', canStart: true } },
    { active: true, locked: true },
    null,
  ]) {
    assert.equal(canStartCheck(wallet), false, JSON.stringify(wallet));
    assert.equal(ekycTile(wallet), null, JSON.stringify(wallet));
  }
  assert.equal(
    canStartCheck({ active: false, locked: true, ekyc: { state: 'none' } }),
    true,
  );
  assert.equal(
    canStartCheck({
      active: false,
      locked: true,
      ekyc: { state: 'checking', canStart: false },
    }),
    false,
  );
  // the Wallet page starts a check only through it
  const wallet = read('src/Screens/WalletScreen/WalletScreen.js');
  assert.match(
    wallet,
    /const activate = async \(\) => \{[^}]{0,200}?if \(!canStartCheck\(walletRef\.current\)\) \{\s*return;\s*\}\s*setStarting\(true\);/,
  );
  assert.match(wallet, /const canStart = canStartCheck\(wallet\);/);
  assert.match(wallet, /if \(canStartCheck\(wallet\)\) \{\s*activate\(\);/);
});

test('every money screen handles ekyc_required with the same box', () => {
  for (const file of [
    'src/Screens/WalletScreen/WalletScreen.js',
    'src/Screens/WalletScreen/CashInScreen.js',
    'src/Screens/HomeScreen/Components/PaymentMethodModal.js',
    'src/Screens/HomeScreen/HomeScreen.js',
    'src/Screens/SettingsScreen/SettingsScreen.js',
    'src/Screens/PaymentOptionScreen/PaymentOptionScreen.js',
  ]) {
    const text = read(file);
    assert.match(text, /from '@\/Utils\/walletLock'/, file);
    assert.match(text, /lockedAlert\(|LOCKED_MESSAGE/, file);
  }
  // the screens that ask for money act on the refusal's reason
  for (const file of [
    'src/Screens/WalletScreen/CashInScreen.js',
    'src/Screens/HomeScreen/Components/PaymentMethodModal.js',
    'src/Screens/HomeScreen/HomeScreen.js',
  ]) {
    assert.match(read(file), /isLockedRefusal\(/, file);
  }
  // the top-up box hands its refusal's reason to the sheet
  assert.match(
    read('src/Screens/HomeScreen/Components/TopUpAmountModal.js'),
    /onError\?\.\(requestToPay\.error, requestToPay\.reason\)/,
  );
  // the request hook keeps the refusal's reason, set before the error
  const api = read('src/Services/Api.js');
  assert.match(api, /const \[reason, setReason\] = useState\(null\);/);
  assert.match(api, /setReason\([^)]*\);\s*setError\(errorMessage\);/);
  assert.match(
    api,
    /setReason\([^)]*\);\s*setIsOffline\(offline\);\s*setError\(message\);/,
  );
  assert.match(
    api,
    /return \{ makePostRequest, response, loading, error, isOffline, reason \}/,
  );
});

test('the booking sheet reads `locked` from the wallet answer', () => {
  const home = read('src/Screens/HomeScreen/HomeScreen.js');
  assert.match(
    home,
    /CUSTOMER_WALLET\(userInfo\.id\)\}\?take=0`[\s\S]{0,600}startingPayment\(\{[^}]*locked/,
  );
  const sheet = read('src/Screens/HomeScreen/Components/PaymentMethodModal.js');
  assert.match(sheet, /CUSTOMER_WALLET\(userInfo\.id\)\}\?take=0`/);
  assert.match(sheet, /walletLocked\(/);
});

test('the Wallet page gates Cash in and Cash out, and starts a check asked for elsewhere', () => {
  const wallet = read('src/Screens/WalletScreen/WalletScreen.js');
  assert.match(wallet, /const locked = walletLocked\(wallet\);/);
  assert.match(wallet, /if \(locked\) \{\s*askToVerify\(\);\s*return;\s*\}/);
  assert.equal(
    wallet.match(/if \(locked\) \{\s*askToVerify\(\);\s*return;\s*\}/g).length,
    2,
  );
  assert.match(wallet, /route\.params\?\.verifyAt/);
});

test('a lock refusal is never a sign-out', () => {
  // the sign-out path acts on 401 with signed_out only; the lock is a 403
  const signedOut = read('src/Utils/signedOut.js');
  assert.match(signedOut, /Number\(status\) !== 401/);
  assert.doesNotMatch(signedOut, /ekyc_required/);
});

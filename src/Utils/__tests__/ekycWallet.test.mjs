import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../ekycWallet.js';
const {
  ACTIVATE_NOTE,
  REASON_WORDS,
  REASON_FALLBACK,
  ekycPassed,
  ekycTile,
  ekycRefusal,
  ekycJustPassed,
  ekycCheckIsOver,
} = mod;

// EKYC-HOTFIX (A-300): the Wallet page drew only `active` and never the API's
// `ekyc` object, showed the API's error words for a refused start, and did not
// read the wallet again on coming back from the check in the browser (the QA
// run's simulated pass stayed NOT ACTIVATED).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const wallet = readFileSync(
  join(app, 'src/Screens/WalletScreen/WalletScreen.js'),
  'utf8',
);

const answer = (ekyc, active = false) => ({ active, ekyc });

test('no tile before the first answer, and none once the check passed', () => {
  assert.equal(ekycTile(null), null);
  assert.equal(ekycTile(answer({ state: 'passed', triesLeftToday: 2 })), null);
  // the old TOP PH pass: active with no PayCools row
  assert.equal(ekycTile(answer({ state: 'passed' }, true)), null);
  assert.equal(ekycPassed(answer({ state: 'passed' })), true);
  assert.equal(ekycPassed(answer({ state: 'review' })), false);
});

test('none (and an answer from an older API) is "Activate your wallet"', () => {
  for (const w of [
    answer({ state: 'none', reason: null, triesLeftToday: 3 }),
    { active: false },
  ]) {
    const tile = ekycTile(w);
    assert.equal(tile.kind, 'none');
    assert.equal(tile.title, 'Activate your wallet');
    assert.equal(tile.note, ACTIVATE_NOTE);
    assert.equal(tile.canStart, true);
    assert.equal(tile.tryAgain, false);
  }
});

test('checking and review say so and cannot be started again', () => {
  const checking = ekycTile(answer({ state: 'checking', triesLeftToday: 2 }));
  assert.equal(checking.title, 'Checking your ID');
  assert.equal(checking.canStart, false);
  const review = ekycTile(answer({ state: 'review', triesLeftToday: 0 }));
  assert.equal(review.kind, 'review');
  assert.equal(review.title, 'Your ID is being checked');
  assert.match(review.note, /No need to try again/);
  assert.equal(review.canStart, false);
});

test('failed and incomplete show the reason in words and the tries left', () => {
  for (const [reason, words] of Object.entries(REASON_WORDS)) {
    for (const state of ['failed', 'incomplete']) {
      const tile = ekycTile(answer({ state, reason, triesLeftToday: 2 }));
      assert.equal(tile.kind, 'failed');
      assert.equal(tile.title, "We couldn't confirm your ID");
      assert.equal(tile.note, `${words} Tries left today: 2.`);
      assert.equal(tile.canStart, true);
      assert.equal(tile.tryAgain, true);
    }
  }
  const unknown = ekycTile(
    answer({ state: 'failed', reason: null, triesLeftToday: 1 }),
  );
  assert.equal(unknown.note, `${REASON_FALLBACK} Tries left today: 1.`);
  // never a raw reason on screen
  const raw = ekycTile(
    answer({
      state: 'failed',
      reason: 'tamper check failed',
      triesLeftToday: 1,
    }),
  );
  assert.doesNotMatch(raw.note, /tamper/);
});

test('no tries left today: nothing to start, and the wallet works as usual', () => {
  for (const state of ['none', 'failed', 'incomplete']) {
    const tile = ekycTile(answer({ state, reason: 'face', triesLeftToday: 0 }));
    assert.equal(tile.kind, 'no_tries');
    assert.equal(tile.title, 'No more tries today');
    assert.equal(tile.canStart, false);
  }
});

test('blocked is neutral: no reason, nothing to start', () => {
  const tile = ekycTile(
    answer({ state: 'blocked', reason: null, triesLeftToday: 3 }),
  );
  assert.equal(tile.kind, 'blocked');
  assert.equal(tile.title, "We couldn't confirm your ID here");
  assert.equal(tile.canStart, false);
});

test("a refused start's words are chosen by data.reason, not the API's message", () => {
  const apiWords = 'No more identity checks today; please try again tomorrow';
  assert.deepEqual(
    ekycRefusal('ekyc_attempts_used', apiWords)[0],
    'No more tries today',
  );
  assert.equal(
    ekycRefusal('ekyc_unavailable', 'x')[0],
    'Not available right now',
  );
  assert.equal(
    ekycRefusal('ekyc_not_started', 'x')[0],
    "Couldn't start the check",
  );
  assert.equal(
    ekycRefusal('ekyc_contact_support', 'x')[0],
    "We couldn't confirm your ID here",
  );
  for (const reason of [
    'ekyc_attempts_used',
    'ekyc_unavailable',
    'ekyc_not_started',
    'ekyc_contact_support',
  ]) {
    assert.doesNotMatch(
      ekycRefusal(reason, apiWords)[1],
      /identity checks today/,
    );
  }
  // no reason (no connection): the request's own words
  assert.deepEqual(ekycRefusal(undefined, 'Weak connection'), [
    'Activate your wallet',
    'Weak connection',
  ]);
});

test('the wallet becoming active while on screen is told once', () => {
  const before = answer({ state: 'none', triesLeftToday: 3 });
  const after = answer({ state: 'passed', triesLeftToday: 2 }, true);
  assert.equal(ekycJustPassed(before, after), true);
  assert.equal(ekycJustPassed(after, after), false);
  // the first read of an already active wallet is not news
  assert.equal(ekycJustPassed(null, after), false);
});

test('a check is over on any status but pending', () => {
  assert.equal(ekycCheckIsOver('pending'), false);
  assert.equal(ekycCheckIsOver(undefined), false);
  assert.equal(ekycCheckIsOver('success'), true);
  assert.equal(ekycCheckIsOver('failed'), true);
  assert.equal(ekycCheckIsOver('review'), true);
});

test('the Wallet page reads again when the app comes back from the browser', () => {
  // useFocusEffect does not run on coming back from Chrome: the page never lost
  // focus inside the app. AppState does.
  assert.match(wallet, /AppState\.addEventListener\(\s*'change'/);
  assert.match(wallet, /next === 'active'[\s\S]{0,120}loadRef\.current\(\)/);
});

test('the Wallet page draws the tile from the ekyc object and refusals by reason', () => {
  assert.match(wallet, /ekycTile\(wallet\)/);
  assert.match(wallet, /ekycRefusal\(reason, error/);
  assert.match(
    wallet,
    /const \{ response, error, reason \} = await ekycRequest/,
  );
  assert.doesNotMatch(wallet, /Boolean\(wallet\?\.active\)/);
});

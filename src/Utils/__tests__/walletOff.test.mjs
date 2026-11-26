import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// The Google Play build has no wallet (the owner, A-287 item 1 and A-290
// item 3): the wallet is on only in a build whose package ends in ".dev", or
// ".sandbox" (A-342 / A-345: Sandbox is an exact copy of Develop).
// The same file in both apps (sharedUi.test.mjs).

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const modulePath = join(root, 'src/Utils/walletOff.js');

const load = () => {
  assert.ok(existsSync(modulePath), 'src/Utils/walletOff.js is missing');
  return require(modulePath);
};

test('the Play package names mean the wallet is off', () => {
  const { walletOffFor } = load();
  assert.equal(walletOffFor('com.pinoyride.customer'), true);
  assert.equal(walletOffFor('com.pinoyride.rider'), true);
});

test('the Develop ".dev" package names mean the wallet is on', () => {
  const { walletOffFor } = load();
  assert.equal(walletOffFor('com.pinoyride.customer.dev'), false);
  assert.equal(walletOffFor('com.pinoyride.rider.dev'), false);
});

test('the Sandbox ".sandbox" package names mean the wallet is on, as on Develop', () => {
  const { walletOffFor, appBuildHeaderFor } = load();
  assert.equal(walletOffFor('com.pinoyride.customer.sandbox'), false);
  assert.equal(walletOffFor('com.pinoyride.rider.sandbox'), false);
  // the API refuses money routes only to "play"; Sandbox says "dev" as Develop does
  assert.deepEqual(
    appBuildHeaderFor(walletOffFor('com.pinoyride.rider.sandbox')),
    { 'X-App-Build': 'dev' },
  );
});

test('anything unknown fails closed: the wallet is off', () => {
  const { walletOffFor } = load();
  for (const name of [
    '',
    undefined,
    null,
    'unknown',
    'com.pinoyride.customer.devx',
    'com.pinoyride.customer.dev ',
    'com.pinoyride.rider.DEV',
    'com.pinoyride.rider.de',
    'com.pinoyride.rider.sandboxx',
    'com.pinoyride.rider.SANDBOX',
    'com.pinoyride.customersandbox',
    42,
    {},
  ]) {
    assert.equal(walletOffFor(name), true, `${String(name)} must be off`);
  }
});

test('without the native module (node, or an error) the wallet is off', () => {
  const { walletOff, appBuildHeader } = load();
  assert.equal(walletOff(), true);
  assert.deepEqual(appBuildHeader(), { 'X-App-Build': 'play' });
});

test('the header follows the rule', () => {
  const { appBuildHeaderFor, walletOffFor, APP_BUILD_HEADER } = load();
  assert.equal(APP_BUILD_HEADER, 'X-App-Build');
  assert.deepEqual(appBuildHeaderFor(walletOffFor('com.pinoyride.rider')), {
    'X-App-Build': 'play',
  });
  assert.deepEqual(
    appBuildHeaderFor(walletOffFor('com.pinoyride.customer.dev')),
    { 'X-App-Build': 'dev' },
  );
});

test("the API's 403 wallet_off is told apart from every other answer", () => {
  const { walletOffRefused, WALLET_OFF_MESSAGE } = load();
  const body = {
    status: 'error',
    code: 403,
    message: 'This is not available in this version of Pinoy Ride.',
    data: { reason: 'wallet_off' },
  };
  assert.equal(walletOffRefused(403, body), true);
  // the body's code alone (an answer read from the envelope)
  assert.equal(walletOffRefused(undefined, body), true);
  // another 403 (a cash-out's sign_in_again) is not this
  assert.equal(
    walletOffRefused(403, { code: 403, data: { reason: 'sign_in_again' } }),
    false,
  );
  // never a 401: a 401 is the sign-out path, not this one
  assert.equal(
    walletOffRefused(401, { code: 401, data: { reason: 'wallet_off' } }),
    false,
  );
  assert.equal(walletOffRefused(403, null), false);
  assert.equal(walletOffRefused(200, { data: {} }), false);
  assert.match(WALLET_OFF_MESSAGE, /not available in this version/);
  assert.doesNotMatch(WALLET_OFF_MESSAGE, /wallet|sign/i);
});

// Landing order (design R-1): today's Develop APKs are com.pinoyride.*, the
// Play names. Landed on them, this code would take the wallet from every
// Develop tester. It may land only once the Develop builds carry the ".dev"
// suffix, which is native (a new APK line); self-updates for the old line
// stop at its last commit, so they never get this code.
test('the Develop builds carry the ".dev" package suffix (landing order)', () => {
  const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
  assert.match(
    gradle,
    /applicationIdSuffix\s*(=\s*)?["']\.dev["']/,
    'android/app/build.gradle has no applicationIdSuffix ".dev": wallet-off must land after the .dev package change',
  );
});

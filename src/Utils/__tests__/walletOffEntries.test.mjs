import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Google Play build has no wallet (the owner, A-287 item 1 and A-290
// item 3; Utils/walletOff.js): every way into it is hidden there, and every
// request says which build it comes from. Source checks, as
// alertsInOneLook.test.mjs does them. The Passenger app's own list.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = file => readFileSync(join(app, file), 'utf8');

const sources = (dir = join(app, 'src')) =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sources(path);
    }
    return path.endsWith('.js') ? [relative(app, path)] : [];
  });

// The wallet's screens, registered only when the wallet is on.
const WALLET_ROUTES = [
  'EKYCScreen',
  'PaymentOptionScreen',
  'WalletScreen',
  'WalletTransactionsScreen',
  'CashInScreen',
  'CashOutScreen',
  'QRPHScreen',
];

// Files only the wallet's own screens show: unreachable when they are not
// registered. TopUpAmountModal is drawn only by PaymentMethodModal, which
// leaves it out when the wallet is off (checked below).
const INSIDE_THE_WALLET = [
  /^src\/Screens\/WalletScreen\//,
  /^src\/Screens\/QRPH\//,
  /^src\/Screens\/PaymentOptionScreen\//,
  /^src\/Screens\/EKYCScreen\//,
  /^src\/Screens\/HomeScreen\/Components\/TopUpAmountModal\.js$/,
];

const IMPORTS_WALLET_OFF = /from '@\/Utils\/walletOff'/;

const opensAWalletScreen = text =>
  WALLET_ROUTES.some(
    name =>
      text.includes(`navigate('${name}'`) ||
      text.includes(`name: '${name}'`) ||
      /walletRoute\(/.test(text),
  );

test('every file that opens a wallet screen asks walletOff first', () => {
  const left = sources()
    .filter(file => file !== 'src/Utils/cashOut.js') // walletRoute itself
    .filter(file => !INSIDE_THE_WALLET.some(inside => inside.test(file)))
    .filter(file => opensAWalletScreen(read(file)))
    .filter(file => !IMPORTS_WALLET_OFF.test(read(file)));
  assert.deepEqual(
    left,
    [],
    'gate these with walletOff() (Utils/walletOff.js)',
  );
});

// The blocks of the navigator drawn only when the wallet is on.
const guardedBlocks = text =>
  [...text.matchAll(/\{noWallet \? null : \(([\s\S]*?)\n\s*\)\}/g)].map(
    match => match[1],
  );

test('every wallet route is registered only when the wallet is on', () => {
  const navigator = read('src/Navigators/Application.js');
  assert.match(navigator, /const noWallet = walletOff\(\);/);
  const guarded = guardedBlocks(navigator).join('\n');
  for (const name of WALLET_ROUTES) {
    const all = navigator.split(`name="${name}"`).length - 1;
    const inside = guarded.split(`name="${name}"`).length - 1;
    assert.ok(all >= 1, `${name} is not in the navigator`);
    assert.equal(inside, all, `${name} must sit inside a noWallet guard`);
  }
  // the rest of the app stays
  for (const name of [
    'HomeScreen',
    'AppTransactionComplete',
    'SettingsScreen',
  ]) {
    assert.doesNotMatch(guarded, new RegExp(`name="${name}"`));
  }
});

test('every request to the API says which build it comes from', () => {
  const withKey = sources().filter(file =>
    /['"]x-api-key['"]\s*:/i.test(read(file)),
  );
  assert.ok(withKey.length >= 3, 'the request builders were not found');
  const left = withKey.filter(
    file => !/\.\.\.appBuildHeader\(\)/.test(read(file)),
  );
  assert.deepEqual(left, [], 'spread appBuildHeader() into these headers');
  // the build check, which sends no key
  assert.match(read('src/Utils/askBuildCheck.js'), /\.\.\.appBuildHeader\(\)/);
});

test("the API's 403 wallet_off is a calm word, never a sign-out", () => {
  for (const file of ['src/Services/Api.js', 'src/Services/ApiV2.js']) {
    const text = read(file);
    assert.match(
      text,
      /walletOffRefused\(/,
      `${file} must tell wallet_off apart`,
    );
    assert.match(text, /error: WALLET_OFF_MESSAGE/, file);
  }
  const signedOut = read('src/Utils/signedOut.js');
  // the sign-out path acts on 401 only
  assert.match(signedOut, /Number\(status\) !== 401/);
});

test('the Account page shows no wallet card, Cash in or Payment options', () => {
  const text = read('src/Screens/SettingsScreen/SettingsScreen.js');
  assert.match(text, /const noWallet = walletOff\(\);/);
  // the card (with Cash in) and the Payment options row are drawn only when on
  const blocks = guardedBlocks(text).join('\n');
  assert.match(blocks, /navigate\('WalletScreen'\)/);
  assert.match(blocks, /navigate\('CashInScreen'/);
  assert.match(blocks, /navigate\('PaymentOptionScreen'\)/);
  // and the balance is not read
  assert.match(text, /if \(noWallet\) \{\s*return;\s*\}/);
});

test('the booking sheet is cash only: no wallet, no top-up, no balance read', () => {
  const picker = read(
    'src/Screens/HomeScreen/Components/PaymentMethodModal.js',
  );
  assert.match(picker, /const noWallet = walletOff\(\);/);
  assert.match(picker, /if \(noWallet \|\| !visible/);
  const blocks = guardedBlocks(picker).join('\n');
  assert.match(blocks, /onSelect\?\.\('wallet'\)/);
  assert.match(blocks, /Top up the wallet/);
  assert.match(blocks, /<TopUpAmountModal/);
  const home = read('src/Screens/HomeScreen/HomeScreen.js');
  assert.match(
    home,
    /if \(walletOff\(\)\) \{[\s\S]{0,200}startingPayment\(\{ cashOnly: true \}\)/,
  );
});

test('registering starts no identity check, and a money notification opens Home', () => {
  assert.match(
    read('src/Screens/Login/RegisterScreen.js'),
    /if \(walletOff\(\)\) \{\s*navigation\.navigate\('RegisterFormScreen'\);\s*return;\s*\}\s*fetchEKYCUrl/,
  );
  assert.match(
    read('src/Services/Push/pushEvents.js'),
    /walletOff\(\) \? \{ name: 'HomeScreen', params: \{\} \} : walletRoute\(\)/,
  );
  assert.match(
    read('src/Components/AppTransactionComplete/AppTransactionComplete.js'),
    /\{noWallet \? null : \(\s*<AppButton\s*title="View Wallet"/,
  );
});

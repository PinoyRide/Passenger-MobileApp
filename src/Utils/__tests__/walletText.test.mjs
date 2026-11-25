import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Q-WALLET-TEXT (the owner, A-199 and A-217, 2026-11-26): the Wallet tile
// promised "RideRewards", which do not exist; it now says the identity check
// is optional (the team's wording O-2). And the rating page's "Contact
// support" dialled a number never confirmed as a support line; it now shows
// the one support contact (Utils/supportContact.js).

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

const sources = (dir = 'src') =>
  readdirSync(join(app, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(app, path)).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }
    return /\.(js|jsx|ts|tsx)$/.test(name) ? [path] : [];
  });

// Comments may name the old words; only code and words on screen count.
const withoutComments = text =>
  text
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

test('no screen promises RideRewards', () => {
  const found = sources().filter(path =>
    /ride\s*rewards?/i.test(withoutComments(read(path))),
  );
  assert.deepEqual(found, []);
});

test('the Activate tile says the check is optional, on screen and to a screen reader', () => {
  const wallet = read('src/Screens/WalletScreen/WalletScreen.js');
  assert.match(
    wallet,
    /const ACTIVATE_NOTE =\s*'Optional\. Check your ID once\. Your wallet works either way\.';/,
  );
  assert.match(wallet, /accessibilityHint=\{ACTIVATE_NOTE\}/);
  assert.match(
    wallet,
    /<Text style=\{styles\.activateNote\}>\{ACTIVATE_NOTE\}<\/Text>/,
  );
  assert.match(
    wallet,
    /<Text style=\{styles\.activateTitle\}>Activate your wallet<\/Text>/,
  );
});

test("the rating page's Contact support shows the support contact and dials nothing", () => {
  const rating = withoutComments(
    read('src/Screens/RatingScreen/RatingScreen.js'),
  );
  assert.doesNotMatch(rating, /SUPPORT_NUMBER|09770368299|tel:|telprompt:/);
  assert.match(
    rating,
    /const handleContactSupport = \(\) =>\s*appAlert\(\.\.\.supportAlert\(Linking\.openURL\)\);/,
  );
  assert.match(rating, /onPress=\{handleContactSupport\}/);
});

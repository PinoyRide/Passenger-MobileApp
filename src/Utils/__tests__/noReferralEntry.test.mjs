import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The owner, A-188 (2026-11-26): hide the referral screen in both apps, "no
// referral programme planned yet". "Promo & referrals" showed the same made-up
// code (4F45HFA9AS) to every passenger and promised ride credits nothing paid
// (Q-FINDING-REFERRAL). In this app the same page holds the real promos (the
// list and the "NEW" badge, QA HIS-15), so only its referral part is switched
// off and the page is "Promos". The code stays for a real programme later.
// These fail if a way to the referral part comes back.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');
const SCREEN = 'src/Screens/PromoReferralsScreen/PromoReferralsScreen.js';
const REFERRAL_WORDS = /referral|invite your friends|4F45HFA9AS|ride credits/i;

const sources = (dir = 'src') =>
  readdirSync(join(app, dir)).flatMap(name => {
    const path = join(dir, name);
    if (statSync(join(app, path)).isDirectory()) {
      return name === '__tests__' ? [] : sources(path);
    }
    return /\.(js|jsx|ts|tsx)$/.test(name) ? [path] : [];
  });

// Comments may talk about referrals; only code and words on screen count.
const withoutComments = text =>
  text
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');

// The screen without the block `{SHOW_REFERRALS && ( ... )}`.
const withoutReferralBlock = text => {
  const start = text.indexOf('{SHOW_REFERRALS && (');
  assert.notEqual(start, -1, 'the referral part is behind SHOW_REFERRALS');
  let depth = 0;
  let i = text.indexOf('(', start);
  for (; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth === 0) break;
  }
  assert.equal(text.slice(i, i + 2), ')}', 'the referral block closes');
  return text.slice(0, start) + text.slice(i + 2);
};

test('the referral part of the promos page is switched off', () => {
  const screen = withoutComments(read(SCREEN));
  assert.match(screen, /^const SHOW_REFERRALS = false;$/m);
  // used only to hide the block: never flipped, or'd or passed on
  assert.deepEqual(screen.match(/SHOW_REFERRALS[^\n]*/g), [
    'SHOW_REFERRALS = false;',
    'SHOW_REFERRALS && (',
  ]);
  // what the page draws: its return, without the switched-off block
  const drawn = screen.slice(
    screen.indexOf('\n  return ('),
    screen.indexOf('\nexport default'),
  );
  assert.match(drawn, /<FlatList/);
  assert.doesNotMatch(withoutReferralBlock(drawn), REFERRAL_WORDS);
});

test('the promos stay reachable from the Account page, with their badge', () => {
  const account = read('src/Screens/SettingsScreen/SettingsScreen.js');
  assert.match(
    account,
    /title="Promos"\s+badge=\{newPromos > 0 \? `\$\{newPromos\} NEW` : undefined\}\s+onPress=\{openPromos\}/,
  );
  assert.match(account, /navigation\.navigate\('PromoReferralsScreen'\)/);
  const screen = read(SCREEN);
  assert.match(screen, /Constants\.ENDPOINT\.GET_PROMO_LIST/);
  assert.match(screen, /data=\{promos\}/);
  assert.match(screen, /<Text style=\{styles\.headerTitle\}>Promos<\/Text>/);
});

test('no row, title or words on screen in the app offer referrals', () => {
  const offenders = sources()
    .filter(path => path !== SCREEN)
    // the privacy policy lists what the account holds, not a way in
    .filter(path => !path.endsWith('src/Utils/privacyPolicyContent.js'))
    .filter(path =>
      REFERRAL_WORDS.test(
        withoutComments(read(path)).replace(/PromoReferralsScreen/g, ''),
      ),
    );
  assert.deepEqual(offenders, []);
});

test('the page opens only from the Promos row: no other way in, no deep link', () => {
  const ways = sources().filter(path =>
    /PromoReferralsScreen/.test(withoutComments(read(path))),
  );
  assert.deepEqual(
    ways.sort(),
    [
      SCREEN,
      'src/Navigators/Application.js',
      'src/Screens/SettingsScreen/SettingsScreen.js',
      'src/Screens/index.js',
    ].sort(),
  );
  const account = withoutComments(
    read('src/Screens/SettingsScreen/SettingsScreen.js'),
  );
  assert.equal(account.match(/PromoReferralsScreen/g).length, 1);
  // React Navigation opens screens from links only through `linking`
  assert.doesNotMatch(read('src/Navigators/Application.js'), /\blinking\b/);
});

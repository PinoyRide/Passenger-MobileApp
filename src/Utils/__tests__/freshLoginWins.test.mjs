// A sign-in's token always wins over a swapped one (Code reviewer, Q-REVIEW-V2113: the Rider app's store kept a
// swapped token over a fresh sign-in; this app keeps the token apart from the passenger and was checked to not do
// that). These pin it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = path =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
const slice = source('Redux/Slices/userSlice.js');
const reducer = name => {
  const start = slice.indexOf(`    ${name}: `);
  assert.ok(start >= 0, `${name} is in the user slice`);
  return slice.slice(start, slice.indexOf('\n    },', start));
};

test('signing in stores its token unconditionally, as a sign-in token (no swap time)', () => {
  const set = reducer('setSessionToken');
  assert.match(set, /state\.sessionToken = action\.payload \|\| null;/);
  assert.match(set, /state\.sessionTokenAt = null;/);
  assert.doesNotMatch(set, /isNewer|return;/);
  // the sign-in screen stores it after the passenger
  assert.match(source('Screens/Login/OTPScreen.js'), /dispatch\(setUserInfo\([\s\S]*?\)\);\s*\n[\s\S]*?dispatch\(setSessionToken\(/);
});

test('only the swap compares times', () => {
  assert.match(reducer('swapSessionToken'), /isNewer\(at, state\.sessionTokenAt\)/);
  assert.doesNotMatch(reducer('setUserInfo'), /isNewer/);
});

test('saving the passenger never changes the token; another account or signing out clears both', () => {
  const save = reducer('setUserInfo');
  assert.match(save, /if \(state\.userInfo\?\.id !== action\.payload\?\.id\) \{[\s\S]*?state\.sessionToken = null;[\s\S]*?state\.sessionTokenAt = null;/);
  const clear = reducer('clearUserInfo');
  assert.match(clear, /state\.sessionToken = null;/);
  assert.match(clear, /state\.sessionTokenAt = null;/);
});

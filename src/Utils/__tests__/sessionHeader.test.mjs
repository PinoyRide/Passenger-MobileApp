// Security finding F-1 (2026-11-25): the API answers a request naming a
// passenger only with that passenger's sign-in token. Both clients that talk
// to it must send it, read when the request goes out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mod from '../sessionHeader.js';

const { SESSION_HEADER, sessionHeaderFrom } = mod;
const source = path =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

test('the header carries the signed-in passenger token', () => {
  assert.equal(SESSION_HEADER, 'X-Customer-Session');
  assert.deepEqual(sessionHeaderFrom({ user: { sessionToken: 'abc' } }), {
    'X-Customer-Session': 'abc',
    // and takes a new one behind the scenes (F-2 part 2)
    'X-Session-Swap': '1',
  });
});

test('no token, no header (signed out, or signed in before 2.0.52)', () => {
  assert.deepEqual(sessionHeaderFrom({ user: { sessionToken: null } }), {});
  assert.deepEqual(sessionHeaderFrom({ user: {} }), {});
  assert.deepEqual(sessionHeaderFrom(undefined), {});
});

for (const client of ['Services/Api.js', 'Services/ApiV2.js']) {
  test(`${client} sends it on every request`, () => {
    const text = source(client);
    assert.match(text, /import \{ sessionHeader, takeNewToken \} from '@\/Utils\/sessionHeader'/);
    assert.match(text, /sessionHeader\(\)/);
  });
}

// F-2 part 2: a token handed out behind the scenes is stored from every
// answer, success, error or stale, and only over an older one.
for (const client of ['Services/Api.js', 'Services/ApiV2.js']) {
  test(`${client} stores a new token from every answer`, () => {
    const text = source(client);
    assert.match(text, /takeNewToken\(res\.headers\);\s*\n(\s*\/\/.*\n)*\s*if \(!isLatest\(\)\)/);
  });
}

test('Services/Api.js also takes it from an error answer', () => {
  assert.match(source('Services/Api.js'), /takeNewToken\(err\?\.response\?\.headers\)/);
});

test('the store keeps a swapped token only while signed in, only over an older one, and keeps it', () => {
  const slice = source('Redux/Slices/userSlice.js');
  assert.match(
    slice,
    /swapSessionToken: \(state, action\) => \{[\s\S]*?!state\.sessionToken \|\| !state\.userInfo[\s\S]*?isNewer\(at, state\.sessionTokenAt\)/,
  );
  // signing in again, another account and signing out start over
  assert.equal((slice.match(/state\.sessionTokenAt = null;/g) || []).length, 3);
  // the whole user state is kept across restarts (no whitelist leaves it out)
  const store = source('Redux/store.js');
  assert.doesNotMatch(store, /whitelist|blacklist: \[[^\]]*session/);
});

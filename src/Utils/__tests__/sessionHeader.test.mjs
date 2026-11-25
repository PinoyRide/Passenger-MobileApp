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
    assert.match(text, /import \{ sessionHeader \} from '@\/Utils\/sessionHeader'/);
    assert.match(text, /sessionHeader\(\)/);
  });
}

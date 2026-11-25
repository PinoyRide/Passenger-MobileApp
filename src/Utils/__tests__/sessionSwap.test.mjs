// The silent token swap (F-2 part 2): the shared helper. The same file in
// both apps.
import test from 'node:test';
import assert from 'node:assert/strict';
import mod from '../sessionSwap.js';

const { SWAP_HEADER, swapRequestHeaders, newTokenFrom, isNewer } = mod;

test('every request asks for swaps', () => {
  assert.equal(SWAP_HEADER, 'X-Session-Swap');
  assert.deepEqual(swapRequestHeaders(), { 'X-Session-Swap': '1' });
});

test('a new token is read from the answer, with when it was made', () => {
  assert.deepEqual(
    newTokenFrom({ 'x-new-session': 'abc', 'x-new-session-at': '1764072000000' }),
    { token: 'abc', at: 1764072000000 },
  );
  // AxiosHeaders
  const headers = new Map([
    ['x-new-session', 'abc'],
    ['x-new-session-at', '5'],
  ]);
  assert.deepEqual(newTokenFrom({ get: name => headers.get(name) }), {
    token: 'abc',
    at: 5,
  });
});

test('no token, or one without a time, is nothing to store', () => {
  assert.equal(newTokenFrom(undefined), null);
  assert.equal(newTokenFrom({}), null);
  assert.equal(newTokenFrom({ 'x-new-session': 'abc' }), null);
  assert.equal(
    newTokenFrom({ 'x-new-session': ' ', 'x-new-session-at': '5' }),
    null,
  );
  assert.equal(
    newTokenFrom({ 'x-new-session': 'abc', 'x-new-session-at': 'soon' }),
    null,
  );
});

test('only a newer token replaces the stored one (answers out of order)', () => {
  assert.equal(isNewer(10, undefined), true); // over the sign-in token
  assert.equal(isNewer(10, null), true);
  assert.equal(isNewer(10, 5), true);
  assert.equal(isNewer(5, 10), false); // an older swap answered last
  assert.equal(isNewer(10, 10), false);
});

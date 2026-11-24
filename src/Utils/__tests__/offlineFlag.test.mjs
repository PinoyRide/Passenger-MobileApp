import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

// QA CHT-09 (2026-11-25): with airplane mode on, the chat showed Home's
// "Error — Oops, you may have weak or no data connection..." box. Home's
// booking poll is meant to fail silently offline: it checks `isOffline` when
// `error` changes. The app runs the old architecture (no batching after an
// await), so each setState renders on its own: with `error` set first, Home
// saw the error while `isOffline` was still false. `isOffline` goes first.
test('a failed request says it is offline before it shows its error', () => {
  const api = read('src/Services/Api.js');
  assert.match(api, /setIsOffline\(true\);\s*setError\(OFFLINE_MESSAGE\);/);
  assert.match(api, /setIsOffline\(offline\);\s*setError\(message\);/);
  assert.doesNotMatch(api, /setError\(OFFLINE_MESSAGE\);\s*setIsOffline\(true\);/);
  assert.doesNotMatch(api, /setError\(message\);\s*setIsOffline\(offline\);/);
});

test("Home's booking poll stays quiet when offline", () => {
  assert.match(
    read('src/Screens/HomeScreen/HomeScreen.js'),
    /if \(getBookingDetails\.error\) \{[\s\S]{0,400}?if \(getBookingDetails\.isOffline\) \{\s*return;/,
  );
});

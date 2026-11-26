import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../updateNeededText.js';

const { UPDATE_NEEDED, updateNeededText, minimumVersionLine } = mod;

// A-184, C-4: the owner approved these words on 2026-11-26.
test('the approved words', () => {
  assert.equal(UPDATE_NEEDED.title, 'Update needed');
  assert.equal(
    UPDATE_NEEDED.message,
    'A newer version of Pinoy Ride is needed. Tap Update to download it. You stay signed in.',
  );
  assert.equal(UPDATE_NEEDED.button, 'Update');
});

// The helper is given the version as people count it; the screen turns the
// API's real one (2.0.103) with displayVersion first (v2.1.04).
test('the version line', () => {
  assert.equal(minimumVersionLine('2.1.04'), 'Version v2.1.04 or newer.');
  assert.equal(minimumVersionLine(' 2.1.21 '), 'Version v2.1.21 or newer.');
});

test('no version line without a minimum version', () => {
  for (const nothing of [undefined, null, '', '   ', 42, {}]) {
    assert.equal(minimumVersionLine(nothing), null, String(nothing));
  }
  assert.equal(updateNeededText(undefined).versionLine, null);
});

test('updateNeededText gives the words and the line together', () => {
  assert.deepEqual(updateNeededText('2.1.04'), {
    title: 'Update needed',
    message:
      'A newer version of Pinoy Ride is needed. Tap Update to download it. You stay signed in.',
    button: 'Update',
    versionLine: 'Version v2.1.04 or newer.',
  });
});

// The screen shows these words and nothing of the old ones; it uses the
// shared button, the gold icon patch and colours from modern.js only.
const screen = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../Screens/Login/UpdateRequiredScreen.js',
  ),
  'utf8',
);

test('the screen takes its words from the helper', () => {
  assert.match(screen, /updateNeededText\(displayVersion\(minimumVersion\)\)/);
  for (const old of [
    'Update Required',
    'Update Now',
    'Please update the app',
  ]) {
    assert.ok(!screen.includes(old), `old words left: ${old}`);
  }
});

test('the screen uses AppButton, the chip patch and no fixed colours', () => {
  assert.match(screen, /<AppButton\b/);
  assert.match(screen, /look\.chip\b/);
  assert.match(screen, /look\.chipInk\b/);
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(screen), 'a fixed colour is left');
  assert.ok(!/TouchableOpacity/.test(screen), 'a button of its own is left');
});

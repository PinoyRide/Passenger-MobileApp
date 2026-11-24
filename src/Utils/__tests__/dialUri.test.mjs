import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mod from '../dialUri.js';
const { dialUri } = mod;

// QA TRP-06 (2026-11-25): "Call" on the trip sheet opened the dialer with
// 639111111111, the rider's number without its "+", which a Philippine
// network does not put through as a mobile number.

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = path => readFileSync(join(app, path), 'utf8');

test("the rider's number as the trip sends it is dialled with +63", () => {
  assert.equal(dialUri('639111111111'), 'tel:+639111111111');
});

test('other spellings of a Philippine mobile number reach the same +63 form', () => {
  assert.equal(dialUri('+639111111111'), 'tel:+639111111111');
  assert.equal(dialUri('+63 911 111 1111'), 'tel:+639111111111');
  assert.equal(dialUri('09111111111'), 'tel:+639111111111');
  assert.equal(dialUri('9111111111'), 'tel:+639111111111');
});

test('no number, no address; anything else is dialled as its digits', () => {
  assert.equal(dialUri(''), '');
  assert.equal(dialUri(null), '');
  assert.equal(dialUri(undefined), '');
  assert.equal(dialUri('911'), 'tel:911');
});

test('the trip sheet\'s Call dials through dialUri, not a bare tel:', () => {
  const sheet = read('src/Screens/HomeScreen/Components/BookingStatusModal.js');
  assert.match(sheet, /Linking\.openURL\(dialUri\(phoneNumber\)\)/);
  assert.doesNotMatch(sheet, /`tel:\$\{phoneNumber\}`/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The owner, 2026-11-23, of Report an Issue: "i cant see the whole when
// keyboard pop, when i minimized my keyboard the card also closes". On
// Android a <Modal> is a window the keyboard neither lifts nor reports to
// React Native, and its Back also closed the box when it only lowered the
// keyboard. The boxes to type in are layers of their screen
// (Components/TypingLayer) instead.
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
// the code without its comments (which may say why it is not a <Modal>)
const read = path =>
  readFileSync(join(app, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const TYPING_BOXES = [
  'src/Screens/BookingHistoryScreen/Components/ReportIssueModal.js',
  'src/Screens/HomeScreen/Components/NoteToRiderModal.js',
  'src/Screens/HomeScreen/Components/PromoModal.js',
];

for (const file of TYPING_BOXES) {
  test(`${file} is a layer of its screen, not a Modal`, () => {
    const source = read(file);
    assert.doesNotMatch(source, /<Modal\b/);
    assert.match(source, /<TypingLayer\b/);
  });
}

test('the layer lifts its box over the keyboard and takes Back', () => {
  const layer = read('src/Components/TypingLayer/TypingLayer.js');
  assert.match(layer, /<KeyboardAvoidingView\s+behavior="padding"/);
  assert.match(layer, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.doesNotMatch(layer, /<Modal\b/);
});

test('a tap outside while typing only lowers the keyboard', () => {
  const layer = read('src/Components/TypingLayer/TypingLayer.js');
  assert.match(
    layer,
    /if \(Keyboard\.isVisible\(\)\) \{\s*Keyboard\.dismiss\(\);\s*return;/,
  );
});
